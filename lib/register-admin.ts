import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { setupAdminOrganizationAfterStripe } from '@/lib/admin-signup-setup'
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
import { type BillingPlanId, isStripeConfigured } from '@/lib/stripe-config'
import {
  createStripeCheckoutSession,
  createStripeClient,
  type CheckoutUiMode,
} from '@/lib/stripe-checkout-sessions'
import { sendSignupConfirmationEmail } from '@/lib/auth-email'
import {
  getAuthUserIdByEmail,
  getAuthUserSummaryByEmail,
} from '@/lib/auth-user-lookup'
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

async function upsertPendingSignupRow(input: RegisterAdminInput) {
  const service = createServiceClient()
  const email = normalizeSignupEmail(input.email)

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

  const { data: existingPending } = await service
    .from('pending_admin_signups')
    .select('id')
    .eq('email', email)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPending?.id) {
    const { error } = await service
      .from('pending_admin_signups')
      .update({
        password_encrypted: passwordEncrypted,
        full_name: input.fullName?.trim() || null,
        organization_name: input.organizationName.trim() || 'My Company',
        plan: input.plan,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', existingPending.id)

    if (error) return { error: error.message }
    return { pendingId: existingPending.id as string, email }
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
    return { error: pendingError?.message || 'Could not save signup' }
  }

  return { pendingId: pending.id as string, email }
}

function signupCheckoutVerifyNextPath(plan: BillingPlanId) {
  return `/checkout?plan=${encodeURIComponent(plan)}&register=1`
}

/** Create account + pending signup if needed; require email verification before Stripe. */
export async function prepareAdminCheckoutVerification(
  input: RegisterAdminInput
): Promise<
  | { emailVerified: true; email: string }
  | { emailVerified: false; email: string; message: string }
  | { error: string }
> {
  const email = normalizeSignupEmail(input.email)
  const service = createServiceClient()

  const summary = await getAuthUserSummaryByEmail(email)
  if (summary?.emailConfirmed) {
    return { emailVerified: true, email }
  }

  if (summary && !summary.emailConfirmed) {
    const pending = await upsertPendingSignupRow(input)
    if ('error' in pending && pending.error) {
      return { error: pending.error }
    }
    const sent = await sendSignupConfirmationEmail(email, {
      nextPath: signupCheckoutVerifyNextPath(input.plan),
    })
    if (!sent.ok) return { error: sent.error || 'Could not send verification email' }
    return {
      emailVerified: false,
      email,
      message:
        'Verify your email before checkout. Open the confirmation link we sent to your inbox.',
    }
  }

  const pending = await insertPendingSignup(input)
  if ('error' in pending && pending.error) {
    return { error: pending.error }
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
      user_metadata: {
        role: 'admin',
        full_name: input.fullName?.trim() || null,
        organization_name: input.organizationName.trim() || 'My Company',
      },
    })

  if (createError || !created.user) {
    return { error: createError?.message || 'Could not create account' }
  }

  const sent = await sendSignupConfirmationEmail(email, {
    nextPath: signupCheckoutVerifyNextPath(input.plan),
  })
  if (!sent.ok) {
    return { error: sent.error || 'Could not send verification email' }
  }

  return {
    emailVerified: false,
    email,
    message:
      'Verify your email before checkout. Open the confirmation link we sent to your inbox.',
  }
}

export async function startTrialAdminSignupCheckout(
  input: RegisterAdminInput,
  uiMode: CheckoutUiMode = 'hosted'
) {
  if (!isStripeConfigured()) {
    return {
      error:
        'Free trial requires Stripe (to verify a card). Configure Stripe or choose a paid plan.',
    }
  }

  const pending = await insertPendingSignup(input)
  if ('error' in pending) return { error: pending.error }

  const stripe = createStripeClient()
  const session = await createStripeCheckoutSession(stripe, {
    uiMode,
    plan: 'trial',
    customerEmail: pending.email,
    successUrl: `/login?registered=1&trial=1&email=${encodeURIComponent(pending.email)}`,
    cancelUrl: '/onboarding/subscription?register=1&canceled=1',
    metadata: {
      pending_signup_id: pending.pendingId,
      plan: 'trial',
    },
  })

  await savePendingStripeSession(pending.pendingId, session.sessionId)

  return {
    checkoutUrl: session.checkoutUrl,
    clientSecret: session.clientSecret,
    sessionId: session.sessionId,
  }
}

async function savePendingStripeSession(pendingId: string, sessionId: string) {
  const { error: sessionIdError } = await createServiceClient()
    .from('pending_admin_signups')
    .update({ stripe_session_id: sessionId })
    .eq('id', pendingId)
  if (sessionIdError) {
    console.error('pending_admin_signups stripe_session_id update:', sessionIdError)
  }
}

export async function startPaidAdminSignupCheckout(
  input: RegisterAdminInput,
  uiMode: CheckoutUiMode = 'hosted'
) {
  if (input.plan === 'trial') {
    return { error: 'Use trial checkout for free trial.' }
  }

  if (!isStripeConfigured()) {
    return { error: 'Paid plans require Stripe configuration.' }
  }

  const pending = await insertPendingSignup(input)
  if ('error' in pending) return { error: pending.error }

  const stripe = createStripeClient()
  const session = await createStripeCheckoutSession(stripe, {
    uiMode,
    plan: input.plan,
    customerEmail: pending.email,
    successUrl: `/login?registered=1&email=${encodeURIComponent(pending.email)}`,
    cancelUrl: '/onboarding/subscription?register=1&canceled=1',
    metadata: {
      pending_signup_id: pending.pendingId,
      plan: input.plan,
    },
    subscriptionMetadata: {
      pending_signup_id: pending.pendingId,
      plan: input.plan,
    },
  })

  await savePendingStripeSession(pending.pendingId, session.sessionId)

  return {
    checkoutUrl: session.checkoutUrl,
    clientSecret: session.clientSecret,
    sessionId: session.sessionId,
  }
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

  const existingUserId = await getAuthUserIdByEmail(email)
  if (existingUserId) {
    const profileResult = await setupAdminOrganizationAfterStripe(
      service,
      existingUserId,
      {
        fullName: pending.full_name,
        organizationName: pending.organization_name,
      }
    )

    if (profileResult.error) {
      throw new Error(profileResult.error)
    }

    if (profileResult.organizationId) {
      const { error: subError } = await service.from('subscriptions').upsert(
        {
          organization_id: profileResult.organizationId,
          plan,
          status: isTrial ? 'trialing' : 'active',
          trial_ends_at: isTrial ? await registerEmailTrial(email) : null,
          stripe_customer_id: options.stripeCustomerId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      )
      if (subError) throw new Error(subError.message)
    }

    await service
      .from('pending_admin_signups')
      .update({
        consumed_at: new Date().toISOString(),
        password_encrypted: '',
      })
      .eq('id', pendingSignupId)

    await sendSignupConfirmationEmail(email)
    return { ok: true as const, organizationId: profileResult.organizationId, plan }
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
      email_confirm: false,
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

  const profileResult = await setupAdminOrganizationAfterStripe(service, userId, {
    fullName: pending.full_name,
    organizationName: pending.organization_name,
  })

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

  await sendSignupConfirmationEmail(email)

  return { ok: true as const, organizationId: profileResult.organizationId, plan }
}
