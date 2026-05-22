import { NextResponse } from 'next/server'
import {
  ensureUserProfile,
  type SignupMetadata,
} from '@/lib/complete-signup-server'
import type { AppRole } from '@/lib/roles'
import { requireAuth } from '@/lib/require-auth'

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

    return NextResponse.json({
      ok: true,
      created: result.created,
      role: profile?.role ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Setup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
