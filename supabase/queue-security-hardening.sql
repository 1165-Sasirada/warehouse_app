-- Apply only after the queued-order application code is deployed.
-- This prevents authenticated browser clients from bypassing the queue
-- or updating picked_status without the atomic stock check.

drop policy if exists "Authenticated can create orders" on public.orders;
drop policy if exists "Authenticated can create order_items" on public.order_items;
drop policy if exists "Authenticated can update order_items" on public.order_items;
drop policy if exists "Authenticated can update orders" on public.orders;

create policy "Staff can update orders"
  on public.orders for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke insert on public.orders, public.order_items from authenticated;
revoke update on public.order_items from authenticated;

notify pgrst, 'reload schema';
