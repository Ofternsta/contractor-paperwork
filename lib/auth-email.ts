import 'server-only'

import { billingAppUrl } from '@/lib/stripe-config'
import { normalizeSignupEmail } from '@/lib/trial-eligibility'
import { createServiceClient } from '@/lib/supabase/service'

export function emailVerificationRedirectUrl() {
  const appUrl = billingAppUrl()
  const next = encodeURIComponent('/login?verified=1')
  return `${appUrl}/auth/callback?next=${next}`
}

/** Send Supabase signup confirmation email (user must verify before sign-in). */
export async function sendSignupConfirmationEmail(email: string) {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)

  const { error } = await service.auth.resend({
    type: 'signup',
    email: normalized,
    options: {
      emailRedirectTo: emailVerificationRedirectUrl(),
    },
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}
