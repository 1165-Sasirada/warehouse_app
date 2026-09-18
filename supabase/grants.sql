-- ============================================================
-- Table-level grants — run after schema.sql and rls.sql
-- Needed because "Automatically expose new tables" is OFF, so
-- Supabase does not auto-grant table access to anon/authenticated/
-- service_role. RLS policies only filter rows; the role also needs
-- this base grant before it's allowed to attempt the action at all.
-- ============================================================

-- service_role: full access to everything (it bypasses RLS anyway,
-- but still needs the base table grant — this is what seed.py needs)
grant select, insert, update, delete on
  public.users,
  public.skus,
  public.locations,
  public.stock,
  public.orders,
  public.order_items,
  public.location_heatmaps
to service_role;

-- anon: read-only on public catalog data (matches the "Public can
-- read ..." policies in rls.sql)
grant select on
  public.skus,
  public.locations,
  public.location_heatmaps
to anon;

-- authenticated: same read access as anon, plus read/write on the
-- operational tables (matches the "Authenticated can ..." policies)
grant select on
  public.skus,
  public.locations,
  public.location_heatmaps
to authenticated;

grant select, insert, update on
  public.stock,
  public.orders,
  public.order_items
to authenticated;

grant select, update on public.users to authenticated;