'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: MapIcon },
  { href: '/stock', label: 'Stock', icon: BoxIcon },
  { href: '/history', label: 'History', icon: ClockIcon },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
        className="flex items-center gap-3 px-5 py-4 font-[var(--font-body)] text-sm text-[#e0b1cb]/70 hover:bg-[#be95c4]/10 hover:text-[#e0b1cb]"
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

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" strokeLinecap="round" />
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
