import { NextResponse } from 'next/server'
import { parseBillingPlan } from '@/lib/admin-billing-setup'
import { validatePassword } from '@/lib/password-policy'
import {
  startPaidAdminSignupCheckout,
  startTrialAdminSignupCheckout,
  type RegisterAdminInput,
} from '@/lib/register-admin'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const plan = parseBillingPlan(body.plan)

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const input: RegisterAdminInput = {
      email: String(body.email || '').trim(),
      password: String(body.password || ''),
      fullName: body.full_name as string | undefined,
      organizationName: String(body.organization_name || '').trim(),
      plan,
    }

    if (!input.email || !input.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(input.password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    if (!input.organizationName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    const result =
      plan === 'trial'
        ? await startTrialAdminSignupCheckout(input)
        : await startPaidAdminSignupCheckout(input)

    if (result.error) {
      const status =
        result.error.includes('Stripe') || result.error.includes('configure')
          ? 503
          : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ checkoutUrl: result.checkoutUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
