import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

/** GET pending workers for admin's organization */
export async function GET() {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, invite_code')
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Not an organization admin' }, { status: 403 })
  }

  const { data: pending, error } = await supabase
    .from('organization_members')
    .select('id, user_id, status, created_at')
    .eq('organization_id', org.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (pending || []).map((p) => p.user_id)
  let names: Record<string, string | null> = {}

  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    names = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p.full_name])
    )
  }

  const enriched = (pending || []).map((p) => ({
    ...p,
    full_name: names[p.user_id] ?? null,
  }))

  return NextResponse.json({ organization: org, pending: enriched })
}

/** POST approve or reject a worker { member_id, action: 'approve' | 'reject' } */
export async function POST(req: Request) {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const memberId = body.member_id as string
  const action = body.action as string

  if (!memberId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id, organization_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', member.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('organization_members')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approved_at: action === 'approve' ? new Date().toISOString() : null,
      approved_by: action === 'approve' ? user.id : null,
    })
    .eq('id', memberId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
