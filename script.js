/* ==========================================================================
   Blood Donor Finder Portal - Production Application Logic
   Vanilla JS · Supabase (PostgreSQL + Auth) backend
   ==========================================================================
   This file expects config.js to be loaded FIRST (it defines
   window.BLOOD_PORTAL_CONFIG with your Supabase URL + anon key).
   ========================================================================== */

(function () {
  "use strict";

  /* ----------  Config & Supabase bootstrap  ---------- */
  var CFG = window.BLOOD_PORTAL_CONFIG || {};
  var BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

  // Load the official Supabase JS client from CDN (works without npm).
  function loadSupabaseClient(cb) {
    if (window.supabase && CFG.isConfigured && CFG.isConfigured()) {
      var client = window.supabase.createClient(
        CFG.supabaseUrl, CFG.supabaseAnonKey
      );
      window.BD_SUPABASE = client;
      cb(null, client);
      return;
    }
    cb(new Error("not-configured"));
  }

  // Inject the Supabase JS library if it isn't already present.
  function ensureSupabaseLib(onReady) {
    if (window.supabase) { onReady(); return; }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.1/dist/umd/supabase.min.js";
    s.async = true;
    s.onload = onReady;
    s.onerror = function () {
      showFatalError("Could not load the database library. Check your internet connection and refresh.");
    };
    document.head.appendChild(s);
  }

  /* ----------  Helpers  ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/);
    if (!parts[0]) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function maskEmail(email) {
    var at = String(email || "").indexOf("@");
    if (at < 2) return email;
    return email.charAt(0) + "***" + email.slice(at);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  function toast(msg, type) {
    type = type || "info";
    var stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    var el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      el.style.transition = "all 0.25s ease";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 2800);
  }

  function showAlert(form, msg, type) {
    if (!form) return;
    var a = form.querySelector(".alert");
    if (!a) {
      a = document.createElement("div");
      form.insertBefore(a, form.firstChild);
    }
    a.className = "alert alert--" + (type || "info");
    a.textContent = msg;
    if (type === "success") {
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 4000);
    }
  }

  function showFatalError(msg) {
    var existing = document.getElementById("fatalBanner");
    if (existing) existing.remove();
    var banner = document.createElement("div");
    banner.id = "fatalBanner";
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;" +
      "background:#d90429;color:#fff;padding:14px 20px;font-family:sans-serif;" +
      "font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)";
    banner.innerHTML =
      "<strong>⚠ Setup needed:</strong> " + escapeHtml(msg) +
      ' &nbsp; <a href="#" style="color:#fff;text-decoration:underline" onclick="location.reload()">Reload</a>';
    document.body.appendChild(banner);
  }

  function isAdminEmail(email) {
    if (!email) return false;
    email = email.toLowerCase();
    var admins = CFG.adminEmails || [];
    return admins.some(function (a) { return a.toLowerCase() === email; });
  }

  /* ----------  CURRENT USER / SESSION  ---------- */
  function currentSession() {
    var client = window.BD_SUPABASE;
    if (!client) return null;
    // supabase-js v2: session is read synchronously from the in-memory store
    try {
      var session = client.auth.session ? client.auth.session() : null;
      return session;
    } catch (e) { return null; }
  }

  function currentAuthUser() {
    var client = window.BD_SUPABASE;
    if (!client) return null;
    var s = client.auth.session ? client.auth.session() : null;
    return s && s.user ? s.user : null;
  }

  /* ----------  DB QUERIES  ---------- */

  // Public: only available donors (for home page search)
  function fetchAvailableDonors(city, group, cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client"), []); return; }

    var q = client
      .from("donors")
      .select("id, full_name, blood_group, city, phone, email, available, created_at, user_id")
      .eq("available", true);

    if (group) q = q.eq("blood_group", group);
    if (city)  q = q.ilike("city", "%" + city + "%");

    q.order("created_at", { ascending: true })
     .then(function (res) {
       if (res.error) { cb(res.error, []); return; }
       // Stable sort: rare blood groups first
       var rank = { "O-": 1, "AB-": 2, "A-": 3, "B-": 4, "AB+": 5, "O+": 6, "A+": 7, "B+": 8 };
       var list = (res.data || []).slice().sort(function (a, b) {
         var ra = rank[a.blood_group] || 9, rb = rank[b.blood_group] || 9;
         if (ra !== rb) return ra - rb;
         return (a.full_name || "").localeCompare(b.full_name || "");
       });
       cb(null, list);
     })
     .catch(function (err) { cb(err, []); });
  }

  // Authenticated: all donors (for admin table + user stats)
  function fetchAllDonors(cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client"), []); return; }
    client
      .from("donors")
      .select("id, full_name, blood_group, city, phone, email, available, created_at, user_id")
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { cb(res.error, []); return; }
        cb(null, res.data || []);
      })
      .catch(function (err) { cb(err, []); });
  }

  // Fetch the donor row that belongs to the currently authenticated user.
  function fetchMyDonorRow(cb) {
    var client = window.BD_SUPABASE;
    var user = currentAuthUser();
    if (!client || !user) { cb(new Error("no-session"), null); return; }
    client
      .from("donors")
      .select("id, full_name, blood_group, city, phone, email, available, created_at, user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(function (res) {
        if (res.error) { cb(res.error, null); return; }
        cb(null, res.data);
      })
      .catch(function (err) { cb(err, null); });
  }

  function toggleAvailability(id, currentVal, cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client"), null); return; }
    client
      .from("donors")
      .update({ available: !currentVal })
      .eq("id", id)
      .then(function (res) {
        if (res.error) { cb(res.error, null); return; }
        cb(null, res.data && res.data[0] ? res.data[0] : { available: !currentVal });
      })
      .catch(function (err) { cb(err, null); });
  }

  function deleteDonor(id, cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client")); return; }
    client
      .from("donors")
      .delete()
      .eq("id", id)
      .then(function (res) { cb(res.error); })
      .catch(function (err) { cb(err); });
  }

  /* ----------  AUTH ACTIONS  ---------- */

  function signUpDonor(payload, cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client")); return; }

    var name  = (payload.name || "").trim();
    var email = (payload.email || "").trim().toLowerCase();
    var pass  = payload.password || "";
    var group = (payload.bloodGroup || "").trim();
    var city  = (payload.city || "").trim();
    var phone = (payload.phone || "").trim();

    if (!name)            return cb({ message: "Full name is required." });
    if (!group)           return cb({ message: "Please select a blood group." });
    if (!city)            return cb({ message: "City is required." });
    if (!phone)           return cb({ message: "Phone number is required." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                          return cb({ message: "Please enter a valid email address." });
    if (pass.length < 6)  return cb({ message: "Password must be at least 6 characters." });

    // 1. Create the auth user. Supabase auto-confirms email by default in
    //    new projects, so the user is immediately able to log in.
    client.auth.signUp({ email: email, password: pass })
      .then(function (res) {
        if (res.error) {
          cb({ message: friendlyAuthError(res.error) });
          return;
        }
        var user = res.data && res.data.user;
        if (!user) {
          // Email confirmation is required - tell the user to confirm first.
          cb({
            message: "Account created! Please check your email inbox and click the confirmation link, then log in."
          });
          return;
        }
        // 2. Insert the donor profile row, linked to this auth user.
        client.from("donors").insert({
          user_id: user.id,
          full_name: name,
          blood_group: group,
          city: city,
          phone: phone,
          email: email,
          available: true
        }).then(function (ins) {
          if (ins.error) {
            // Most likely cause: duplicate email (auth user was created but
            // donor row insert violated unique constraint).
            cb({ message: "Sign-up failed: " + friendlyDbError(ins.error) });
            return;
          }
          cb(null, { user: user, email: email });
        }).catch(function (err) {
          cb({ message: "Sign-up failed: " + (err.message || "unknown error") });
        });
      })
      .catch(function (err) { cb({ message: err.message || "Sign-up failed." }); });
  }

  function loginDonor(email, password, cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(new Error("no-client")); return; }
    client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) { cb({ message: friendlyAuthError(res.error) }); return; }
        cb(null, res.data && res.data.user ? res.data.user : null);
      })
      .catch(function (err) { cb({ message: err.message || "Login failed." }); });
  }

  function loginAdmin(email, password, cb) {
    if (!isAdminEmail(email)) {
      cb({ message: "Unknown admin email. Use admin@blood.com" });
      return;
    }
    loginDonor(email, password, function (err, user) {
      if (err) { cb(err); return; }
      cb(null, user);
    });
  }

  function signOut(cb) {
    var client = window.BD_SUPABASE;
    if (!client) { cb(); return; }
    client.auth.signOut()
      .then(function () { cb(); })
      .catch(function () { cb(); });
  }

  /* ----------  Friendly error translators  ---------- */
  function friendlyAuthError(err) {
    var msg = (err && (err.message || err.error_description || err.msg)) || "";
    msg = String(msg).toLowerCase();
    if (msg.indexOf("invalid login credentials") !== -1)
      return "Incorrect email or password. Please try again.";
    if (msg.indexOf("email not confirmed") !== -1)
      return "Please confirm your email first (check your inbox for the confirmation link).";
    if (msg.indexOf("user already registered") !== -1)
      return "An account with this email already exists. Please log in.";
    if (msg.indexOf("password should be at least") !== -1)
      return "Password must be at least 6 characters.";
    if (msg.indexOf("rate limit") !== -1)
      return "Too many attempts. Please wait a minute and try again.";
    return msg || "Authentication failed. Please try again.";
  }
  function friendlyDbError(err) {
    var msg = (err && (err.message || err.msg)) || "database error";
    if (msg.indexOf("duplicate key") !== -1 && msg.indexOf("email") !== -1)
      return "An account with this email already exists.";
    return msg;
  }

  /* =====================================================================
     PAGE: HOME (index.html)
     ===================================================================== */
  function initHome() {
    var form      = $("#filterForm");
    var cityInput = $("#filterCity");
    var groupSel  = $("#filterBlood");
    var grid      = $("#donorGrid");
    var countEl   = $("#resultCount");
    var clearBtn  = $("#clearFilters");
    if (!form) return;

    // populate the blood-group dropdown
    if (groupSel && !groupSel.dataset.populated) {
      BLOOD_GROUPS.forEach(function (g) {
        var o = document.createElement("option");
        o.value = g; o.textContent = g;
        groupSel.appendChild(o);
      });
      groupSel.dataset.populated = "1";
    }

    function showLoading() {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' +
          '<div class="emoji">⏳</div>' +
          '<h3>Loading donors…</h3>' +
          '<p>Fetching the latest available donors from the database.</p>' +
        '</div>';
    }

    function render() {
      var city  = (cityInput.value || "").trim();
      var group = (groupSel.value || "").trim();

      showLoading();
      fetchAvailableDonors(city, group, function (err, list) {
        if (err) {
          grid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1">' +
              '<div class="emoji">⚠️</div>' +
              '<h3>Could not load donors</h3>' +
              '<p>' + escapeHtml(err.message || "Please check your Supabase setup.") + '</p>' +
            '</div>';
          countEl.textContent = "0 available donors";
          return;
        }

        countEl.textContent = list.length + " available donor" + (list.length === 1 ? "" : "s");

        if (list.length === 0) {
          grid.innerHTML =
            '<div class="empty-state" style="grid-column:1/-1">' +
              '<div class="emoji">🩸</div>' +
              '<h3>No matching donors found</h3>' +
              '<p>Try a different city or blood group, or check back soon as new donors register.</p>' +
            '</div>';
          return;
        }

        grid.innerHTML = list.map(function (d) {
          return (
            '<article class="donor-card">' +
              '<div class="donor-card__top">' +
                '<div class="avatar">' + escapeHtml(initials(d.full_name)) + '</div>' +
                '<div>' +
                  '<div class="donor-name">' + escapeHtml(d.full_name) + '</div>' +
                  '<div class="donor-meta">Joined ' + escapeHtml(formatDate(d.created_at)) + '</div>' +
                '</div>' +
                '<span class="blood-badge">' + escapeHtml(d.blood_group) + '</span>' +
              '</div>' +
              '<div class="donor-card__info">' +
                '<div class="info-item"><span class="lbl">City</span><span class="val">' + escapeHtml(d.city) + '</span></div>' +
                '<div class="info-item"><span class="lbl">Phone</span><span class="val">' + escapeHtml(d.phone) + '</span></div>' +
              '</div>' +
              '<div class="donor-card__foot">' +
                '<span class="status-pill available">● Available</span>' +
                '<a class="btn btn--primary btn--sm" href="tel:' + escapeHtml(d.phone) + '">📞 Call Now</a>' +
              '</div>' +
            '</article>'
          );
        }).join("");
      });
    }

    form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
    cityInput.addEventListener("input", render);
    groupSel.addEventListener("change", render);
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        cityInput.value = ""; groupSel.value = ""; render();
      });
    }
    render();
  }

  /* =====================================================================
     PAGE: LOGIN (login.html)
     ===================================================================== */
  function initLogin() {
    var tabs = $all(".tab-btn");
    var panes = $all(".tab-pane");
    if (!tabs.length) return;

    function activate(idx) {
      tabs.forEach(function (t, i)  { t.classList.toggle("active", i === idx); });
      panes.forEach(function (p, i) { p.classList.toggle("active", i === idx); });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { activate(i); });
    });

    // If already logged in, go to dashboard
    var client = window.BD_SUPABASE;
    if (client) {
      client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) {
          window.location.replace("dashboard.html");
        }
      });
    }

    /* ----- User login ----- */
    var userForm = $("#userLoginForm");
    if (userForm) {
      userForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = $("#uEmail").value;
        var pass  = $("#uPass").value;
        loginDonor(email, pass, function (err) {
          if (err) { showAlert(userForm, err.message, "error"); return; }
          showAlert(userForm, "Welcome back! Redirecting…", "success");
          setTimeout(function () { window.location.href = "dashboard.html"; }, 600);
        });
      });
    }

    /* ----- Donor sign-up ----- */
    var signupForm = $("#signupForm");
    if (signupForm) {
      var sg = $("#suBlood");
      if (sg && !sg.dataset.populated) {
        BLOOD_GROUPS.forEach(function (g) {
          var o = document.createElement("option");
          o.value = g; o.textContent = g;
          sg.appendChild(o);
        });
        sg.dataset.populated = "1";
      }
      signupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = signupForm.querySelector("button[type=submit]");
        if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
        signUpDonor({
          name:  $("#suName").value,
          bloodGroup: $("#suBlood").value,
          city:  $("#suCity").value,
          phone: $("#suPhone").value,
          email: $("#suEmail").value,
          password: $("#suPass").value
        }, function (err) {
          if (btn) { btn.disabled = false; btn.textContent = "Create Donor Account"; }
          if (err) { showAlert(signupForm, err.message, "error"); return; }
          showAlert(signupForm, "Account created! Redirecting to your dashboard…", "success");
          setTimeout(function () { window.location.href = "dashboard.html"; }, 700);
        });
      });
    }

    /* ----- Admin login ----- */
    var adminForm = $("#adminLoginForm");
    if (adminForm) {
      adminForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = $("#aEmail").value;
        var pass  = $("#aPass").value;
        loginAdmin(email, pass, function (err) {
          if (err) { showAlert(adminForm, err.message, "error"); return; }
          showAlert(adminForm, "Admin authenticated. Loading control panel…", "success");
          setTimeout(function () { window.location.href = "dashboard.html"; }, 600);
        });
      });
    }
  }

  /* =====================================================================
     PAGE: DASHBOARD (dashboard.html)
     ===================================================================== */
  function initDashboard() {
    if (!document.getElementById("userArea") && !document.getElementById("adminArea")) return;
    var client = window.BD_SUPABASE;
    if (!client) { window.location.replace("login.html"); return; }

    client.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) { window.location.replace("login.html"); return; }

      var user = session.user;
      var admin = isAdminEmail(user.email);

      if (admin) {
        $("#userArea").classList.add("hidden");
        $("#adminArea").classList.remove("hidden");
        renderNavbar(true, user.email);
        renderAdmin();
      } else {
        $("#userArea").classList.remove("hidden");
        $("#adminArea").classList.add("hidden");
        renderNavbar(false, user.email);
        renderUserProfile();
      }
    });
  }

  function renderNavbar(isAdmin, email) {
    var navGreet = $("#navGreet");
    var navAuth  = $("#navAuth");
    if (navGreet) navGreet.textContent = isAdmin ? "Admin" : "Donor";
    if (navAuth) {
      navAuth.innerHTML =
        '<a href="dashboard.html" class="active">Dashboard</a>' +
        '<button data-logout type="button" class="btn btn--outline-red btn--sm">Logout</button>';
      $all("[data-logout]", navAuth).forEach(function (b) {
        b.addEventListener("click", function () {
          signOut(function () {
            toast("You have been logged out.", "info");
            setTimeout(function () { window.location.href = "index.html"; }, 400);
          });
        });
      });
    }
    var title    = $("#dashTitle");
    var subtitle = $("#dashSubtitle");
    if (title)    title.textContent    = isAdmin ? "Admin Control Panel" : "Loading dashboard…";
    if (subtitle) subtitle.textContent = isAdmin
      ? "Full oversight of all registered donors."
      : "Manage your donor profile and availability.";
  }

  function renderUserProfile() {
    var card = $("#profileCard");
    fetchMyDonorRow(function (err, donor) {
      if (err || !donor) {
        // Self-heal: if auth user exists but donor row is missing (e.g. a
        // previous sign-up failed after creating the auth user), show a
        // "Complete your profile" form so they can finish setup without
        // needing to contact support.
        var user = currentAuthUser();
        if (card) card.innerHTML =
          '<div class="empty-state"><div class="emoji">📝</div>' +
          '<h3>Complete your donor profile</h3>' +
          '<p>Your account exists but your donor profile is not set up yet. ' +
          'Fill in the details below to start appearing in search results.</p>' +
          '<div class="complete-form" style="max-width:480px;margin:1.2rem auto 0;text-align:left">' +
            '<div class="field"><label>Full Name</label>' +
              '<input class="input" id="cpName" placeholder="Your full name" value="' +
              escapeHtml(user && user.email ? user.email.split("@")[0] : "") + '"></div>' +
            '<div class="field"><label>Blood Group</label>' +
              '<select class="input" id="cpGroup">' +
                '<option value="">Select…</option>' +
                ["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(function (g) {
                  return '<option value="' + g + '">' + g + '</option>';
                }).join("") +
              '</select></div>' +
            '<div class="field"><label>City</label>' +
              '<input class="input" id="cpCity" placeholder="e.g. Mumbai"></div>' +
            '<div class="field"><label>Phone Number</label>' +
              '<input class="input" id="cpPhone" placeholder="+91-98765-43210"></div>' +
            '<button class="btn btn--green btn--block" id="cpSave">Save & Continue</button>' +
          '</div></div>';

        var saveBtn = $("#cpSave");
        if (saveBtn) {
          saveBtn.addEventListener("click", function () {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving…";
            var payload = {
              user_id: user && user.id,
              full_name: ($("#cpName").value || "").trim(),
              blood_group: ($("#cpGroup").value || "").trim(),
              city: ($("#cpCity").value || "").trim(),
              phone: ($("#cpPhone").value || "").trim(),
              email: user && user.email,
              available: true
            };
            if (!payload.full_name || !payload.blood_group || !payload.city || !payload.phone) {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save & Continue";
              toast("Please fill in all fields.", "error");
              return;
            }
            var client = window.BD_SUPABASE;
            client.from("donors").insert(payload).then(function (res) {
              if (res.error) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save & Continue";
                toast("Could not save: " + (res.error.message || "error"), "error");
                return;
              }
              toast("Profile created! Welcome aboard 🎉", "success");
              renderUserProfile(); // reload with the new row
            }).catch(function () {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save & Continue";
              toast("Network error. Try again.", "error");
            });
          });
        }
        return;
      }
      var title = $("#dashTitle");
      if (title) title.textContent = "Welcome, " + donor.full_name.split(" ")[0];
      var sub = $("#dashSubtitle");
      if (sub) sub.textContent =
        "Manage your donor profile and availability · " + donor.blood_group + " · " + donor.city;

      // user stats
      fetchAllDonors(function (e2, all) {
        if (e2) all = [];
        var total = all.length;
        var avail = all.filter(function (d) { return d.available; }).length;
        var sameCity = all.filter(function (d) {
          return d.city.toLowerCase() === donor.city.toLowerCase();
        }).length;
        var t = $("#userStatTotal");  if (t) t.textContent = total;
        var a = $("#userStatAvail");  if (a) a.textContent = avail;
        var c = $("#userStatCity");   if (c) c.textContent = sameCity;
      });

      card.innerHTML =
        '<div class="avatar">' + escapeHtml(initials(donor.full_name)) + '</div>' +
        '<h3>' + escapeHtml(donor.full_name) + '</h3>' +
        '<div class="donor-meta">' + escapeHtml(maskEmail(donor.email)) + '</div>' +
        '<span class="blood-badge">' + escapeHtml(donor.blood_group) + '</span>' +
        '<div class="info-list">' +
          '<div class="row"><span class="lbl">City</span><span class="val">' + escapeHtml(donor.city) + '</span></div>' +
          '<div class="row"><span class="lbl">Phone</span><span class="val">' + escapeHtml(donor.phone) + '</span></div>' +
          '<div class="row"><span class="lbl">Status</span><span class="val" id="statusVal">' +
            (donor.available ? "Available" : "Unavailable") + '</span></div>' +
          '<div class="row"><span class="lbl">Member since</span><span class="val">' +
            escapeHtml(formatDate(donor.created_at)) + '</span></div>' +
        '</div>' +
        '<div class="toggle-wrap">' +
          '<button id="toggleAvail" class="btn btn--block ' +
            (donor.available ? "btn--amber" : "btn--green") + '">' +
            (donor.available ? "⏸ Set Unavailable" : "✓ Set Available") +
          '</button>' +
        '</div>';

      var toggleBtn = $("#toggleAvail");
      toggleBtn.addEventListener("click", function () {
        toggleBtn.disabled = true;
        toggleAvailability(donor.id, donor.available, function (e3, updated) {
          toggleBtn.disabled = false;
          if (e3) { toast("Could not update status: " + (e3.message || "error"), "error"); return; }
          donor.available = updated.available;
          var statusVal = $("#statusVal");
          if (statusVal) statusVal.textContent = updated.available ? "Available" : "Unavailable";
          toggleBtn.className = "btn btn--block " + (updated.available ? "btn--amber" : "btn--green");
          toggleBtn.textContent = updated.available ? "⏸ Set Unavailable" : "✓ Set Available";
          toast("You are now " + (updated.available ? "Available" : "Unavailable") + " on the portal.",
                updated.available ? "success" : "info");
        });
      });
    });
  }

  function renderAdmin() {
    var tbody = $("#adminTableBody");
    var totalEl  = $("#statTotal");
    var availEl  = $("#statAvail");
    var citiesEl = $("#statCities");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:30px;color:#8d90a3">' +
        '⏳ Loading donors…</td></tr>';

    fetchAllDonors(function (err, list) {
      if (err) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="text-align:center;padding:30px;color:#d90429">' +
            '⚠ Could not load donors: ' + escapeHtml(err.message || "error") + '</td></tr>';
        return;
      }
      var total  = list.length;
      var avail  = list.filter(function (d) { return d.available; }).length;
      var cities = {};
      list.forEach(function (d) { cities[d.city] = true; });
      if (totalEl)  totalEl.textContent  = total;
      if (availEl)  availEl.textContent  = avail;
      if (citiesEl) citiesEl.textContent = Object.keys(cities).length;

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#8d90a3">' +
          'No donors registered yet.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(function (d, i) {
        return (
          '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + escapeHtml(d.full_name) + '</td>' +
            '<td><span class="table-badge">' + escapeHtml(d.blood_group) + '</span></td>' +
            '<td>' + escapeHtml(d.city) + '</td>' +
            '<td>' + escapeHtml(d.phone) + '</td>' +
            '<td><span class="status-pill ' + (d.available ? "available" : "unavailable") + '">' +
              (d.available ? "Available" : "Unavailable") +
            '</span></td>' +
            '<td><button class="btn btn--outline-red btn--sm" data-del="' + d.id + '">Delete</button></td>' +
          '</tr>'
        );
      }).join("");

      $all("[data-del]", tbody).forEach(function (btn) {
        btn.addEventListener("click", function () {
          openConfirm(function () {
            btn.disabled = true; btn.textContent = "Deleting…";
            deleteDonor(btn.getAttribute("data-del"), function (e) {
              if (e) {
                btn.disabled = false; btn.textContent = "Delete";
                toast("Could not delete: " + (e.message || "error"), "error");
                return;
              }
              toast("Donor record deleted.", "success");
              renderAdmin();
            });
          });
        });
      });
    });
  }

  function openConfirm(onYes) {
    var backdrop = $("#confirmModal");
    if (!backdrop) { if (confirm("Are you sure?")) onYes(); return; }
    backdrop.classList.add("open");
    var yes = $("#confirmYes", backdrop);
    var no  = $("#confirmNo",  backdrop);
    function close() {
      backdrop.classList.remove("open");
      yes.removeEventListener("click", onYesHandler);
      no.removeEventListener("click", onNoHandler);
    }
    function onYesHandler() { close(); onYes(); }
    function onNoHandler()  { close(); }
    yes.addEventListener("click", onYesHandler);
    no.addEventListener("click",  onNoHandler);
  }

  /* =====================================================================
     SHARED: mobile nav + navbar greeting on every page
     ===================================================================== */
  function initNav() {
    var toggle = $(".nav-toggle");
    var links  = $(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", function () { links.classList.toggle("open"); });
      $all("a", links).forEach(function (a) {
        a.addEventListener("click", function () { links.classList.remove("open"); });
      });
    }

    // Personalize the navbar based on auth state
    var navGreet = $("#navGreet");
    var navAuth  = $("#navAuth");
    if (!navGreet || !navAuth) return;
    if (!window.BD_SUPABASE) {
      navGreet.textContent = "Guest";
      navAuth.innerHTML =
        '<a href="login.html">Sign In</a>' +
        '<a href="login.html#signup" class="btn btn--primary btn--sm">Register</a>';
      return;
    }
    window.BD_SUPABASE.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && session.user) {
        var email = session.user.email;
        var isAdmin = isAdminEmail(email);
        navGreet.textContent = isAdmin ? "Admin" : "Donor";
        navAuth.innerHTML =
          '<a href="dashboard.html">Dashboard</a>' +
          '<button data-logout type="button" class="btn btn--outline-red btn--sm">Logout</button>';
      } else {
        navGreet.textContent = "Guest";
        navAuth.innerHTML =
          '<a href="login.html">Sign In</a>' +
          '<a href="login.html#signup" class="btn btn--primary btn--sm">Register</a>';
      }
      $all("[data-logout]", navAuth).forEach(function (b) {
        b.addEventListener("click", function () {
          signOut(function () {
            toast("You have been logged out.", "info");
            setTimeout(function () { window.location.href = "index.html"; }, 400);
          });
        });
      });
    });

    // Deep-link to a specific tab on login.html
    if (location.pathname.indexOf("login.html") !== -1) {
      var hash = location.hash.replace("#", "");
      if (hash === "signup" || hash === "admin" || hash === "user") {
        var idx = { user: 0, signup: 1, admin: 2 }[hash];
        var tabs = $all(".tab-btn");
        if (tabs[idx]) tabs[idx].click();
      }
    }
  }

  /* =====================================================================
     BOOTSTRAP
     ===================================================================== */
  document.addEventListener("DOMContentLoaded", function () {
    // Step 1: is config.js even filled in?
    if (!CFG || !CFG.isConfigured || !CFG.isConfigured()) {
      showFatalError(
        "config.js is not set up yet. Open config.js and paste your Supabase URL + anon key. " +
        "Follow README.md for the 3-minute setup."
      );
    }
    // Step 2: load the Supabase library, then create the client, then init pages.
    ensureSupabaseLib(function () {
      loadSupabaseClient(function () {
        initNav();
        initHome();
        initLogin();
        initDashboard();
      });
    });
  });

  /* ----------  Optional debug surface  ---------- */
  window.BloodDonorPortal = {
    signOut: signOut,
    fetchAllDonors: fetchAllDonors,
    fetchAvailableDonors: fetchAvailableDonors,
    isAdminEmail: isAdminEmail
  };
})();
