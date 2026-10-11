-- ============================================================
-- Patch: separate "who placed the order" from "who fulfilled it"
-- Run in the Supabase SQL Editor, top to bottom, then deploy the
-- matching frontend code (History, Order Status, Create Order).
--
--   orders.customer_id = the person who placed the order
--   orders.user_id     = the employee (picker/manager) who fulfilled it
-- ============================================================

-- 0. Helper: is the current user a picker/manager?
-- SECURITY DEFINER so policies can call it without recursing into
-- the users table's own RLS.
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('picker', 'manager')
  );
$$;
grant execute on function public.is_staff() to authenticated;

-- 1. New column
alter table public.orders
  add column if not exists customer_id uuid references public.users(id);

-- 2. Backfill: orders whose user_id points at a customer were placed
-- by that customer.
update public.orders o
set customer_id = o.user_id
from public.users u
where u.id = o.user_id
  and u.role = 'customer'
  and o.customer_id is null;

-- 3. user_id now means "employee who fulfilled it", so clear it where
-- it was holding a customer.
update public.orders o
set user_id = null
from public.users u
where u.id = o.user_id
  and u.role = 'customer';

-- 4. Repair the test order whose owner was overwritten by the picker.
update public.orders
set customer_id = (select id from public.users where email = 'customer@example.com')
where order_number = 'ORD-20261011-222610';

-- 5. Read policy: staff see every order, customers see only the ones
-- they placed.
drop policy if exists "Authenticated can read orders" on public.orders;
drop policy if exists "Staff can read all orders, customers read their own" on public.orders;

create policy "Staff can read all orders, customers read their own"
  on public.orders for select
  to authenticated
  using (public.is_staff() or customer_id = auth.uid());

-- 6. OPTIONAL: let staff read every profile, so History can show the
-- employee name on orders handled by someone else. (Today a user can
-- only read their own row, so other people's names come back empty.)
drop policy if exists "Staff can read all profiles" on public.users;

create policy "Staff can read all profiles"
  on public.users for select
  to authenticated
  using (public.is_staff());

-- Make PostgREST pick up the new column right away.
notify pgrst, 'reload schema';
