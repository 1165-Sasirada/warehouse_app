'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 20

interface OrderItemLine {
  quantity: number
  sku: { name: string } | null
}

interface CustomerOrder {
  id: string
  order_number: string
  status: string
  created_at: string
  order_items: OrderItemLine[]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [dateFilter, setDateFilter] = useState('') // yyyy-mm-dd, empty = all
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [realtimeVersion, setRealtimeVersion] = useState(0)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void supabase.auth.getUser().then(({ data, error: authError }) => {
        if (!active) return
        if (authError || !data.user) {
          setError('Please sign in to view your orders.')
          setLoading(false)
          return
        }
        setCustomerId(data.user.id)
      })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  async function fetchOrders(currentCustomerId: string) {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('orders')
      .select(
        'id, order_number, status, created_at, order_items(quantity, sku:skus(name))',
        { count: 'exact' }
      )
      .eq('customer_id', currentCustomerId)
      .order('created_at', { ascending: false })

    if (dateFilter) {
      // Parsed as local time (no "Z"), then converted to UTC for the query,
      // so "Oct 11" means Oct 11 in the viewer's timezone.
      const start = new Date(`${dateFilter}T00:00:00`).toISOString()
      const end = new Date(`${dateFilter}T23:59:59.999`).toISOString()
      query = query.gte('created_at', start).lte('created_at', end)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error: fetchError, count } = await query.range(from, to)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setOrders((data ?? []) as unknown as CustomerOrder[])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!customerId) return

    const refreshOrders = () => setRealtimeVersion((version) => version + 1)
    const channel = supabase
      .channel(`customer-orders:${customerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${customerId}`,
      }, refreshOrders)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${customerId}`,
      }, refreshOrders)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refreshOrders()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Live customer order subscription failed:', status)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    const timer = window.setTimeout(() => void fetchOrders(customerId), 0)
    return () => window.clearTimeout(timer)
    // The query intentionally refreshes when the user, page, date, or Realtime event changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, page, dateFilter, realtimeVersion])

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }

  function statusLabel(status: string) {
    if (status === 'PICKING') return 'In progress'
    if (status === 'COMPLETED') return 'Completed'
    return 'Pending'
  }

  function itemsSummary(order: CustomerOrder) {
    return order.order_items
      .map((line) => `${line.quantity}× ${line.sku?.name ?? 'Unknown item'}`)
      .join(', ')
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h1 className="font-[var(--font-title)] text-2xl font-medium text-[#231942]">
            Order Status
          </h1>

          <div className="flex items-center gap-2">
            <label htmlFor="date-filter" className="text-sm text-[#231942]/70">
              Filter by date
            </label>
            <input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                setPage(0)
              }}
              className="rounded-sm border border-[#231942]/30 bg-white/60 px-2 py-1 text-sm text-[#231942]"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter('')
                  setPage(0)
                }}
                className="text-sm text-[#231942] underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-md border border-[#231942]">
          <table className="w-full text-left font-[var(--font-body)] text-sm">
            <thead className="sticky top-0 bg-[#231942] text-[#e0b1cb]">
              <tr>
                <th className="px-4 py-2 font-medium">Order #</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Placed</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#231942]/60">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#ce4257]">
                    {error}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#231942]/60">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-[#231942]/15 text-[#231942]">
                    <td className="px-4 py-2">{order.order_number}</td>
                    <td className="px-4 py-2">{itemsSummary(order)}</td>
                    <td className="px-4 py-2">{formatTimestamp(order.created_at)}</td>
                    <td className="px-4 py-2">{statusLabel(order.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-between text-sm text-[#231942]">
          <span>
            Page {page + 1} of {totalPages} ({totalCount} orders)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-sm border border-[#231942]/40 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-sm border border-[#231942]/40 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
