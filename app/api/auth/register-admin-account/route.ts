import { NextResponse } from 'next/server'
import { parseBillingPlan } from '@/lib/admin-billing-setup'
import { validatePassword } from '@/lib/password-policy'
import {
  prepareAdminCheckoutVerification,
  type RegisterAdminInput,
} from '@/lib/register-admin'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
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

    if (!input.email || !input.password || !input.organizationName) {
      return NextResponse.json(
        { error: 'Email, password, and company name are required.' },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(input.password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const result = await prepareAdminCheckoutVerification(input)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (result.emailVerified) {
      return NextResponse.json({ emailVerified: true, email: result.email })
    }

    return NextResponse.json({
      emailVerified: false,
      email: result.email,
      message: result.message,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
