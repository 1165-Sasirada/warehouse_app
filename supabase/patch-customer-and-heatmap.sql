-- ============================================================
-- Patch: customer role + heatmap grant fix + heatmap backfill
-- Run in Supabase SQL Editor, top to bottom, once.
-- ============================================================

-- 1. Widen the role check constraint to allow 'customer'.
-- If this errors with "constraint does not exist", find the real
-- name via: select conname from pg_constraint where conrelid =
-- 'public.users'::regclass; then substitute it below.
alter table public.users drop constraint users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('picker', 'manager', 'customer'));

-- 2. Grant UPDATE on location_heatmaps to authenticated — this was
-- missing, which is why heatmap increments would fail even once the
-- app code tries to write them.
grant update on public.location_heatmaps to authenticated;

-- 3. Backfill a heatmap row (pick_count = 0) for every existing
-- location, so the app only ever needs UPDATE, never INSERT, during
-- normal picking — simpler than also granting + policy-ing INSERT.
insert into public.location_heatmaps (location_id, pick_count)
select id, 0 from public.locations
on conflict (location_id) do nothing;

-- ============================================================
-- 4. OPTIONAL but recommended: restrict customers to their own
-- orders at the database level, not just in the UI query. Without
-- this, the existing "Authenticated can read orders" policy (using
-- (true)) still lets a customer query other customers' orders via
-- the API directly, even though the UI only shows their own.
-- ============================================================
drop policy if exists "Authenticated can read orders" on public.orders;

create policy "Staff can read all orders, customers read their own"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('picker', 'manager')
    )
    or user_id = auth.uid()
  );
