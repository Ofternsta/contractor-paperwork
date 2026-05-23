import 'server-only'

import Stripe from 'stripe'
import {
  authUserExistsByEmail,
  getAuthUserSummaryByEmail,
} from '@/lib/auth-user-lookup'
import { sendSignupConfirmationEmail } from '@/lib/auth-email'
import { normalizeSignupEmail } from '@/lib/trial-eligibility'
import {
  fulfillPendingAdminSignup,
  type FulfillPendingOptions,
} from '@/lib/register-admin'
import { getCheckoutPaymentFingerprint } from '@/lib/stripe-payment-fingerprint'
import { createServiceClient } from '@/lib/supabase/service'

type PendingRow = {
  id: string
  expires_at: string
  consumed_at: string | null
  stripe_session_id: string | null
  plan: string
  created_at: string
}

async function loadPendingSignups(email: string) {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)

  const { data: pendings } = await service
    .from('pending_admin_signups')
    .select('id, expires_at, consumed_at, stripe_session_id, plan, created_at')
    .eq('email', normalized)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })

  return {
    service,
    normalized,
    pendings: (pendings || []) as PendingRow[],
  }
}

/** Scan Stripe for a completed checkout tied to any of this email's pending signup rows. */
async function findCompletedCheckoutForPendings(pendings: PendingRow[]) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || pendings.length === 0) return null

  const stripe = new Stripe(stripeKey)
  const pendingById = new Map(pendings.map((p) => [p.id, p]))

  for (const pending of pendings) {
    if (!pending.stripe_session_id) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(
        pending.stripe_session_id
      )
      if (session.status === 'complete') {
        return { session, pending }
      }
    } catch (err) {
      console.error('retrieve checkout session failed:', err)
    }
  }

  const pendingIds = new Set(pendings.map((p) => p.id))
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const page = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
    })

    for (const session of page.data) {
      if (session.status !== 'complete') continue
      const pendingId = session.metadata?.pending_signup_id
      if (!pendingId || !pendingIds.has(pendingId)) continue
      const pending = pendingById.get(pendingId)!
      return { session, pending }
    }

    hasMore = page.has_more
    startingAfter = page.data.at(-1)?.id
    if (!startingAfter) break
  }

  return null
}

export async function getSignupStatus(email: string) {
  const { normalized, pendings } = await loadPendingSignups(email)

  const existing = await getAuthUserSummaryByEmail(normalized)
  if (existing?.emailConfirmed) {
    return { accountReady: true as const, email: normalized }
  }
  if (existing) {
    return {
      accountReady: false as const,
      needsEmailVerification: true as const,
      email: normalized,
      message:
        'Verify your email before signing in. Use Resend verification below if needed.',
    }
  }

  if (pendings.length === 0) {
    const service = createServiceClient()
    const { data: consumed } = await service
      .from('pending_admin_signups')
      .select('id, consumed_at, plan')
      .eq('email', normalized)
      .not('consumed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      accountReady: false as const,
      email: normalized,
      pending: false,
      lastSignupConsumed: Boolean(consumed),
      message: consumed
        ? 'Signup was marked complete but no auth user exists. Use Complete setup or contact support.'
        : 'No pending signup found. Complete Stripe checkout first.',
    }
  }

  const match = await findCompletedCheckoutForPendings(pendings)
  const latest = pendings[0]
  const latestExpired =
    new Date(latest.expires_at).getTime() < Date.now() && !match

  return {
    accountReady: false as const,
    email: normalized,
    pending: true,
    pendingSignupId: latest.id,
    pendingCount: pendings.length,
    plan: latest.plan,
    checkoutComplete: Boolean(match),
    matchedPendingSignupId: match?.pending.id ?? null,
    expired: latestExpired,
    message: match
      ? 'Payment complete — finishing your account…'
      : latestExpired
        ? 'Signup session expired. Open subscription again and complete Stripe checkout once.'
        : 'Waiting for Stripe checkout to finish…',
  }
}

/** Create auth user after Stripe checkout if webhook has not run yet. */
export async function finishPendingSignup(email: string) {
  const normalized = normalizeSignupEmail(email)

  const existing = await getAuthUserSummaryByEmail(normalized)
  if (existing?.emailConfirmed) {
    return { accountReady: true as const, email: normalized }
  }
  if (existing) {
    return {
      accountReady: false as const,
      needsEmailVerification: true as const,
      email: normalized,
      message:
        'Verify your email before signing in. Use Resend verification below if needed.',
    }
  }

  const { pendings } = await loadPendingSignups(email)

  if (pendings.length === 0) {
    return {
      accountReady: false as const,
      error:
        'No pending signup for this email. Sign up again and finish Stripe checkout.',
    }
  }

  if (!process.env.PENDING_SIGNUP_SECRET) {
    return {
      accountReady: false as const,
      error:
        'PENDING_SIGNUP_SECRET is not set on the server. Add it in Vercel and redeploy.',
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      accountReady: false as const,
      error:
        'SUPABASE_SERVICE_ROLE_KEY is not set on the server. Add it in Vercel and redeploy.',
    }
  }

  const match = await findCompletedCheckoutForPendings(pendings)

  if (!match) {
    const latest = pendings[0]
    const expired = new Date(latest.expires_at).getTime() < Date.now()
    return {
      accountReady: false as const,
      error: expired
        ? 'No completed Stripe payment found for this email (pending signup expired). Go to subscription, pick Enterprise again, and complete checkout once.'
        : 'Stripe checkout is not complete yet. Finish payment in Stripe, then try again.',
      pendingSignupId: latest.id,
      pendingCount: pendings.length,
    }
  }

  const { session, pending } = match
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const options: FulfillPendingOptions = {
    paymentMethodFingerprint: await getCheckoutPaymentFingerprint(
      stripe,
      session
    ),
    stripeCustomerId:
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id ?? null,
    allowExpired: true,
  }

  try {
    const result = await fulfillPendingAdminSignup(
      pending.id as string,
      options
    )
    if (result.alreadyConsumed && !(await authUserExistsByEmail(normalized))) {
      return {
        accountReady: false as const,
        error:
          'Signup was already processed but no user exists. Contact support with your email.',
      }
    }

    const service = createServiceClient()
    await service
      .from('pending_admin_signups')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', normalized)
      .is('consumed_at', null)
      .neq('id', pending.id)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    console.error('fulfillPendingAdminSignup failed:', err)

    if (message.includes('decrypt') || message.includes('PENDING_SIGNUP')) {
      return {
        accountReady: false as const,
        error:
          'Password could not be restored (PENDING_SIGNUP_SECRET may have changed). Sign up again with a new email.',
      }
    }

    return { accountReady: false as const, error: message }
  }

  const createdUser = await getAuthUserSummaryByEmail(normalized)
  if (createdUser?.emailConfirmed) {
    return { accountReady: true as const, email: normalized }
  }
  if (createdUser) {
    await sendSignupConfirmationEmail(normalized)
    return {
      accountReady: false as const,
      needsEmailVerification: true as const,
      email: normalized,
      message:
        'Account created. Open the verification link in your email, then sign in.',
    }
  }

  return {
    accountReady: false as const,
    error:
      'Setup ran but no auth user was created. Check Vercel logs for createUser errors.',
  }
}
