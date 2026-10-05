'use client'

import Sidebar from '@/components/Sidebar'
import WarehouseMap from '@/components/WarehouseMap'
import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

interface PendingOrder {
  id: string
  order_number: string
  created_at: string
}

interface PickItem {
  id: string
  skuId: string
  locationId: string
  quantity: number
  name: string
  location: string
  rack: { row: number; col: number }
  pick: { row: number; col: number }
  picked: boolean
}

type Point = { row: number; col: number }

export default function DashboardPage() {
  const [orderAccepted, setOrderAccepted] = useState(false)
  const [pickedCount, setPickedCount] = useState(0)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [items, setItems] = useState<PickItem[]>([])
  const [routeSegments, setRouteSegments] = useState<Point[][]>([])
  const [naiveDistance, setNaiveDistance] = useState<number | null>(null)
  const [optimizedDistance, setOptimizedDistance] = useState<number | null>(null)
  const [distanceSaved, setDistanceSaved] = useState<number | null>(null)
  const [walkSpeed, setWalkSpeed] = useState(1)
  const [completedPath, setCompletedPath] = useState<{ row: number; col: number }[]>([])
  const [completedTargets, setCompletedTargets] = useState<{ row: number; col: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({})
  const activeItem = orderAccepted ? items[pickedCount] : undefined
  const activePath = routeSegments[pickedCount] ?? []
  const isComplete = orderAccepted && items.length > 0 && pickedCount >= items.length

  async function loadPendingOrders() {
    const { data, error: pendingError } = await supabase
      .from('orders')
      .select('id, order_number, created_at')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })

    if (pendingError) {
      setError(pendingError.message)
      return
    }
    setPendingOrders(data ?? [])
  }

  // Pulls pick_count per location and re-keys it by grid coordinate
  // ("row-col"), which is what WarehouseMap expects for its heatmap
  // prop. Re-run this after every pick so the overlay stays live.
  async function fetchHeatmap() {
    const { data, error: heatError } = await supabase
      .from('location_heatmaps')
      .select('pick_count, location:locations(grid_y, grid_x)')

    if (heatError) return

    const map: Record<string, number> = {}
    for (const row of data ?? []) {
      const loc = Array.isArray(row.location) ? row.location[0] : row.location
      if (loc) map[`${loc.grid_y}-${loc.grid_x}`] = row.pick_count
    }
    setHeatmapData(map)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPendingOrders()
      void fetchHeatmap()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleAcceptOrder() {
    setSaving(true)
    setError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setError('Please sign in before accepting an order.')
      setSaving(false)
      return
    }

    const pendingOrder = pendingOrders[0]
    if (!pendingOrder) {
      setError('No pending orders available.')
      setSaving(false)
      return
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'id, sku_id, location_id, quantity, pick_sequence, picked_status, sku:skus(name), location:locations(label, grid_x, grid_y, pick_x, pick_y)'
      )
      .eq('order_id', pendingOrder.id)
      .order('pick_sequence', { ascending: true })

    if (itemsError || !orderItems || orderItems.length === 0) {
      setError(itemsError?.message ?? 'This order has no items.')
      setSaving(false)
      return
    }

    const mappedItems: PickItem[] = orderItems.map((item) => {
      const sku = Array.isArray(item.sku) ? item.sku[0] : item.sku
      const location = Array.isArray(item.location) ? item.location[0] : item.location
      return {
        id: item.id,
        skuId: item.sku_id,
        locationId: item.location_id,
        quantity: item.quantity,
        name: sku?.name ?? 'Unknown SKU',
        location: location?.label ?? 'Unknown location',
        rack: { row: location?.grid_y ?? 0, col: location?.grid_x ?? 0 },
        pick: { row: location?.pick_y ?? 0, col: location?.pick_x ?? 0 },
        picked: item.picked_status,
      }
    })

    const routeResponse = await fetch('/api/path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: mappedItems.map((item) => ({
          name: item.name,
          label: item.location,
          pick_coord: [item.pick.row, item.pick.col],
        })),
      }),
    })
    const routeResult = await routeResponse.json()
    if (!routeResponse.ok) {
      setError(routeResult.error ?? 'Unable to calculate the A* route.')
      setSaving(false)
      return
    }

    const optimizedItems: PickItem[] = routeResult.pick_steps
      .map((step: { location_label: string }) =>
        mappedItems.find((item) => item.location === step.location_label)
      )
      .filter(Boolean)
    const optimizedSegments: Point[][] = routeResult.pick_steps.map(
      (step: { path: [number, number][] }) => step.path.map(([row, col]) => ({ row, col }))
    )

    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'PICKING', user_id: userData.user.id })
      .eq('id', pendingOrder.id)

    if (orderError) {
      setError(orderError.message)
      setSaving(false)
      return
    }

    const firstUnpicked = mappedItems.findIndex((item) => !item.picked)
    setOrderId(pendingOrder.id)
    setItems(optimizedItems)
    setRouteSegments(optimizedSegments)
    setNaiveDistance(routeResult.naive_distance)
    setOptimizedDistance(routeResult.optimized_distance)
    setDistanceSaved(routeResult.distance_saved)
    setOrderAccepted(true)
    setPickedCount(firstUnpicked === -1 ? mappedItems.length : firstUnpicked)
    setCompletedPath([])
    setCompletedTargets([])
    setPendingOrders((orders) => orders.filter((order) => order.id !== pendingOrder.id))
    setSaving(false)
  }

  async function handlePickItem() {
    if (!orderId || !activeItem || saving) return
    setSaving(true)
    setError(null)

    const { error: itemError } = await supabase
      .from('order_items')
      .update({ picked_status: true })
      .eq('id', activeItem.id)

    if (itemError) {
      setError(itemError.message)
      setSaving(false)
      return
    }

    // Decrement stock for the picked item. Read-then-write rather than
    // an atomic SQL decrement — fine for a classroom demo's traffic
    // level, but not safe under concurrent pickers (see README's
    // "still required" list for the transactional version).
    const { data: stockRow, error: stockFetchError } = await supabase
      .from('stock')
      .select('id, quantity')
      .eq('sku_id', activeItem.skuId)
      .eq('location_id', activeItem.locationId)
      .single()

    if (!stockFetchError && stockRow) {
      const newQuantity = Math.max(0, stockRow.quantity - activeItem.quantity)
      await supabase
        .from('stock')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', stockRow.id)
    }

    // Increment the pick-frequency heatmap for this location. Requires
    // the location_heatmaps row to already exist — run
    // supabase/patch-customer-and-heatmap.sql once to backfill it.
    const { data: heatRow } = await supabase
      .from('location_heatmaps')
      .select('id, pick_count')
      .eq('location_id', activeItem.locationId)
      .single()

    if (heatRow) {
      await supabase
        .from('location_heatmaps')
        .update({ pick_count: heatRow.pick_count + 1, last_picked_at: new Date().toISOString() })
        .eq('id', heatRow.id)
    }

    void fetchHeatmap() // refresh the overlay so a visible toggle updates live

    setCompletedPath((path) => [
      ...path,
      ...activePath.filter((point, index) => path.length === 0 || index > 0),
    ])
    if (activeItem) {
      setCompletedTargets((targets) => [...targets, activeItem.rack])
    }
    setPickedCount((count) => count + 1)

    if (pickedCount === items.length - 1) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'COMPLETED',
          naive_distance: naiveDistance,
          optimized_distance: optimizedDistance,
          distance_saved: distanceSaved,
          completed_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (orderError) setError(orderError.message)
    }
    setSaving(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar: order banner (centered) + pending count & accept button (right) */}
        <div className="relative flex h-16 shrink-0 items-center justify-end border-b border-[#231942]/20 px-6">
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <OrderBanner
              item={activeItem}
              pickedCount={pickedCount}
              onPick={handlePickItem}
              complete={isComplete}
              pendingCount={pendingOrders.length}
              totalItems={items.length}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ce4257] font-[var(--font-body)] text-xs font-semibold text-[#f2e9e4]">
              {orderAccepted && !isComplete ? 1 : pendingOrders.length}
            </span>
            <button
              onClick={handleAcceptOrder}
              disabled={(orderAccepted && !isComplete) || saving}
              className="rounded-sm bg-[#231942] px-4 py-2 font-[var(--font-body)] text-sm text-[#e0b1cb] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : orderAccepted && !isComplete ? 'Order accepted' : 'Accept Order'}
            </button>
          </div>
        </div>

        {/* Warehouse map */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
          <WarehouseMap
            activePath={orderAccepted && !isComplete ? activePath : []}
            completedPath={completedPath}
            targetCell={activeItem?.rack}
            completedTargets={completedTargets}
            routeSpeed={walkSpeed}
            heatmap={heatmapData}
            showHeatmap={showHeatmap}
          />
        </div>

        {error && (
          <p role="alert" className="px-6 pb-2 text-center text-sm text-[#ce4257]">
            {error}
          </p>
        )}

        {/* Distance info */}
        <div className="flex shrink-0 items-center justify-center gap-8 border-t border-[#4a4e69]/20 px-6 py-3 font-[var(--font-body)] text-sm text-[#22223b]">
          <span>Naive distance: {naiveDistance ?? '—'}</span>
          <span>Optimized distance: {optimizedDistance ?? '—'}</span>
          <span>Saved: {distanceSaved ?? '—'}</span>
          <label className="flex items-center gap-2">
            <span>Walk speed</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.5"
              value={walkSpeed}
              onChange={(event) => setWalkSpeed(Number(event.target.value))}
              aria-label="Walk speed"
              style={{ accentColor: '#e0b1cb' }}
            />
            <span className="w-8">{walkSpeed}x</span>
          </label>
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            className={`rounded-sm border px-3 py-1 text-xs transition-colors ${
              showHeatmap
                ? 'border-[#231942] bg-[#231942] text-[#e0b1cb]'
                : 'border-[#231942]/40 text-[#231942] hover:bg-[#231942]/10'
            }`}
          >
            Heatmap {showHeatmap ? 'on' : 'off'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface OrderBannerProps {
  item: PickItem | undefined
  pickedCount: number
  onPick: () => void
  complete: boolean
  pendingCount: number
  totalItems: number
}

function OrderBanner({ item, pickedCount, onPick, complete, pendingCount, totalItems }: OrderBannerProps) {
  return (
    <div className="rounded-md border border-[#4a4e69]/30 bg-white/50 px-4 py-2 font-[var(--font-body)] text-sm text-[#4a4e69]">
      {!item || complete ? (
        <p className="text-center">
          {complete
            ? 'Order complete — ready for the next order.'
            : pendingCount > 0
              ? `${pendingCount} pending order${pendingCount === 1 ? '' : 's'} waiting.`
              : 'No pending orders.'}
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={false} onChange={onPick} className="h-4 w-4 accent-[#231942]" />
            <span className="min-w-0 text-left">
              <span className="block truncate font-medium text-[#231942]">Pick {item.name}</span>
              <span className="block text-xs text-[#4a4e69]/80">Location {item.location}</span>
            </span>
          </label>
          <span className="shrink-0 text-xs text-[#4a4e69]">
            {pickedCount + 1}/{totalItems}
          </span>
        </div>
      )}
    </div>
  )
}
