-- ============================================================
-- Row Level Security — run after schema.sql
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

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
  using (true);

create policy "Authenticated can modify stock"
  on public.stock for insert
  to authenticated
  with check (true);

create policy "Authenticated can update stock"
  on public.stock for update
  to authenticated
  using (true);

create policy "Authenticated can read orders"
  on public.orders for select
  to authenticated
  using (true);

create policy "Authenticated can create orders"
  on public.orders for insert
  to authenticated
  with check (true);

create policy "Authenticated can update orders"
  on public.orders for update
  to authenticated
  using (true);

create policy "Authenticated can read order_items"
  on public.order_items for select
  to authenticated
  using (true);

create policy "Authenticated can create order_items"
  on public.order_items for insert
  to authenticated
  with check (true);

create policy "Authenticated can update order_items"
  on public.order_items for update
  to authenticated
  using (true);

create policy "Authenticated can update heatmap"
  on public.location_heatmaps for update
  to authenticated
  using (true);

-- --- Users table: each employee can read/update their own row ---
create policy "Users can read own profile"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- Note: these policies don't yet distinguish 'picker' vs 'manager'
-- (e.g. only managers can restock). If you want that for the demo,
-- add a check like: using (exists (select 1 from public.users
-- where id = auth.uid() and role = 'manager')) to the relevant
-- write policies once you've built the manager-only actions.
