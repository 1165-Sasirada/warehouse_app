import { createClient } from '@supabase/supabase-js'

// NOTE: In Next.js, any env var used in client-side (browser) code
// MUST be prefixed with NEXT_PUBLIC_ or it will be undefined here.
// Set these in .env.local (local dev) and in Vercel → Settings →
// Environment Variables (production/preview).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
