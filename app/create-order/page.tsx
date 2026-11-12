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

interface BatchStatus {
  total: number
  completed: number
  failed: number
  queued: number
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors'
}

const EMPTY_LINE: OrderLine = { skuId: '', quantity: 1 }

export default function CreateOrderPage() {
  const [stockOptions, setStockOptions] = useState<StockOption[]>([])
  const [lines, setLines] = useState<OrderLine[]>([{ ...EMPTY_LINE }])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [batchCount, setBatchCount] = useState(10)
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPage() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Please sign in first.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }
    setUserRole(profile?.role ?? null)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) {
      setError('Please sign in first.')
      setLoading(false)
      return
    }

    const response = await fetch('/api/stock/options', {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      cache: 'no-store',
    })
    const result = await response.json() as { stockOptions?: StockOption[]; error?: string }
    if (!response.ok) setError(result.error ?? 'Unable to load available stock.')
    else setStockOptions(result.stockOptions ?? [])
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
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error('Please sign in before creating an order.')
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          items: validLines.map((line) => ({
            skuId: line.skuId,
            locationId: stockOptions.find((option) => option.skuId === line.skuId)!.locationId,
            quantity: line.quantity,
          })),
        }),
      })
      const result = await response.json() as { orderNumber?: string; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Unable to queue the order.')

      setMessage(`Order ${result.orderNumber} was queued and will appear for picking after it is processed.`)
      setLines([{ ...EMPTY_LINE }])
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to queue the order.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateBatch() {
    setError(null)
    setBatchMessage(null)
    if (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 50) {
      setError('Choose a whole number between 1 and 50.')
      return
    }

    setBatchSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error('Please sign in before creating an order batch.')
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      }
      const createResponse = await fetch('/api/order-batches', {
        method: 'POST',
        headers,
        body: JSON.stringify({ count: batchCount }),
      })
      const created = await createResponse.json() as {
        batchId?: string
        total?: number
        queued?: number
        failed?: number
        error?: string
      }
      if (!createResponse.ok || !created.batchId) {
        throw new Error(created.error ?? 'Unable to queue the order batch.')
      }

      setBatchMessage(`Queued ${created.queued ?? 0} of ${created.total ?? batchCount} orders. Checking progress…`)
      let status: BatchStatus | null = null
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const statusResponse = await fetch(`/api/order-batches/${created.batchId}`, { headers })
        const result = await statusResponse.json() as BatchStatus & { error?: string }
        if (!statusResponse.ok) {
          throw new Error(result.error ?? 'Unable to load order batch progress.')
        }
        status = result
        setBatchMessage(
          `Order batch: ${status.completed} completed, ${status.failed} failed, ${status.queued} waiting.`
        )
        if (status.status === 'completed' || status.status === 'completed_with_errors') break
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
      }

      if (status?.status === 'completed_with_errors') {
        setBatchMessage(`Batch finished: ${status.completed} orders created, ${status.failed} failed.`)
      } else if (status?.status === 'completed') {
        setBatchMessage(`Batch finished: all ${status.completed} orders were created.`)
      } else {
        setBatchMessage('Batch is still processing. You can refresh this page and check the queue again later.')
      }
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Unable to create the order batch.')
    } finally {
      setBatchSaving(false)
    }
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

      {userRole === 'manager' && (
        <section className="mb-5 max-w-4xl rounded-md border border-[#231942]/20 bg-white/40 p-5">
          <h2 className="font-[var(--font-title)] text-lg font-medium text-[#231942]">
            Simulate a batch of orders
          </h2>
          <p className="mt-1 text-sm text-[#4a4e69]">
            Orders use available SKUs and are assigned to your Manager account. Total demand may exceed stock.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-[#4a4e69]">
              Number of orders (1–50)
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                value={batchCount}
                onChange={(event) => setBatchCount(Number(event.target.value))}
                className="w-36 rounded-sm border border-[#231942]/30 bg-white/70 px-2 py-2 text-sm text-[#231942]"
              />
            </label>
            <button
              type="button"
              onClick={handleCreateBatch}
              disabled={batchSaving}
              className="rounded-sm bg-[#231942] px-4 py-2 text-sm text-[#e0b1cb] disabled:opacity-50"
            >
              {batchSaving ? 'Queueing orders…' : 'Create bacth of orders'}
            </button>
          </div>
          {batchMessage && <p role="status" className="mt-3 text-sm text-[#231942]">{batchMessage}</p>}
        </section>
      )}

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
            {saving ? 'Queueing…' : 'Queue order'}
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
