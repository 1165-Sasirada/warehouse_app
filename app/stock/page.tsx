'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface StockRow {
  id: string
  quantity: number
  sku: { name: string } | null
  location: { label: string } | null
}

// Baseline quantity used by "Restock All" — bulk-resets every row to this
// value for demo purposes. Adjust if you want a different reset amount.
const RESTOCK_QUANTITY = 100

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [restocking, setRestocking] = useState(false)

  useEffect(() => {
    fetchStock()
  }, [])

  async function fetchStock() {
    setLoading(true)
    const { data, error } = await supabase
      .from('stock')
      .select('id, quantity, sku:skus(name), location:locations(label)')
      .order('id')

    if (!error && data) {
      setRows(data as unknown as StockRow[])
    }
    setLoading(false)
  }

  async function handleRestockAll() {
    setRestocking(true)
    // .gte('quantity', 0) is always true — Supabase requires a filter on
    // update(), this is the standard way to say "apply to every row."
    const { error } = await supabase
      .from('stock')
      .update({ quantity: RESTOCK_QUANTITY })
      .gte('quantity', 0)

    if (!error) await fetchStock()
    setRestocking(false)
  }

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase()
    return (
      row.sku?.name?.toLowerCase().includes(q) ||
      row.location?.label?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h1 className="font-[var(--font-title)] text-2xl font-medium text-[#231942]">
            Stock
          </h1>
          <button
            onClick={handleRestockAll}
            disabled={restocking}
            className="rounded-sm bg-[#231942] px-4 py-2 font-[var(--font-body)] text-sm text-[#e0b1cb] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restocking ? 'Restocking…' : 'Restock All'}
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by SKU or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-sm shrink-0 rounded-sm border border-[#231942]/30 bg-white/60 px-3 py-2 font-[var(--font-body)] text-sm text-[#231942] outline-none focus:border-[#231942]"
        />

        <div className="flex-1 overflow-auto rounded-md border border-[#231942]">
          <table className="w-full text-left font-[var(--font-body)] text-sm">
            <thead className="sticky top-0 bg-[#231942] text-[#e0b1cb]">
              <tr>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#231942]/60">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#231942]/60">
                    No matching stock.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-[#231942]/15 text-[#231942]">
                    <td className="px-4 py-2">{row.sku?.name ?? '—'}</td>
                    <td className="px-4 py-2">{row.location?.label ?? '—'}</td>
                    <td className="px-4 py-2">{row.quantity}</td>
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
