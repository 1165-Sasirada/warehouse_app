import type { User } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

export type AppRole = 'customer' | 'picker' | 'manager'

export interface AuthenticatedAppUser {
  user: User
  role: AppRole
}

export class RequestAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'RequestAuthError'
  }
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedAppUser> {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) {
    throw new RequestAuthError('Sign in before submitting an order.', 401)
  }

  const supabase = createSupabaseAdminClient()
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !authData.user) {
    throw new RequestAuthError('Your session is invalid or expired. Sign in again.', 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Unable to load the authenticated user profile:', profileError)
    throw new Error('Unable to verify your account role.')
  }

  if (!profile || !['customer', 'picker', 'manager'].includes(profile.role)) {
    throw new RequestAuthError('Your account does not have a supported role.', 403)
  }

  return { user: authData.user, role: profile.role as AppRole }
}
