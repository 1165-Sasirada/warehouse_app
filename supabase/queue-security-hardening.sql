-- Apply after the queued-order application code is deployed.
-- Safe to rerun. Browser clients cannot change roles, bypass the order
-- queue/pick RPCs, or write stock and heatmap rows directly.

begin;

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

create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'manager'
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_manager() to authenticated;

drop policy if exists "Users can update own profile" on public.users;
revoke update on public.users from authenticated;

drop policy if exists "Authenticated can modify stock" on public.stock;
drop policy if exists "Authenticated can update stock" on public.stock;
drop policy if exists "Authenticated can read stock" on public.stock;
drop policy if exists "Staff can read stock" on public.stock;
drop policy if exists "Managers can update stock" on public.stock;
create policy "Staff can read stock"
  on public.stock for select
  to authenticated
  using (public.is_staff());
create policy "Managers can update stock"
  on public.stock for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());
revoke insert, update on public.stock from authenticated;
grant update on public.stock to authenticated;

drop policy if exists "Authenticated can update heatmap" on public.location_heatmaps;
revoke insert, update on public.location_heatmaps from authenticated;

drop policy if exists "Authenticated can create orders" on public.orders;
drop policy if exists "Authenticated can update orders" on public.orders;
drop policy if exists "Authenticated can read orders" on public.orders;
drop policy if exists "Staff can read all orders, customers read their own" on public.orders;
create policy "Staff can read all orders, customers read their own"
  on public.orders for select
  to authenticated
  using (public.is_staff() or customer_id = auth.uid());
drop policy if exists "Staff can update orders" on public.orders;
create policy "Staff can update orders"
  on public.orders for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
revoke insert on public.orders from authenticated;
grant update on public.orders to authenticated;

drop policy if exists "Authenticated can create order_items" on public.order_items;
drop policy if exists "Authenticated can update order_items" on public.order_items;
drop policy if exists "Authenticated can read order_items" on public.order_items;
drop policy if exists "Staff and owners can read order_items" on public.order_items;
create policy "Staff and owners can read order_items"
  on public.order_items for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = auth.uid()
    )
  );
revoke insert, update on public.order_items from authenticated;

notify pgrst, 'reload schema';
commit;
