import { NextResponse } from 'next/server'
import {
  parseBillingPlan,
  setupAdminSubscription,
} from '@/lib/admin-billing-setup'
import { requireAuth } from '@/lib/require-auth'
import {
  BILLING_PLANS,
  type BillingPlanId,
  isStripeConfigured,
} from '@/lib/stripe-config'

export async function GET() {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('admin_user_id', user.id)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle()

    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)

    const needsPlanSelection =
      !sub || (sub.status === 'pending' && sub.plan !== 'trial')

    return NextResponse.json({
      plans: BILLING_PLANS,
      subscription: sub,
      needsPlanSelection,
      projectCount: projectCount ?? 0,
      stripeConfigured: isStripeConfigured(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Billing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { plan: planRaw } = await req.json()
    const planId = parseBillingPlan(planRaw)

    if (!planId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('admin_user_id', user.id)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    const billing = await setupAdminSubscription(supabase, {
      organizationId: org.id,
      email: user.email,
      plan: planId,
    })

    if (billing.error) {
      const status =
        billing.error.includes('Stripe') || billing.error.includes('price')
          ? 503
          : 400
      return NextResponse.json({ error: billing.error }, { status })
    }

    if (billing.checkoutUrl) {
      return NextResponse.json({ checkoutUrl: billing.checkoutUrl })
    }

    return NextResponse.json({ ok: true, plan: planId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Billing update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
