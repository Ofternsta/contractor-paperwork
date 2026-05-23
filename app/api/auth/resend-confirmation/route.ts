import { NextResponse } from 'next/server'
import { sendSignupConfirmationEmail } from '@/lib/auth-email'
import { normalizeSignupEmail } from '@/lib/trial-eligibility'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = normalizeSignupEmail(String(body.email || ''))

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const result = await sendSignupConfirmationEmail(email)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
