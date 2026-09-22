'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      {/* Top title — bigger, SemiBold like the logo mark below it */}
      <span className="absolute left-8 top-8 z-10 font-[var(--font-title)] text-3xl font-semibold tracking-wide text-[#e0b1cb]">
        Warehouse Shortest Path Simulator
      </span>

      {/* Left panel — brand side */}
      <div className="flex w-1/2 items-center justify-center bg-[#231942]">
        <RouteMark />
      </div>

      {/* Right panel — login form */}
      <div className="flex w-1/2 items-center justify-center bg-[#f2e9e4]">
        <form onSubmit={handleSubmit} className="w-full max-w-sm px-8">
          <h1 className="mb-8 font-[var(--font-title)] text-3xl font-medium text-[#231942]">
            Sign in
          </h1>

          <label htmlFor="email" className="mb-1 block text-sm text-[#231942]">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-sm border border-[#4a4e69]/40 bg-white/60 px-3 py-2 font-[var(--font-body)] text-[#22223b] outline-none focus:border-[#4a4e69] focus:ring-2 focus:ring-[#4a4e69]/30"
          />

          <label htmlFor="password" className="mb-1 block text-sm text-[#231942]">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-sm border border-[#4a4e69]/40 bg-white/60 px-3 py-2 font-[var(--font-body)] text-[#22223b] outline-none focus:border-[#4a4e69] focus:ring-2 focus:ring-[#4a4e69]/30"
          />

          {error && (
            <p role="alert" className="mb-4 text-sm text-[#ce4257]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-[#231942] py-2.5 text-sm font-medium text-[#e0b1cb] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Enlarged route/path logo mark (was 140px, now 220px)
function RouteMark() {
  return (
    <svg width="220" height="220" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <path
        d="M10 54 L28 54 L28 30 L46 30 L46 14 L62 14"
        stroke="#f5ebfa"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="54" r="5" fill="#c085e0" />
      <circle cx="46" cy="30" r="5" fill="#d5adeb" />
      <circle cx="62" cy="14" r="5" fill="#ead6f5" />
    </svg>
  )
}
