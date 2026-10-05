'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Role = 'picker' | 'manager' | 'customer'

const NAV_ITEMS: { href: string; label: string; icon: () => React.ReactElement; roles: Role[] }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: MapIcon, roles: ['picker', 'manager'] },
  { href: '/create-order', label: 'Create Order', icon: PlusBoxIcon, roles: ['manager', 'customer'] },
  { href: '/orders', label: 'Order Status', icon: ReceiptIcon, roles: ['customer'] },
  { href: '/stock', label: 'Stock', icon: BoxIcon, roles: ['picker', 'manager'] },
  { href: '/history', label: 'History', icon: ClockIcon, roles: ['picker', 'manager'] },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (mounted) setRole((data?.role as Role) ?? null)
    }

    void loadRole()
    return () => {
      mounted = false
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = NAV_ITEMS.filter(({ roles }) => role && roles.includes(role))

  return (
    <nav
      className={`flex h-screen shrink-0 flex-col justify-between bg-[#231942] transition-[width] duration-200 ${
        open ? 'w-1/4' : 'w-16'
      }`}
    >
      <div>
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Collapse menu' : 'Expand menu'}
          className="flex h-16 w-16 items-center justify-center text-[#e0b1cb] hover:opacity-80"
        >
          <MenuIcon />
        </button>

        <ul className="mt-4 space-y-1">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-5 py-3 font-[var(--font-body)] text-sm transition-colors ${
                    active
                      ? 'bg-[#e0b1cb] text-[#231942]'
                      : 'text-[#e0b1cb]/70 hover:bg-[#9f86c0]/10 hover:text-[#e0b1cb]'
                  }`}
                >
                  <Icon />
                  {open && <span className="whitespace-nowrap">{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-5 py-4 font-[var(--font-body)] text-sm text-[#e0b1cb]/70 hover:bg-[#9f86c0]/10 hover:text-[#e0b1cb]"
      >
        <LogoutIcon />
        {open && <span>Log out</span>}
      </button>
    </nav>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 6l7-3 7 3-7 3-7-3z" strokeLinejoin="round" />
      <path d="M3 6v8l7 3 7-3V6" strokeLinejoin="round" />
      <path d="M10 9v8" />
    </svg>
  )
}

function PlusBoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 6l7-3 7 3-7 3-7-3z" strokeLinejoin="round" />
      <path d="M3 6v8l7 3 7-3V6" strokeLinejoin="round" />
      <path d="M10 11v5M7.5 13.5h5" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" strokeLinecap="round" />
    </svg>
  )
}

// Distinct from ClockIcon (History) — a simple receipt/list glyph for
// the customer-facing Order Status page.
function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 3h10v14l-2-1.3L11 17l-2-1.3L7 17l-2-1.3V3z" strokeLinejoin="round" />
      <path d="M7.5 7h5M7.5 10h5" strokeLinecap="round" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 3H4v14h4" strokeLinecap="round" />
      <path d="M13 6l4 4-4 4M17 10H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
