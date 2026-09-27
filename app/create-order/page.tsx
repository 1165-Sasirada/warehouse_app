'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface StockOption {
  skuId: string
  name: string
  locationId: string
  locationLabel: string
  availableQuantity: number
}

interface OrderLine {
  skuId: string
  quantity: number
}

const EMPTY_LINE: OrderLine = { skuId: '', quantity: 1 }

export default function CreateOrderPage() {
  const [stockOptions, setStockOptions] = useState<StockOption[]>([])
  const [lines, setLines] = useState<OrderLine[]>([{ ...EMPTY_LINE }])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPage() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Please sign in first.')
      setLoading(false)
      return
    }

    const { data: stockData, error: stockError } = await supabase
      .from('stock')
      .select('sku_id, location_id, quantity, sku:skus(name), location:locations(label)')
      .gt('quantity', 0)
      .order('sku_id')

    if (stockError) {
      setError(stockError.message)
    } else {
      const rows = (stockData ?? []) as unknown as Array<{
        sku_id: string
        location_id: string
        quantity: number
        sku: { name: string } | null
        location: { label: string } | null
      }>
      setStockOptions(rows.filter((row) => row.sku && row.location).map((row) => ({
        skuId: row.sku_id,
        name: row.sku!.name,
        locationId: row.location_id,
        locationLabel: row.location!.label,
        availableQuantity: row.quantity,
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateLine(index: number, changes: Partial<OrderLine>) {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...changes } : line
    )))
  }

  function addLine() {
    setLines((current) => [...current, { ...EMPTY_LINE }])
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))
  }

  async function handleCreateOrder() {
    setError(null)
    setMessage(null)
    const validLines = lines.filter((line) => line.skuId && line.quantity > 0)
    if (validLines.length !== lines.length) {
      setError('Select an SKU and quantity for every line.')
      return
    }
    if (new Set(validLines.map((line) => line.skuId)).size !== validLines.length) {
      setError('Each SKU can appear only once in an order.')
      return
    }
    if (validLines.some((line) => {
      const stock = stockOptions.find((option) => option.skuId === line.skuId)
      return !stock || line.quantity > stock.availableQuantity
    })) {
      setError('Requested quantity exceeds available stock.')
      return
    }

    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Please sign in before creating an order.')
      setSaving(false)
      return
    }

    const now = new Date()
    const generatedOrderNumber = `ORD-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${now.toTimeString().slice(0, 8).replaceAll(':', '')}`

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: generatedOrderNumber,
        status: 'PENDING',
        user_id: authData.user.id,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      setError(orderError?.message ?? 'Unable to create order.')
      setSaving(false)
      return
    }

    const { error: itemError } = await supabase.from('order_items').insert(
      validLines.map((line, index) => ({
        order_id: order.id,
        sku_id: line.skuId,
        location_id: stockOptions.find((option) => option.skuId === line.skuId)!.locationId,
        quantity: line.quantity,
        pick_sequence: index + 1,
        picked_status: false,
      }))
    )

    if (itemError) {
      setError(`Order was created but items failed: ${itemError.message}`)
      setSaving(false)
      return
    }

    setMessage(`Order ${generatedOrderNumber} created and waiting for a picker.`)
    setLines([{ ...EMPTY_LINE }])
    setSaving(false)
  }

  if (loading) {
    return <PageShell><p className="text-[#231942]/70">Loading…</p></PageShell>
  }

  return (
    <PageShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-title)] text-2xl font-medium text-[#231942]">Create Order</h1>
          <p className="mt-1 text-sm text-[#4a4e69]">Create a pending order for warehouse picking.</p>
        </div>
          <span className="rounded-sm bg-[#231942] px-3 py-1 text-xs text-[#e0b1cb]">Authenticated user</span>
      </div>

      <div className="max-w-4xl rounded-md border border-[#231942]/20 bg-white/40 p-5">
        <div className="mb-3 grid grid-cols-[1fr_1fr_110px_80px] gap-3 text-xs text-[#4a4e69]">
          <span>SKU</span>
          <span>Auto location</span>
          <span>Quantity</span>
          <span />
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={`order-line-${index}`} className="grid grid-cols-[1fr_1fr_110px_80px] gap-3">
              <select
                value={line.skuId}
                onChange={(event) => updateLine(index, { skuId: event.target.value })}
                className="rounded-sm border border-[#231942]/30 bg-white/70 px-2 py-2 text-sm text-[#231942]"
              >
                <option value="">Select SKU</option>
                {stockOptions.map((stock) => <option key={stock.skuId} value={stock.skuId}>{stock.name}</option>)}
              </select>
              <span className="rounded-sm border border-[#231942]/15 bg-[#f5ebfa]/70 px-2 py-2 text-sm text-[#4a4e69]">
                {stockOptions.find((stock) => stock.skuId === line.skuId)?.locationLabel ?? 'Auto-selected'}
              </span>
              <input
                type="number"
                min="1"
                value={line.quantity}
                max={stockOptions.find((stock) => stock.skuId === line.skuId)?.availableQuantity}
                onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })}
                className="rounded-sm border border-[#231942]/30 bg-white/70 px-2 py-2 text-sm text-[#231942]"
              />
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
                className="text-sm text-[#ce4257] disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={addLine} className="text-sm text-[#231942] underline">+ Add item</button>
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={saving}
            className="rounded-sm bg-[#231942] px-4 py-2 text-sm text-[#e0b1cb] disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create pending order'}
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-[#231942]">{message}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-[#ce4257]">{error}</p>}
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
