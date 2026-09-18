-- ============================================================
-- Warehouse Shortest Path Simulator — Phase 2 schema
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Supabase enables pgcrypto by default, which gives us gen_random_uuid()

-- 1. users
-- Linked 1:1 to Supabase Auth's own auth.users table via the id.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'picker' check (role in ('picker', 'manager')),
  created_at timestamptz not null default now()
);

-- 2. skus
create table public.skus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  dimensions text
);

-- 3. locations
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  zone text not null,
  aisle integer not null,
  bay integer not null,
  level integer not null,
  bin text not null,
  label text unique not null,       -- e.g. 'A-15-3-2-B'
  grid_x integer not null,
  grid_y integer not null,
  pick_x integer not null,
  pick_y integer not null
);

-- 4. stock
create table public.stock (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  sku_id uuid not null references public.skus(id),
  quantity integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 5. orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PICKING', 'COMPLETED')),
  user_id uuid references public.users(id),
  naive_distance integer,
  optimized_distance integer,
  distance_saved integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 6. order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku_id uuid not null references public.skus(id),
  location_id uuid not null references public.locations(id),
  quantity integer not null default 1,
  pick_sequence integer not null,
  picked_status boolean not null default false
);

-- 7. location_heatmaps
create table public.location_heatmaps (
  id uuid primary key default gen_random_uuid(),
  location_id uuid unique not null references public.locations(id),
  pick_count integer not null default 0,
  last_picked_at timestamptz
);

-- ============================================================
-- Realtime: tell Supabase to broadcast row changes on these two
-- tables. This is the only thing Realtime needs at the DB level —
-- your frontend subscribes to these later in Phase 3, no Python
-- changes required now.
-- ============================================================
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.location_heatmaps;
