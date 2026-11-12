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
const PAGE_SIZE = 20
const FETCH_SIZE = 1000

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [restocking, setRestocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStock() {
    const allRows: StockRow[] = []
    for (let offset = 0; ; offset += FETCH_SIZE) {
      const { data, error } = await supabase
        .from('stock')
        .select('id, quantity, sku:skus(name), location:locations(label)')
        .order('id')
        .range(offset, offset + FETCH_SIZE - 1)

      if (error) {
        setError(error.message)
        break
      }
      const batch = (data ?? []) as unknown as StockRow[]
      allRows.push(...batch)
      if (batch.length < FETCH_SIZE) break
    }
    setRows(allRows)
    setLoading(false)
  }

  async function loadPage() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError('Please sign in to view stock.')
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
    if (profile?.role !== 'picker' && profile?.role !== 'manager') {
      setError('Only staff can view stock.')
      setLoading(false)
      return
    }

    setUserRole(profile.role)
    await fetchStock()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(), 0)
    return () => window.clearTimeout(timer)
    // Load the role and stock once when entering the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRestockAll() {
    if (userRole !== 'manager') return
    setRestocking(true)
    setError(null)
    // .gte('quantity', 0) is always true — Supabase requires a filter on
    // update(), this is the standard way to say "apply to every row."
    const { error } = await supabase
      .from('stock')
      .update({ quantity: RESTOCK_QUANTITY })
      .gte('quantity', 0)

    if (error) setError(error.message)
    else await fetchStock()
    setRestocking(false)
  }

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase()
    return (
      row.sku?.name?.toLowerCase().includes(q) ||
      row.location?.label?.toLowerCase().includes(q)
    )
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h1 className="font-[var(--font-title)] text-2xl font-medium text-[#231942]">
            Stock
          </h1>
          {userRole === 'manager' && (
            <button
              onClick={handleRestockAll}
              disabled={restocking}
              className="rounded-sm bg-[#231942] px-4 py-2 font-[var(--font-body)] text-sm text-[#e0b1cb] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restocking ? 'Restocking…' : 'Restock All'}
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Search by SKU or location…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
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
                  <td colSpan={3} className={`px-4 py-6 text-center ${error ? 'text-[#ce4257]' : 'text-[#231942]/60'}`}>
                    {error ?? 'No matching stock.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
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

        <div className="mt-3 flex shrink-0 items-center justify-between text-sm text-[#231942]">
          <span>Page {page + 1} of {pageCount} ({filtered.length} rows)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0 || loading}
              className="rounded-sm border border-[#231942]/40 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={page >= pageCount - 1 || loading}
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
