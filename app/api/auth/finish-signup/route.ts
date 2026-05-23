import { NextResponse } from 'next/server'
import { finishPendingSignup, getSignupStatus } from '@/lib/finish-pending-signup'

export async function GET(req: Request) {
  try {
    const email = new URL(req.url).searchParams.get('email')?.trim()
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const status = await getSignupStatus(email)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Status check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const result = await finishPendingSignup(email)
    if (result.error && !result.accountReady) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Finish signup failed'
    console.error('finish-signup error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
