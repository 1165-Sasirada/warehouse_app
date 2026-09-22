'use client'

import Sidebar from '@/components/Sidebar'
import WarehouseMap from '@/components/WarehouseMap'

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f2e9e4]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar: order banner (centered) + pending count & accept button (right) */}
        <div className="relative flex h-16 shrink-0 items-center justify-end border-b border-[#231942]/20 px-6">
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <OrderBanner />
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ce4257] font-[var(--font-body)] text-xs font-semibold text-[#f2e9e4]">
              0
            </span>
            <button className="rounded-sm bg-[#231942] px-4 py-2 font-[var(--font-body)] text-sm text-[#e0b1cb] transition-colors hover:opacity-90">
              Accept Order
            </button>
          </div>
        </div>

        {/* Warehouse map */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
          <WarehouseMap />
        </div>

        {/* Distance info */}
        <div className="flex shrink-0 items-center justify-center gap-8 border-t border-[#4a4e69]/20 px-6 py-3 font-[var(--font-body)] text-sm text-[#22223b]">
          <span>Naive distance: —</span>
          <span>Optimized distance: —</span>
          <span>Saved: —</span>
        </div>
      </div>
    </div>
  )
}

// Empty state for now — will show the active order's current item,
// a pick checkbox, and a progress bar once order data is wired up.
function OrderBanner() {
  return (
    <div className="rounded-md border border-[#4a4e69]/30 bg-white/50 px-4 py-2 text-center font-[var(--font-body)] text-sm text-[#4a4e69]">
      No active order — accept an order to begin.
    </div>
  )
}
