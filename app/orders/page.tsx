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

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchOrders(), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateFilter])

  async function fetchOrders() {
    setLoading(true)
    setError(null)

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Please sign in to view your orders.')
      setLoading(false)
      return
    }

    let query = supabase
      .from('orders')
      .select(
        'id, order_number, status, created_at, order_items(quantity, sku:skus(name))',
        { count: 'exact' }
      )
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false })

    if (dateFilter) {
      const start = `${dateFilter}T00:00:00`
      const end = `${dateFilter}T23:59:59`
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
