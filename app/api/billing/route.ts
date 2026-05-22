import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

const PLANS = {
  trial: { name: 'Trial', price: 0, projects: 3 },
  starter: { name: 'Starter', price: 49, projects: 25 },
  professional: { name: 'Professional', price: 129, projects: 100 },
  enterprise: { name: 'Enterprise', price: 299, projects: -1 },
} as const

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

    return NextResponse.json({
      plans: PLANS,
      subscription: sub || {
        plan: 'trial',
        status: 'trialing',
        organization_id: org.id,
      },
      projectCount: projectCount ?? 0,
      stripeConfigured: Boolean(
        process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STARTER
      ),
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

    const { plan } = await req.json()
    if (!plan || !(plan in PLANS)) {
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

    const stripeKey = process.env.STRIPE_SECRET_KEY
    const priceMap: Record<string, string | undefined> = {
      starter: process.env.STRIPE_PRICE_STARTER,
      professional: process.env.STRIPE_PRICE_PROFESSIONAL,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    }

    if (plan !== 'trial' && stripeKey && priceMap[plan]) {
      let Stripe: typeof import('stripe').default
      try {
        Stripe = (await import('stripe')).default
      } catch {
        return NextResponse.json(
          {
            error:
              'Stripe package not installed. Run npm install, or choose trial plan.',
          },
          { status: 503 }
        )
      }
      const stripe = new Stripe(stripeKey)

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('organization_id', org.id)
        .maybeSingle()

      let customerId = existing?.stripe_customer_id

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { organization_id: org.id },
        })
        customerId = customer.id
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceMap[plan]!, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/billing?success=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/billing?canceled=1`,
        metadata: { organization_id: org.id, plan },
      })

      await supabase.from('subscriptions').upsert(
        {
          organization_id: org.id,
          plan,
          status: 'trialing',
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      )

      return NextResponse.json({ checkoutUrl: session.url })
    }

    await supabase.from('subscriptions').upsert(
      {
        organization_id: org.id,
        plan,
        status: plan === 'trial' ? 'trialing' : 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )

    return NextResponse.json({ ok: true, plan })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Billing update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
