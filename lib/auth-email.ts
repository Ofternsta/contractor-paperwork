import 'server-only'

import { emailVerificationRedirectUrl } from '@/lib/auth-redirect'
import { useCustomAuthEmail } from '@/lib/auth-email-config'
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  sendTransactionalEmail,
} from '@/lib/transactional-email'
import { decryptSignupPassword } from '@/lib/signup-crypto'
import { normalizeSignupEmail } from '@/lib/trial-eligibility'
import { createServiceClient } from '@/lib/supabase/service'

async function pendingSignupPassword(email: string): Promise<string | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('pending_admin_signups')
    .select('password_encrypted')
    .eq('email', normalizeSignupEmail(email))
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const encrypted = data?.password_encrypted
  if (!encrypted || typeof encrypted !== 'string' || !encrypted.trim()) {
    return null
  }

  try {
    return decryptSignupPassword(encrypted)
  } catch {
    return null
  }
}

function isSupabaseEmailRateLimit(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('too many requests')
  )
}

function friendlyEmailError(message: string) {
  if (isSupabaseEmailRateLimit(message)) {
    return 'Too many verification emails were sent recently. Wait a few minutes and try again, or contact support if you are stuck.'
  }
  return message
}

async function sendViaSupabaseResend(
  email: string,
  nextPath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)

  const { error } = await service.auth.resend({
    type: 'signup',
    email: normalized,
    options: {
      emailRedirectTo: emailVerificationRedirectUrl(nextPath),
    },
  })

  if (error) {
    return { ok: false, error: friendlyEmailError(error.message) }
  }

  return { ok: true }
}

async function sendViaResendLink(
  email: string,
  nextPath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)
  const redirectTo = emailVerificationRedirectUrl(nextPath)
  const password = await pendingSignupPassword(normalized)

  const { data, error } = password
    ? await service.auth.admin.generateLink({
        type: 'signup',
        email: normalized,
        password,
        options: { redirectTo },
      })
    : await service.auth.admin.generateLink({
        type: 'magiclink',
        email: normalized,
        options: { redirectTo },
      })

  if (error) {
    if (isSupabaseEmailRateLimit(error.message)) {
      return { ok: false, error: friendlyEmailError(error.message) }
    }
    return { ok: false, error: error.message }
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    return { ok: false, error: 'Could not create verification link' }
  }

  const sent = await sendTransactionalEmail({
    to: normalized,
    subject: 'Confirm your LedgerStack email',
    html: buildVerificationEmailHtml({ confirmUrl: actionLink }),
    text: buildVerificationEmailText({ confirmUrl: actionLink }),
  })

  if (!sent.ok) {
    if (sent.reason === 'no_provider') {
      return sendViaSupabaseResend(email, nextPath)
    }
    return { ok: false, error: sent.error }
  }

  return { ok: true }
}

/** Send signup confirmation email (user must verify before sign-in). */
export async function sendSignupConfirmationEmail(
  email: string,
  options?: { nextPath?: string }
) {
  const nextPath = options?.nextPath ?? '/login?verified=1'

  if (useCustomAuthEmail()) {
    return sendViaResendLink(email, nextPath)
  }

  return sendViaSupabaseResend(email, nextPath)
}
