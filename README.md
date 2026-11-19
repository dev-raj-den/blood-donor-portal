# 🩸 Blood Donor Finder Portal — Live / Production Version

A real, production-ready **Blood Donor Finder Portal** that runs on a real
backend (PostgreSQL database + secure authentication) — not just one
browser's localStorage. Anyone visiting your website sees the same live
list of donors, and donors can sign up, log in, and toggle their
availability from anywhere in the world.

Built with **pure HTML5 + CSS3 + Vanilla JavaScript** (no build step, no
npm install required) on the front-end, and **[Supabase](https://supabase.com)**
(free hosted PostgreSQL + Auth) on the back-end.

---

## 📁 Files in this folder

| File              | Purpose                                                       |
| ----------------- | ------------------------------------------------------------ |
| `index.html`      | Home page with hero + live donor search                      |
| `login.html`      | Tabbed authentication (User Login / Donor Sign Up / Admin)   |
| `dashboard.html`  | Donor profile + Admin control panel                          |
| `style.css`       | Shared responsive styling (medical theme)                    |
| `script.js`       | All app logic — talks to Supabase                            |
| `config.js`       | **You edit this** — paste your Supabase credentials here    |
| `schema.sql`      | **You run this once** in Supabase to create tables + policies |
| `README.md`       | This file — complete setup & deploy guide                    |

---

## 🚀 Total setup time: ~10 minutes

Three things only:

1. Create a free Supabase project + paste 2 keys into `config.js`
2. Run `schema.sql` once in the Supabase SQL editor
3. Upload the folder to Netlify (free) and get your live domain

---

## STEP 1 — Create the Supabase project (3 minutes, free)

1. Go to **<https://supabase.com>** and sign in with Google or GitHub.
2. Click **"New project"**.
3. Fill in:
   - **Name:** `blood-donor-portal` (any name is fine)
   - **Database Password:** make one up and **save it somewhere safe**
     (you only need it for the Supabase dashboard, never in code)
   - **Region:** pick the one closest to you
4. Click **"Create new project"** and wait ~2 minutes while it provisions.
5. When ready, in the left sidebar click the gear icon **→ Settings → API**.
6. You will see two values you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
7. Open **`config.js`** in a text editor (Notepad, VS Code, anything).
8. Replace the two placeholder lines:

   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "PASTE-YOUR-ANON-PUBLIC-KEY-HERE";
   ```

   with your real values, e.g.:

   ```js
   const SUPABASE_URL = "https://abcdefgh.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5...your-real-key...";
   ```

9. Save the file.

> 🔐 **Is it safe to put the anon key in frontend code?** YES. The "anon"
> key is designed to be public. Real security comes from **Row Level
> Security (RLS) policies**, which we set up for you in `schema.sql`.
> Never put the **`service_role`** key in frontend code — only the anon key.

---

## STEP 2 — Run the database schema (1 minute)

1. In your Supabase project dashboard, click **"SQL Editor"** in the left sidebar.
2. Click **"New query"**.
3. Open **`schema.sql`** from this folder in a text editor, copy **all** of it.
4. Paste it into the Supabase SQL editor.
5. Click the green **"Run"** button.
6. You should see "Success. No rows returned." — that means it worked.

This created:

- the `donors` table
- security policies (public can read available donors; users can edit only
  their own row; only admin can delete)
- 5 sample donors so the portal looks alive on first launch

---

## STEP 3 — Create the admin account (1 minute, optional but recommended)

The seed data includes sample donors but they don't have login passwords
yet (because passwords live in Supabase Auth, not in the donors table).
To make the admin account work:

1. In Supabase, click **"Authentication"** in the left sidebar.
2. Click the **"Users"** tab, then the **"Add user"** button.
3. Fill in:
   - **Email:** `admin@blood.com`
   - **Password:** `admin123`  (or any password you prefer — but then
     also update `ADMIN_EMAILS` in `config.js` if you change the email)
   - **Auto Confirm User:** ✅ **YES** (very important — otherwise login
     will fail until the user clicks the email link)
4. Click **"Create user"**.

You can repeat the same process for `aisha.khan@example.com` / `donor123`
if you want to log in as the demo donor too. Otherwise, just use the
**"Donor Sign Up"** tab on the website to register new donors.

---

## STEP 4 (optional but recommended) — Disable email confirmation

By default, Supabase requires new users to click a confirmation link in
their email before they can log in. For a demo / small portal you can turn
this off so sign-up logs the user in immediately:

1. Supabase Dashboard → **Authentication** → **"Providers"** tab.
2. Click **"Email"** to expand it.
3. Turn **OFF** the toggle "Confirm email".
4. Click **"Save**.

Now new donors can sign up and log in instantly, no email needed.

---

## STEP 5 — Run it locally (test before going live)

Easiest: just **double-click `index.html`** — it opens in your browser
and works (it talks to Supabase over the internet).

If you prefer a local server:

```
cd blood-donor-portal-live
python -m http.server 8000          # Python 3
#  or
python -m SimpleHTTPServer 8000     # Python 2.7
```

Then open <http://localhost:8000> in your browser.

You should see the home page with the 5 sample donors in the search
results. Try filtering by "Mumbai" or "O-".

---

## STEP 6 — Deploy to Netlify (free, get a real domain)

### Option A — Drag & drop (fastest, no Git needed)

1. Go to **<https://app.netlify.com/drop>**
2. Drag the entire `blood-donor-portal-live` folder onto the page.
3. Netlify gives you a live URL like
   `https://thrumming-llama-1234.netlify.app` in seconds. 🎉

### Option B — Connect a Git repo (for easy updates)

1. Push the folder to a GitHub repository.
2. Go to <https://app.netlify.com> → **"Add new site" → "Import an existing project"**.
3. Pick your repo. Build settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `.` (just a dot)
4. Click **"Deploy site"**.

### Add a custom domain (yours, free on Netlify)

1. In your Netlify site → **"Domain management" → "Add custom domain"**.
2. Enter your domain (e.g. `blooddonors.example.org`).
3. Netlify walks you through pointing your domain's DNS at Netlify.
4. Netlify issues a free SSL certificate automatically — your site is
   served over HTTPS within minutes.

---

## 🔑 Demo credentials (after STEP 3)

| Role   | Email                       | Password   |
| ------ | --------------------------- | ---------- |
| Admin  | `admin@blood.com`           | `admin123` |
| Donor  | (sign up via the website)  | (yours)    |

If you also created `aisha.khan@example.com` in STEP 3:

| Role  | Email                       | Password   |
| ----- | --------------------------- | ---------- |
| Donor | `aisha.khan@example.com`    | `donor123` |

---

## ✅ What works (all backed by the real database)

- **Home page:** Live search by City + Blood Group, populated from Supabase.
  Every visitor sees the SAME list — no more browser-only localStorage.
- **Donor Sign Up:** Creates a real auth account in Supabase + inserts a
  donor row. Duplicate emails are rejected. After sign-up you are logged
  in and redirected to the dashboard.
- **User Login:** Email + password authentication against Supabase Auth.
- **Admin Login:** Same flow, but only `admin@blood.com` (or whatever you
  set in `ADMIN_EMAILS`) is accepted.
- **User Dashboard:** Shows your profile (name, blood group, city, phone,
  status, member since), live stats, and an **Availability toggle** that
  updates the database — your card appears/disappears from the home page
  for everyone in real time.
- **Admin Dashboard:** Full table of every registered donor with stats,
  live search filter, and a **Delete** button (with confirmation modal).
- **Logout:** Ends the Supabase session on every device.
- **Security:** Row Level Security policies in the database enforce that
  - anyone can READ available donors
  - a logged-in user can only UPDATE their own row
  - only admin can DELETE donors
  - passwords are hashed by Supabase Auth, never stored in plain text

---

## 🐞 Troubleshooting

**"Setup needed: config.js is not set up yet." red banner at the top.**
You haven't pasted your Supabase URL + anon key into `config.js`. Follow
STEP 1 above.

**Home page shows "Could not load donors".**
Either you skipped STEP 2 (didn't run `schema.sql`), or your Supabase
project is paused. Log in to Supabase and check that the project is active
and the `donors` table exists (Table Editor → `donors`).

**Login says "Please confirm your email first".**
Supabase requires email confirmation by default. Either click the link in
your inbox, or disable email confirmation (STEP 4).

**"Could not update status" when toggling availability.**
Your user doesn't have a donor row linked to their auth account yet.
This happens if you created the auth user manually in Supabase (STEP 3)
but didn't add a matching row in the `donors` table. Easiest fix: sign up
a new donor through the website's Donor Sign Up tab — that flow creates
both the auth user and the donor row correctly.

**Admin can't delete donors ("Could not delete").**
Either you're not logged in as `admin@blood.com`, or the admin's email
isn't in the `ADMIN_EMAILS` array in `config.js`. Both must match.

**Netlify shows a blank page.**
Make sure you dragged the **`blood-donor-portal-live` folder's CONTENTS**
(not the parent folder). The file `index.html` must be at the root of
what you upload.

---

## 📞 Need help?

- Supabase docs: <https://supabase.com/docs>
- Netlify docs: <https://docs.netlify.com>

That's it — your portal is now live on the internet. 🩸❤️
