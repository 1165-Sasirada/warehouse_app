'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface OrderRow {
  id: string
  order_number: string
  created_at: string
  completed_at: string | null
  naive_distance: number | null
  optimized_distance: number | null
  distance_saved: number | null
  user: { full_name: string } | null
}

const ROW_COLORS = ['#5e548e', '#9f86c0']

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, created_at, completed_at, naive_distance, optimized_distance, distance_saved, user:users(full_name)'
      )
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })

    if (!error && data) {
      setOrders(data as unknown as OrderRow[])
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
    if (!order.naive_distance || !order.distance_saved) return '—'
    return `${Math.round((order.distance_saved / order.naive_distance) * 100)}%`
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <h1 className="mb-4 shrink-0 font-[var(--font-title)] text-2xl font-medium text-[#231942]">
          History
        </h1>

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
                  <td colSpan={7} className="px-4 py-6 text-center text-[#231942]/60">
                    Loading…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#231942]/60">
                    No completed orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((order, i) => (
                  <tr
                    key={order.id}
                    style={{ backgroundColor: `${ROW_COLORS[i % 2]}33` }} // ~20% opacity
                    className="text-[#231942]"
                  >
                    <td className="px-4 py-2">{order.order_number}</td>
                    <td className="px-4 py-2">{formatTimestamp(order.created_at)}</td>
                    <td className="px-4 py-2">{formatTimestamp(order.completed_at)}</td>
                    <td className="px-4 py-2">{order.user?.full_name ?? '—'}</td>
                    <td className="px-4 py-2">{order.naive_distance ?? '—'}</td>
                    <td className="px-4 py-2">{order.optimized_distance ?? '—'}</td>
                    <td className="px-4 py-2">{percentSaved(order)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
