import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authenticateRequest, RequestAuthError } from '@/lib/server/requestAuth'
import { enqueueOrders, type QueuedOrderItem } from '@/lib/server/orderQueue'
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

export const runtime = 'nodejs'

const MAX_BATCH_SIZE = 50
const MAX_ITEMS_PER_ORDER = 3
const MAX_QUANTITY_PER_LINE = 5

interface AvailableStock {
  sku_id: string
  location_id: string
  quantity: number
}

function makeOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ORD-${date}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
}

async function loadAvailableStock() {
  const supabase = createSupabaseAdminClient()
  const allRows: AvailableStock[] = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('stock')
      .select('sku_id, location_id, quantity')
      .gt('quantity', 0)
      .order('sku_id')
      .order('location_id')
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Unable to load stock for the order batch:', error)
      throw new Error('Unable to load available stock.')
    }

    const rows = data ?? []
    allRows.push(...rows)
    if (rows.length < pageSize) break
  }

  return allRows
}

function shuffle<T>(values: T[]) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function createRandomOrders(count: number, stockRows: AvailableStock[]) {
  const choicesBySku = new Map<string, AvailableStock>()
  for (const row of stockRows) {
    if (!choicesBySku.has(row.sku_id)) choicesBySku.set(row.sku_id, row)
  }
  const choices = [...choicesBySku.values()]
  if (choices.length === 0) throw new Error('No SKUs have positive stock.')

  return Array.from({ length: count }, () => {
    const shuffled = shuffle(choices)
    const maxItems = Math.min(MAX_ITEMS_PER_ORDER, shuffled.length)
    const lineCount = 1 + Math.floor(Math.random() * maxItems)
    const items: QueuedOrderItem[] = shuffled.slice(0, lineCount).map((stock, index) => {
      const maxQuantity = Math.min(MAX_QUANTITY_PER_LINE, stock.quantity)
      return {
        sku_id: stock.sku_id,
        location_id: stock.location_id,
        quantity: 1 + Math.floor(Math.random() * maxQuantity),
        pick_sequence: index + 1,
      }
    })

    return {
      orderNumber: makeOrderNumber(),
      items,
    }
  })
}

export async function POST(request: Request) {
  try {
    const { user, role } = await authenticateRequest(request)
    if (role !== 'manager') {
      return NextResponse.json({ error: 'Only managers can create order batches.' }, { status: 403 })
    }

    let payload: { count?: unknown }
    try {
      payload = await request.json() as { count?: unknown }
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    if (!Number.isInteger(payload.count) || Number(payload.count) < 1 || Number(payload.count) > MAX_BATCH_SIZE) {
      return NextResponse.json({
        error: `Choose a whole number between 1 and ${MAX_BATCH_SIZE}.`,
      }, { status: 400 })
    }

    const count = Number(payload.count)
    const stockRows = await loadAvailableStock()
    const orders = createRandomOrders(count, stockRows)
    const result = await enqueueOrders(user.id, orders)

    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Order batch enqueue failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to queue this order batch.',
    }, { status: 500 })
  }
}
