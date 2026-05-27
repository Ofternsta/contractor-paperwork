import 'server-only'

import { billingAppUrl } from '@/lib/stripe-config'

/** Display name in the inbox (e.g. "LedgerStack auth"). */
export function authEmailSenderName(): string {
  return process.env.AUTH_EMAIL_SENDER_NAME?.trim() || 'LedgerStack auth'
}

/** From address — must be verified in Resend or Supabase SMTP. */
export function authEmailFromAddress(): string {
  return (
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    'noreply@ledgerstack.org'
  )
}

export function authEmailFromHeader(): string {
  return `${authEmailSenderName()} <${authEmailFromAddress()}>`
}

export function authEmailAppName(): string {
  return process.env.AUTH_EMAIL_APP_NAME?.trim() || 'LedgerStack'
}

export function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined
}

export function useCustomAuthEmail(): boolean {
  return Boolean(resendApiKey())
}

export function authEmailLogoUrl(): string {
  const appUrl = billingAppUrl()
  return `${appUrl}/icon.png`
}
