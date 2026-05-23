import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { ensureUserProfile } from '@/lib/complete-signup-server'
import {
  decryptSignupPassword,
  encryptSignupPassword,
} from '@/lib/signup-crypto'
import { registerPaymentFingerprintTrial } from '@/lib/stripe-payment-fingerprint'
import {
  normalizeSignupEmail,
  registerEmailTrial,
  trialSignupBlocked,
} from '@/lib/trial-eligibility'
import {
  type BillingPlanId,
  billingAppUrl,
  isStripeConfigured,
  stripePriceIds,
} from '@/lib/stripe-config'
import { createServiceClient } from '@/lib/supabase/service'

export type RegisterAdminInput = {
  email: string
  password: string
  fullName?: string
  organizationName: string
  plan: BillingPlanId
}

export type FulfillPendingOptions = {
  paymentMethodFingerprint?: string | null
  stripeCustomerId?: string | null
  /** Allow fulfillment when checkout completed but the 2h pending row expired */
  allowExpired?: boolean
}

async function authUserExists(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const normalized = normalizeSignupEmail(email)
  const { data, error } = await supabase.rpc('get_auth_user_id_by_email', {
    user_email: normalized,
  })
  if (error) {
    const service = createServiceClient()
    const { data: users, error: listError } = await service.auth.admin.listUsers(
      { page: 1, perPage: 200 }
    )
    if (listError) throw new Error(listError.message)
    return (users.users || []).some(
      (u) => u.email?.toLowerCase() === normalized
    )
  }
  return Boolean(data)
}

async function insertPendingSignup(input: RegisterAdminInput) {
  const service = createServiceClient()
  const email = normalizeSignupEmail(input.email)

  if (await authUserExists(service, email)) {
    return { error: 'An account with this email already exists. Sign in instead.' }
  }

  const emailBlock = await trialSignupBlocked({ email })
  if (input.plan === 'trial' && emailBlock.blocked) {
    return { error: emailBlock.reason }
  }

  let passwordEncrypted: string
  try {
    passwordEncrypted = encryptSignupPassword(input.password)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Encryption failed'
    return { error: message }
  }

  const { data: pending, error: pendingError } = await service
    .from('pending_admin_signups')
    .insert({
      email,
      password_encrypted: passwordEncrypted,
      full_name: input.fullName?.trim() || null,
      organization_name: input.organizationName.trim() || 'My Company',
      plan: input.plan,
    })
    .select('id')
    .single()

  if (pendingError || !pending) {
    const msg = pendingError?.message || 'Could not start signup'
    if (msg.includes('permission denied') && msg.includes('pending_admin_signups')) {
      return {
        error:
          'Database permissions missing. Run supabase/signup-table-grants.sql in Supabase SQL Editor, and set SUPABASE_SERVICE_ROLE_KEY on Vercel.',
      }
    }
    return { error: msg }
  }

  await service
    .from('pending_admin_signups')
    .update({ expires_at: new Date().toISOString() })
    .eq('email', email)
    .is('consumed_at', null)
    .neq('id', pending.id)

  return { pendingId: pending.id as string, email }
}

export async function startTrialAdminSignupCheckout(input: RegisterAdminInput) {
  if (!isStripeConfigured()) {
    return {
      error:
        'Free trial requires Stripe (to verify a payment method). Configure Stripe or choose a paid plan.',
    }
  }

  const pending = await insertPendingSignup(input)
  if ('error' in pending) return { error: pending.error }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const appUrl = billingAppUrl()

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer_email: pending.email,
    payment_method_types: ['card'],
    success_url: `${appUrl}/login?registered=1&trial=1&email=${encodeURIComponent(pending.email)}`,
    cancel_url: `${appUrl}/onboarding/subscription?register=1&canceled=1`,
    metadata: {
      pending_signup_id: pending.pendingId,
      plan: 'trial',
    },
  })

  if (session.id) {
    const { error: sessionIdError } = await createServiceClient()
      .from('pending_admin_signups')
      .update({ stripe_session_id: session.id })
      .eq('id', pending.pendingId)
    if (sessionIdError) {
      console.error('pending_admin_signups stripe_session_id update:', sessionIdError)
    }
  }

  return { checkoutUrl: session.url }
}

export async function startPaidAdminSignupCheckout(input: RegisterAdminInput) {
  if (input.plan === 'trial') {
    return { error: 'Use trial checkout for free trial.' }
  }

  if (!isStripeConfigured()) {
    return { error: 'Paid plans require Stripe configuration.' }
  }

  const priceId = stripePriceIds()[input.plan]
  if (!priceId) {
    return { error: `Stripe price not configured for ${input.plan}.` }
  }

  const pending = await insertPendingSignup(input)
  if ('error' in pending) return { error: pending.error }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const appUrl = billingAppUrl()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: pending.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/login?registered=1&email=${encodeURIComponent(pending.email)}`,
    cancel_url: `${appUrl}/onboarding/subscription?register=1&canceled=1`,
    metadata: {
      pending_signup_id: pending.pendingId,
      plan: input.plan,
    },
    subscription_data: {
      metadata: {
        pending_signup_id: pending.pendingId,
        plan: input.plan,
      },
    },
  })

  if (session.id) {
    const { error: sessionIdError } = await createServiceClient()
      .from('pending_admin_signups')
      .update({ stripe_session_id: session.id })
      .eq('id', pending.pendingId)
    if (sessionIdError) {
      console.error('pending_admin_signups stripe_session_id update:', sessionIdError)
    }
  }

  return { checkoutUrl: session.url }
}

export async function fulfillPendingAdminSignup(
  pendingSignupId: string,
  options: FulfillPendingOptions = {}
) {
  const service = createServiceClient()

  const { data: pending, error } = await service
    .from('pending_admin_signups')
    .select('*')
    .eq('id', pendingSignupId)
    .maybeSingle()

  if (error || !pending) {
    throw new Error('Pending signup not found')
  }

  if (pending.consumed_at) {
    return { alreadyConsumed: true as const }
  }

  if (
    !options.allowExpired &&
    new Date(pending.expires_at).getTime() < Date.now()
  ) {
    throw new Error('Pending signup expired')
  }

  const email = normalizeSignupEmail(pending.email)
  const plan = pending.plan as BillingPlanId
  const isTrial = plan === 'trial'

  const block = await trialSignupBlocked({
    email,
    paymentFingerprint: options.paymentMethodFingerprint,
  })

  if (isTrial && block.blocked) {
    throw new Error(block.reason || 'Trial not available')
  }

  if (await authUserExists(service, email)) {
    await service
      .from('pending_admin_signups')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', pendingSignupId)
    return { alreadyConsumed: true as const }
  }

  if (!pending.password_encrypted?.trim()) {
    throw new Error(
      'Signup password data is missing. Sign up again with a new email.'
    )
  }

  let password: string
  try {
    password = decryptSignupPassword(pending.password_encrypted)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Decrypt failed'
    throw new Error(
      `Could not restore signup password (${message}). Ensure PENDING_SIGNUP_SECRET matches the value used at signup.`
    )
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        full_name: pending.full_name,
        organization_name: pending.organization_name,
      },
    })

  if (createError || !created.user) {
    throw new Error(createError?.message || 'Could not create account')
  }

  const userId = created.user.id

  const profileResult = await ensureUserProfile(
    service,
    userId,
    {
      role: 'admin',
      full_name: pending.full_name ?? undefined,
      organization_name: pending.organization_name,
    },
    {
      role: 'admin',
      organizationName: pending.organization_name,
    }
  )

  if (profileResult.error || !profileResult.organizationId) {
    await service.auth.admin.deleteUser(userId)
    throw new Error(profileResult.error || 'Could not set up organization')
  }

  let trialEndsAt: string | null = null

  if (isTrial) {
    trialEndsAt = await registerEmailTrial(email)
    if (options.paymentMethodFingerprint) {
      await registerPaymentFingerprintTrial(
        options.paymentMethodFingerprint,
        email,
        trialEndsAt
      )
    }
  }

  const { error: subError } = await service.from('subscriptions').upsert(
    {
      organization_id: profileResult.organizationId,
      plan,
      status: isTrial ? 'trialing' : 'active',
      trial_ends_at: trialEndsAt,
      stripe_customer_id: options.stripeCustomerId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )

  if (subError) {
    await service.auth.admin.deleteUser(userId)
    throw new Error(subError.message)
  }

  await service
    .from('pending_admin_signups')
    .update({
      consumed_at: new Date().toISOString(),
      password_encrypted: '',
    })
    .eq('id', pendingSignupId)

  return { ok: true as const, organizationId: profileResult.organizationId, plan }
}
