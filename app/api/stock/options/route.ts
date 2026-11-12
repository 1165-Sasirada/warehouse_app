import { NextResponse } from 'next/server'
import { authenticateRequest, RequestAuthError } from '@/lib/server/requestAuth'
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

export const runtime = 'nodejs'

const PAGE_SIZE = 1000

interface StockOption {
  skuId: string
  name: string
  locationId: string
  locationLabel: string
  availableQuantity: number
}

interface StockRow {
  sku_id: string
  location_id: string
  quantity: number
  sku: { name: string } | { name: string }[] | null
  location: { label: string } | { label: string }[] | null
}

export async function GET(request: Request) {
  try {
    const { role } = await authenticateRequest(request)
    if (role !== 'customer' && role !== 'manager') {
      return NextResponse.json({ error: 'Only customers and managers can create orders.' }, { status: 403 })
    }

    const supabase = createSupabaseAdminClient()
    const options = new Map<string, StockOption>()

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('stock')
        .select('sku_id, location_id, quantity, sku:skus(name), location:locations(label)')
        .gt('quantity', 0)
        .order('sku_id')
        .order('location_id')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Unable to load order stock options:', error)
        return NextResponse.json({ error: 'Unable to load available stock.' }, { status: 500 })
      }

      const rows = (data ?? []) as unknown as StockRow[]
      for (const row of rows) {
        if (options.has(row.sku_id)) continue
        const sku = Array.isArray(row.sku) ? row.sku[0] : row.sku
        const location = Array.isArray(row.location) ? row.location[0] : row.location
        if (!sku || !location) continue

        options.set(row.sku_id, {
          skuId: row.sku_id,
          name: sku.name,
          locationId: row.location_id,
          locationLabel: location.label,
          availableQuantity: row.quantity,
        })
      }

      if (rows.length < PAGE_SIZE) break
    }

    return NextResponse.json({ stockOptions: [...options.values()] })
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Stock options request failed:', error)
    return NextResponse.json({ error: 'Unable to load available stock.' }, { status: 500 })
  }
}