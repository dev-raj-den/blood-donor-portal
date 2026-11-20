-- ==========================================================================
-- Blood Donor Finder Portal - Database Schema
-- Run this in: Supabase Dashboard > SQL Editor > New query > RUN
-- ==========================================================================

-- 0. CLEAN RESET ---------------------------------------------------------
-- If you re-run this file (e.g. after fixing an error), this drops the old
-- table first so nothing conflicts. Safe to run multiple times.
drop table if exists public.donors cascade;

-- 1. DONORS TABLE ----------------------------------------------------------
-- Each row = one registered donor. Mirrors auth.users for the email but
-- holds all the public-profile data the portal needs.
create table if not exists public.donors (
  id           uuid primary key default gen_random_uuid(),
  -- Supabase Auth user id, so we can join donors <-> auth.users
  user_id      uuid references auth.users (id) on delete cascade,
  full_name    text        not null,
  blood_group  text        not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  city         text        not null,
  phone        text        not null,
  email        text        not null unique,
  available    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists donors_available_idx     on public.donors (available);
create index if not exists donors_city_idx          on public.donors (lower(city));
create index if not exists donors_blood_group_idx   on public.donors (blood_group);

-- 2. ROW LEVEL SECURITY ----------------------------------------------------
-- The anon key is public, so we lock down every row with policies.
-- Rules:
--   * Anyone (even anonymous visitors) can READ available donors for search.
--   * A logged-in user can read ALL donors (so the admin table works and
--     a donor can see totals) but they cannot read other donors' passwords
--     (passwords are stored in auth.users, never in this table).
--   * A logged-in user can INSERT their own donor row.
--   * A logged-in user can UPDATE only their own row (availability toggle,
--     profile edits).
--   * Only ADMIN emails can DELETE any donor row.

alter table public.donors enable row level security;

-- Public can read available donors (home page search)
drop policy if exists "Public read available donors" on public.donors;
create policy "Public read available donors"
  on public.donors for select
  to anon, authenticated
  using (available = true);

-- Authenticated users can read ALL donors (needed for admin table + stats)
drop policy if exists "Authenticated read all donors" on public.donors;
create policy "Authenticated read all donors"
  on public.donors for select
  to authenticated
  using (true);

-- A user can insert their own donor row (during sign-up)
-- NOTE: uses auth.jwt() instead of querying auth.users (which Supabase
-- deprecated for use inside RLS policies).
drop policy if exists "Users insert own donor row" on public.donors;
create policy "Users insert own donor row"
  on public.donors for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and email = (auth.jwt() ->> 'email')
  );

-- A user can update only their own row (availability toggle, profile edit)
drop policy if exists "Users update own row" on public.donors;
create policy "Users update own row"
  on public.donors for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only admin emails can delete a donor row
drop policy if exists "Admins delete any donor" on public.donors;
create policy "Admins delete any donor"
  on public.donors for delete
  to authenticated
  using (
    (auth.jwt() ->> 'email') in ('admin@blood.com')
  );

-- 3. AUTO-LINK TRIGGER -----------------------------------------------------
-- When a new user signs up through Supabase Auth, we want a matching donor
-- row created automatically ONLY IF they came through the donor sign-up
-- flow. We handle the donor insert from the frontend instead (because the
-- sign-up form carries blood_group, city, phone that Auth itself doesn't
-- store), so no auto-trigger is needed. The frontend will insert into
-- public.donors right after sign-up returns a session.

-- 4. SEED DATA -------------------------------------------------------------
-- Creates 5 demo donors so the portal looks alive on first launch.
-- NOTE: these rows do NOT have auth.users accounts (they are pure public
-- data), so they will show up in search but cannot be logged into. To make
-- them login-able, create matching auth users in Supabase Dashboard >
-- Authentication > Users > "Add user" using the same emails.

insert into public.donors (full_name, blood_group, city, phone, email, available, created_at)
select * from (values
  ('Dr. Aisha Khan'::text,  'O-'::text,  'Mumbai'::text,    '+91-98765-43210'::text, 'aisha.khan@example.com'::text,  true::boolean,  '2025-09-12T09:30:00Z'::timestamptz),
  ('Rajesh Kumar'::text,    'A+'::text,  'Delhi'::text,     '+91-99876-54321'::text, 'rajesh.kumar@example.com'::text, true::boolean,  '2025-09-15T11:00:00Z'::timestamptz),
  ('Priya Sharma'::text,    'B+'::text,  'Bengaluru'::text, '+91-98112-34567'::text, 'priya.sharma@example.com'::text, false::boolean, '2025-09-18T14:45:00Z'::timestamptz),
  ('Vikram Reddy'::text,    'AB+'::text, 'Hyderabad'::text, '+91-99123-45678'::text, 'vikram.reddy@example.com'::text, true::boolean,  '2025-10-02T08:15:00Z'::timestamptz),
  ('Sneha Iyer'::text,      'O+'::text,  'Chennai'::text,   '+91-98789-12345'::text, 'sneha.iyer@example.com'::text,  true::boolean,  '2025-10-08T16:20:00Z'::timestamptz)
) as t(full_name, blood_group, city, phone, email, available, created_at)
where not exists (select 1 from public.donors limit 1);

-- 5. (OPTIONAL) MAKE SEED DONORS LOGIN-ABLE -------------------------------
-- The demo donor aisha.khan@example.com / donor123 only works if you also
-- create that auth user. Easiest way:
--   Supabase Dashboard > Authentication > Users > "Add user"
--   Email:    aisha.khan@example.com
--   Password: donor123
--   Auto Confirm User: YES
-- Repeat for the other 4 seed donors if you want all of them login-able,
-- or just create one (aisha) for testing and register the rest through the
-- portal's Donor Sign-Up tab.

-- Done. You can now close SQL Editor and use the portal.
-- ==========================================================================
