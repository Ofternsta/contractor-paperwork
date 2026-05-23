import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import {
  BILLING_PLANS,
  type BillingPlanId,
  billingAppUrl,
  isStripeConfigured,
  stripePriceIds,
} from '@/lib/stripe-config'

export function parseBillingPlan(raw: unknown): BillingPlanId | null {
  if (typeof raw !== 'string') return null
  if (raw in BILLING_PLANS) return raw as BillingPlanId
  return null
}

export async function setupAdminSubscription(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    email: string | undefined
    plan: BillingPlanId
    successPath?: string
    cancelPath?: string
  }
): Promise<{ checkoutUrl?: string | null; error?: string | null }> {
  const { organizationId, email, plan } = input
  const appUrl = billingAppUrl()
  const successPath = input.successPath ?? '/settings/billing?success=1'
  const cancelPath = input.cancelPath ?? '/settings/billing?canceled=1&setup=1'

  if (plan === 'trial') {
    const { error } = await supabase.from('subscriptions').upsert(
      {
        organization_id: organizationId,
        plan: 'trial',
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )
    return { error: error?.message ?? null }
  }

  if (!isStripeConfigured()) {
    return {
      error:
        'Paid plans require Stripe. Choose Trial or configure Stripe — see STRIPE.md.',
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!
  const priceId = stripePriceIds()[plan]
  if (!priceId) {
    return { error: `Stripe price not configured for ${plan}.` }
  }

  const stripe = new Stripe(stripeKey)

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (existing?.status === 'active') {
    return { error: 'Subscription is already active. Change plan from Billing settings.' }
  }

  let customerId = existing?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { organization_id: organizationId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}${successPath.startsWith('/') ? successPath : `/${successPath}`}`,
    cancel_url: `${appUrl}${cancelPath.startsWith('/') ? cancelPath : `/${cancelPath}`}`,
    metadata: { organization_id: organizationId, plan },
    subscription_data: {
      metadata: { organization_id: organizationId, plan },
    },
  })

  const { error } = await supabase.from('subscriptions').upsert(
    {
      organization_id: organizationId,
      plan,
      status: 'pending',
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )

  if (error) return { error: error.message }

  return { checkoutUrl: session.url, error: null }
}
