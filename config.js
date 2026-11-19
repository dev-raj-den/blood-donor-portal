/* ==========================================================================
   Blood Donor Finder Portal - Production Configuration
   --------------------------------------------------------------------------
   This file holds your Supabase project credentials. Supabase is a free,
   hosted PostgreSQL database + authentication service that replaces the
   browser-only localStorage approach so ALL visitors see the SAME donors
   and the same live data.

   HOW TO GET THESE TWO VALUES  (takes 3 minutes, completely free):
   --------------------------------------------------------------------------
   1. Go to  https://supabase.com  and sign in (Google / GitHub login works).
   2. Click "New project". Pick any name (e.g. "blood-donor-portal").
      Choose a strong Database Password and SAVE it somewhere safe
      (you will not need it in code, only for the Supabase dashboard).
      Pick the region closest to you. Click "Create new project".
   3. Wait ~2 minutes while Supabase provisions the database.
   4. In the left sidebar of your project, click the "Settings" gear icon,
      then "API". You will see three important values:
         - Project URL          ->  paste below as SUPABASE_URL
         - anon public API key  ->  paste below as SUPABASE_ANON_KEY
   5. Save this file. Open the SQL Editor in Supabase, paste the contents
      of schema.sql (from this project) and click "RUN".
   6. Done! Just open index.html or deploy the folder to Netlify.

   IMPORTANT - SECURITY NOTES:
   - The "anon" key is SAFE to expose in frontend JavaScript. It is designed
     to be public. Real security comes from Row Level Security (RLS)
     policies defined in schema.sql, which we set up for you.
   - Never put the "service_role" key in frontend code. Only the anon key.
   - After pasting your real values, remove the demo placeholder values.
   ========================================================================== */

// ✅  CONFIGURED — your real Supabase credentials are below.
// (If you ever need to find these again: Supabase Dashboard → Settings → API)
const SUPABASE_URL = "https://bicsubpindpzviiyanxs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpY3N1YnBpbmRwenZpaXlhbnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNDA1NDIsImV4cCI6MjExMDYxNjU0Mn0.T5oA4LgplWTeJafIp6CODQ-mXkXjyhl9HVTMTtLslBg";

// Admin email(s) - anyone logging in with this email gets admin powers.
// The account must first be created through normal donor sign-up, OR you
// can create it manually in Supabase Dashboard > Authentication > Users.
const ADMIN_EMAILS = ["admin@blood.com"];

// Don't touch this export - it is read by script.js on every page load.
window.BLOOD_PORTAL_CONFIG = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  adminEmails: ADMIN_EMAILS,
  isConfigured: function () {
    return (
      this.supabaseUrl &&
      this.supabaseUrl.indexOf("YOUR-PROJECT-REF") === -1 &&
      this.supabaseAnonKey &&
      this.supabaseAnonKey.indexOf("PASTE-YOUR") === -1
    );
  }
};
