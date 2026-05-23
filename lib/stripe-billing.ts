import 'server-only'

import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import {
  type BillingPlanId,
  planFromStripePriceId,
} from '@/lib/stripe-config'

type SubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  return 'canceled'
}

export async function upsertSubscriptionFromStripe(input: {
  organizationId: string
  plan: BillingPlanId
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  currentPeriodEnd?: string | null
}) {
  const supabase = createServiceClient()

  const { error } = await supabase.from('subscriptions').upsert(
    {
      organization_id: input.organizationId,
      plan: input.plan,
      status: input.status,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )

  if (error) throw new Error(error.message)
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  const organizationId =
    row?.organization_id ||
    (subscription.metadata?.organization_id as string | undefined)

  if (!organizationId) {
    console.warn(
      'Stripe subscription update: no organization for customer',
      customerId
    )
    return
  }

  const priceId = subscription.items.data[0]?.price?.id
  const planFromPrice = priceId ? planFromStripePriceId(priceId) : null
  const plan =
    planFromPrice ||
    (subscription.metadata?.plan as BillingPlanId | undefined) ||
    'starter'

  const periodEndUnix = subscription.items.data[0]?.current_period_end
  const periodEnd =
    typeof periodEndUnix === 'number'
      ? new Date(periodEndUnix * 1000).toISOString()
      : null

  await upsertSubscriptionFromStripe({
    organizationId,
    plan,
    status: mapStripeStatus(subscription.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEnd,
  })
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const organizationId = session.metadata?.organization_id
  const plan = session.metadata?.plan as BillingPlanId | undefined

  if (!organizationId || !plan) {
    console.warn('Checkout completed without organization_id or plan metadata')
    return
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  await upsertSubscriptionFromStripe({
    organizationId,
    plan,
    status: 'active',
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subscriptionId ?? null,
  })
}
