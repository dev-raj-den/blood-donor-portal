-- ==========================================================================
-- Blood Donor Portal - RLS Policy Fix
-- --------------------------------------------------------------------------
-- Run this in: Supabase Dashboard > SQL Editor > New query > RUN
--
-- WHAT THIS DOES: Replaces the old RLS policies (which used the now-
-- deprecated `select email from auth.users` pattern) with modern policies
-- that use auth.jwt() ->> 'email'. This fixes the "new row violates row-
-- level security policy for table donors" error during sign-up.
--
-- Safe to run multiple times.
-- ==========================================================================

-- Make sure RLS is enabled
alter table public.donors enable row level security;

-- Public can read available donors (home page search)
drop policy if exists "Public read available donors" on public.donors;
create policy "Public read available donors"
  on public.donors for select
  to anon, authenticated
  using (available = true);

-- Authenticated users can read ALL donors (admin table + stats)
drop policy if exists "Authenticated read all donors" on public.donors;
create policy "Authenticated read all donors"
  on public.donors for select
  to authenticated
  using (true);

-- A user can insert their own donor row (during sign-up)
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

-- Done. You should see "Success. No rows returned."
