'use client'

import { Fragment, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface OrderLine {
  quantity: number
  sku: { name: string } | null
  location: { label: string } | null
}

interface OrderRow {
  id: string
  order_number: string
  created_at: string
  completed_at: string | null
  naive_distance: number | null
  optimized_distance: number | null
  distance_saved: number | null
  user: { full_name: string } | null
  order_items: OrderLine[]
}

const ROW_COLORS = ['#5e548e', '#9f86c0']
const COLUMN_COUNT = 7

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('') // yyyy-mm-dd, empty = all
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchHistory(), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter])

  async function fetchHistory() {
    setLoading(true)
    setError(null)
    setExpandedId(null)

    // orders now has two links to users (user_id = employee, customer_id =
    // placer), so the embed needs a hint saying which one we mean.
    let query = supabase
      .from('orders')
      .select(
        'id, order_number, created_at, completed_at, naive_distance, optimized_distance, distance_saved, user:users!user_id(full_name), order_items(quantity, sku:skus(name), location:locations(label))'
      )
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })

    if (dateFilter) {
      // Day boundaries in the viewer's local timezone, converted to UTC
      const start = new Date(`${dateFilter}T00:00:00`).toISOString()
      const end = new Date(`${dateFilter}T23:59:59.999`).toISOString()
      query = query.gte('completed_at', start).lte('completed_at', end)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setOrders([])
    } else {
      setOrders((data ?? []) as unknown as OrderRow[])
    }
    setLoading(false)
  }

  function formatTimestamp(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function percentSaved(order: OrderRow) {
    if (order.naive_distance == null || order.distance_saved == null || order.naive_distance === 0) {
      return '—'
    }
    return `${Math.round((order.distance_saved / order.naive_distance) * 100)}%`
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h1 className="font-[var(--font-title)] text-2xl font-medium text-[#231942]">
            History
          </h1>

          <div className="flex items-center gap-2">
            <label htmlFor="history-date" className="font-[var(--font-body)] text-sm text-[#231942]/70">
              Filter by completed date
            </label>
            <input
              id="history-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-sm border border-[#231942]/30 bg-white/60 px-2 py-1 font-[var(--font-body)] text-sm text-[#231942]"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="font-[var(--font-body)] text-sm text-[#231942] underline"
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
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Completed</th>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Naive</th>
                <th className="px-4 py-2 font-medium">Optimized</th>
                <th className="px-4 py-2 font-medium">Saved</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-6 text-center text-[#231942]/60">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-6 text-center text-[#ce4257]">
                    {error}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-6 text-center text-[#231942]/60">
                    {dateFilter ? 'No completed orders on that date.' : 'No completed orders yet.'}
                  </td>
                </tr>
              ) : (
                orders.map((order, i) => {
                  const background = `${ROW_COLORS[i % 2]}33` // ~20% opacity
                  const isOpen = expandedId === order.id

                  return (
                    <Fragment key={order.id}>
                      <tr
                        style={{ backgroundColor: background }}
                        className="cursor-pointer text-[#231942]"
                        onClick={() => setExpandedId(isOpen ? null : order.id)}
                      >
                        <td className="px-4 py-2">
                          {/* The click is handled by the row; the button is here so the
                              row is reachable and announced properly by keyboard. */}
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} items for ${order.order_number}`}
                            className="flex items-center gap-2 text-left"
                          >
                            <Chevron open={isOpen} />
                            {order.order_number}
                          </button>
                        </td>
                        <td className="px-4 py-2">{formatTimestamp(order.created_at)}</td>
                        <td className="px-4 py-2">{formatTimestamp(order.completed_at)}</td>
                        <td className="px-4 py-2">{order.user?.full_name ?? '—'}</td>
                        <td className="px-4 py-2">{order.naive_distance ?? '—'}</td>
                        <td className="px-4 py-2">{order.optimized_distance ?? '—'}</td>
                        <td className="px-4 py-2">{percentSaved(order)}</td>
                      </tr>

                      {isOpen && (
                        <tr style={{ backgroundColor: background }} className="text-[#231942]">
                          <td colSpan={COLUMN_COUNT} className="px-4 pb-3 pt-0">
                            {order.order_items.length === 0 ? (
                              <p className="pl-6 text-[#231942]/60">No item records for this order.</p>
                            ) : (
                              <ul className="space-y-1 pl-6">
                                {order.order_items.map((line, index) => (
                                  <li key={index} className="flex items-baseline gap-3">
                                    <span className="w-10 text-right font-medium">{line.quantity}×</span>
                                    <span>{line.sku?.name ?? 'Unknown item'}</span>
                                    <span className="text-xs text-[#231942]/60">
                                      {line.location?.label ?? ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
