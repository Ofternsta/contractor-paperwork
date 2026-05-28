import { NextResponse } from 'next/server'
import { linkClientAccessByEmailServer } from '@/lib/link-client-access-server'
import { requireAuth } from '@/lib/require-auth'

/** Link approved client invites to the signed-in user (after login). */
export async function POST() {
  const { supabase, user } = await requireAuth()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await linkClientAccessByEmailServer(user.email, user.id, {
    userSupabase: supabase,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
