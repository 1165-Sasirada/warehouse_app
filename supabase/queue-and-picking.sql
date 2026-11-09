-- Queued order persistence and atomic picking.
-- Run after schema.sql, rls.sql, grants.sql, and patch-order-ownership.sql.

create or replace function public.create_queued_order(
  p_order_number text,
  p_customer_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if p_order_number is null or length(trim(p_order_number)) = 0 then
    raise exception 'order_number is required';
  end if;

  if p_customer_id is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'customer and at least one order item are required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      sku_id uuid,
      location_id uuid,
      quantity integer,
      pick_sequence integer
    )
    where item.sku_id is null
       or item.location_id is null
       or item.quantity is null
       or item.quantity < 1
       or item.pick_sequence is null
       or item.pick_sequence < 1
  ) then
    raise exception 'order items contain invalid values';
  end if;

  insert into public.orders (order_number, status, customer_id)
  values (p_order_number, 'PENDING', p_customer_id)
  on conflict (order_number) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id into v_order_id
    from public.orders
    where order_number = p_order_number
      and customer_id = p_customer_id;

    if v_order_id is null then
      raise exception 'order number already belongs to another customer';
    end if;

    return v_order_id;
  end if;

  insert into public.order_items (
    order_id,
    sku_id,
    location_id,
    quantity,
    pick_sequence,
    picked_status
  )
  select
    v_order_id,
    item.sku_id,
    item.location_id,
    item.quantity,
    item.pick_sequence,
    false
  from jsonb_to_recordset(p_items) as item(
    sku_id uuid,
    location_id uuid,
    quantity integer,
    pick_sequence integer
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_queued_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_queued_order(text, uuid, jsonb) to service_role;

create or replace function public.pick_order_item(
  p_order_item_id uuid,
  p_naive_distance integer default null,
  p_optimized_distance integer default null,
  p_distance_saved integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_stock public.stock%rowtype;
  v_remaining integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff authorization required';
  end if;

  select * into v_item
  from public.order_items
  where id = p_order_item_id
  for update;

  if not found then
    raise exception 'order item not found';
  end if;

  select * into v_order
  from public.orders
  where id = v_item.order_id
  for update;

  if v_order.user_id is distinct from auth.uid() then
    raise exception 'order is not assigned to the current picker';
  end if;

  if v_item.picked_status then
    return jsonb_build_object('already_picked', true, 'completed', v_order.status = 'COMPLETED');
  end if;

  if v_order.status <> 'PICKING' then
    raise exception 'order is not currently being picked';
  end if;

  select * into v_stock
  from public.stock
  where sku_id = v_item.sku_id
    and location_id = v_item.location_id
  for update;

  if not found then
    raise exception 'stock row not found for this item';
  end if;

  if v_stock.quantity < v_item.quantity then
    raise exception 'INSUFFICIENT_STOCK: available %, required %',
      v_stock.quantity, v_item.quantity;
  end if;

  update public.stock
  set quantity = quantity - v_item.quantity,
      updated_at = now()
  where id = v_stock.id;

  update public.location_heatmaps
  set pick_count = pick_count + 1,
      last_picked_at = now()
  where location_id = v_item.location_id;

  if not found then
    raise exception 'heatmap row not found for this location';
  end if;

  update public.order_items
  set picked_status = true
  where id = v_item.id;

  select count(*) into v_remaining
  from public.order_items
  where order_id = v_order.id
    and picked_status = false;

  if v_remaining = 0 then
    if p_naive_distance is null
       or p_optimized_distance is null
       or p_distance_saved is null then
      raise exception 'route distances are required to complete the order';
    end if;

    update public.orders
    set status = 'COMPLETED',
        naive_distance = p_naive_distance,
        optimized_distance = p_optimized_distance,
        distance_saved = p_distance_saved,
        completed_at = now()
    where id = v_order.id;
  end if;

  return jsonb_build_object('already_picked', false, 'completed', v_remaining = 0);
end;
$$;

revoke all on function public.pick_order_item(uuid, integer, integer, integer) from public, anon;
grant execute on function public.pick_order_item(uuid, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
