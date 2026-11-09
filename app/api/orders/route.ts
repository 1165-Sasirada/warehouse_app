import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authenticateRequest, RequestAuthError } from '@/lib/server/requestAuth'
import { enqueueOrders } from '@/lib/server/orderQueue'
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

export const runtime = 'nodejs'

interface SubmittedOrderItem {
  skuId: string
  locationId: string
  quantity: number
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  try {
    const { user, role } = await authenticateRequest(request)
    if (role !== 'customer' && role !== 'manager') {
      return NextResponse.json({ error: 'Only customers and managers can create orders.' }, { status: 403 })
    }

    let payload: { items?: unknown }
    try {
      payload = await request.json() as { items?: unknown }
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 20) {
      return NextResponse.json({ error: 'An order must contain between 1 and 20 items.' }, { status: 400 })
    }

    const items: SubmittedOrderItem[] = []
    for (const value of payload.items) {
      if (!value || typeof value !== 'object') {
        return NextResponse.json({ error: 'An order item is invalid.' }, { status: 400 })
      }

      const item = value as Record<string, unknown>
      if (
        !isUuid(item.skuId)
        || !isUuid(item.locationId)
        || !Number.isInteger(item.quantity)
        || Number(item.quantity) < 1
      ) {
        return NextResponse.json({ error: 'Each item needs a valid SKU, location, and positive whole quantity.' }, { status: 400 })
      }
      items.push({
        skuId: item.skuId,
        locationId: item.locationId,
        quantity: Number(item.quantity),
      })
    }

    if (new Set(items.map((item) => item.skuId)).size !== items.length) {
      return NextResponse.json({ error: 'Each SKU can appear only once in an order.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: stockRows, error: stockError } = await supabase
      .from('stock')
      .select('sku_id, location_id, quantity')
      .in('sku_id', items.map((item) => item.skuId))
      .gt('quantity', 0)

    if (stockError) {
      console.error('Unable to validate order stock:', stockError)
      return NextResponse.json({ error: 'Unable to validate stock right now.' }, { status: 500 })
    }

    for (const item of items) {
      const stock = stockRows?.find((row) => row.sku_id === item.skuId && row.location_id === item.locationId)
      if (!stock || item.quantity > stock.quantity) {
        return NextResponse.json({
          error: 'Requested quantity exceeds the available stock at the selected location.',
        }, { status: 409 })
      }
    }

    const now = new Date()
    const orderNumber = `ORD-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
    const batch = await enqueueOrders(user.id, [{
      orderNumber,
      items: items.map((item, index) => ({
        sku_id: item.skuId,
        location_id: item.locationId,
        quantity: item.quantity,
        pick_sequence: index + 1,
      })),
    }])

    if (batch.queued === 0) {
      return NextResponse.json({
        error: 'The order could not be scheduled. Please try again.',
        batchId: batch.batchId,
      }, { status: 503 })
    }

    return NextResponse.json({
      batchId: batch.batchId,
      orderNumber,
      status: 'queued',
    }, { status: 202 })
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Order enqueue failed:', error)
    return NextResponse.json({ error: 'Unable to queue the order right now.' }, { status: 500 })
  }
}
