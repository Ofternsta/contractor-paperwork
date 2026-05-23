import { NextResponse } from 'next/server'
import {
  parseBillingPlan,
  setupAdminSubscription,
} from '@/lib/admin-billing-setup'
import {
  ensureUserProfile,
  type SignupMetadata,
} from '@/lib/complete-signup-server'
import type { AppRole } from '@/lib/roles'
import { requireAuth } from '@/lib/require-auth'

async function adminNeedsBilling(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  organizationId: string
) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('organization_id', organizationId)
    .maybeSingle()

  return !sub || sub.status === 'pending'
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const metadata = (user.user_metadata || {}) as SignupMetadata

    const result = await ensureUserProfile(supabase, user.id, metadata, {
      role: body.role as AppRole | undefined,
      fullName: body.full_name as string | undefined,
      organizationName: body.organization_name as string | undefined,
      inviteCode: body.invite_code as string | undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role as AppRole | undefined
    let checkoutUrl: string | null = null

    if (role === 'admin') {
      const billingPlan = parseBillingPlan(
        body.billing_plan ?? metadata.billing_plan
      )

      let organizationId = result.organizationId

      if (!organizationId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('admin_user_id', user.id)
          .maybeSingle()
        organizationId = org?.id
      }

      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization not found for admin account.' },
          { status: 400 }
        )
      }

      const needsBilling = await adminNeedsBilling(supabase, organizationId)

      if (needsBilling) {
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('plan')
          .eq('organization_id', organizationId)
          .maybeSingle()

        const planToUse =
          billingPlan ?? parseBillingPlan(existingSub?.plan ?? undefined)

        if (!planToUse) {
          return NextResponse.json(
            { error: 'Select a subscription plan to continue.' },
            { status: 400 }
          )
        }

        const billing = await setupAdminSubscription(supabase, {
          organizationId,
          email: user.email,
          plan: planToUse,
          successPath: '/?welcome=1',
          cancelPath: '/settings/billing?canceled=1&setup=1',
        })

        if (billing.error) {
          return NextResponse.json({ error: billing.error }, { status: 400 })
        }

        checkoutUrl = billing.checkoutUrl ?? null
      }
    }

    return NextResponse.json({
      ok: true,
      created: result.created,
      role: profile?.role ?? null,
      checkoutUrl,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
