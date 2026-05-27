import 'server-only'

import { emailVerificationRedirectUrl } from '@/lib/auth-redirect'
import { normalizeSignupEmail } from '@/lib/trial-eligibility'
import { createServiceClient } from '@/lib/supabase/service'

/** Send Supabase signup confirmation email (user must verify before sign-in). */
export async function sendSignupConfirmationEmail(
  email: string,
  options?: { nextPath?: string }
) {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)

  const { error } = await service.auth.resend({
    type: 'signup',
    email: normalized,
    options: {
      emailRedirectTo: emailVerificationRedirectUrl(
        options?.nextPath ?? '/login?verified=1'
      ),
    },
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}
