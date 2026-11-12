-- ============================================================
-- Row Level Security — run after schema.sql
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

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

-- Turn RLS on for every table (Supabase blocks all access by
-- default once RLS is enabled, until you add policies)
alter table public.users enable row level security;
alter table public.skus enable row level security;
alter table public.locations enable row level security;
alter table public.stock enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.location_heatmaps enable row level security;

-- --- Public read-only catalog data (unauthenticated allowed) ---
create policy "Public can read skus"
  on public.skus for select
  to anon, authenticated
  using (true);

create policy "Public can read locations"
  on public.locations for select
  to anon, authenticated
  using (true);

create policy "Public can read location_heatmaps"
  on public.location_heatmaps for select
  to anon, authenticated
  using (true);

-- --- Authenticated-only: stock, orders, order_items ---
create policy "Authenticated can read stock"
  on public.stock for select
  to authenticated
  using (public.is_staff());

create policy "Managers can update stock"
  on public.stock for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "Staff can read orders"
  on public.orders for select
  to authenticated
  using (public.is_staff());

create policy "Staff can update orders"
  on public.orders for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "Staff can read order_items"
  on public.order_items for select
  to authenticated
  using (public.is_staff());

-- --- Users table: each employee can read/update their own row ---
create policy "Users can read own profile"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

-- Profile role and operational writes are intentionally not exposed to
-- browser clients. Use privileged server code or controlled RPCs instead.
