import { NextResponse } from 'next/server'
import { assertCanAddWorker } from '@/lib/plan-enforcement'
import { transferOrgAdmin } from '@/lib/transfer-org-admin'
import { requireAuth } from '@/lib/require-auth'
import { normalizeJobTitle } from '@/lib/worker-job-titles'

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

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: approved } = await supabase
    .from('organization_members')
    .select(
      'id, user_id, status, created_at, job_title, can_upload, can_delete, can_add_events, can_view_files'
    )
    .eq('organization_id', org.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  const approvedIds = (approved || []).map((p) => p.user_id)
  let approvedNames: Record<string, string | null> = {}

  if (approvedIds.length) {
    const { data: approvedProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', approvedIds)

    approvedNames = Object.fromEntries(
      (approvedProfiles || []).map((p) => [p.id, p.full_name])
    )
  }

  const enrichedApproved = (approved || []).map((p) => ({
    ...p,
    full_name: approvedNames[p.user_id] ?? null,
  }))

  return NextResponse.json({
    organization: org,
    admin: {
      user_id: user.id,
      full_name: adminProfile?.full_name ?? null,
    },
    pending: enriched,
    approved: enrichedApproved,
  })
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

  if (action === 'promote_admin') {
    if (!memberId) {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    }

    const result = await transferOrgAdmin(supabase, user.id, memberId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

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

  if (action === 'approve') {
    const workerCheck = await assertCanAddWorker(supabase, member.organization_id)
    if (!workerCheck.ok) {
      return NextResponse.json({ error: workerCheck.error }, { status: 403 })
    }
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

/** PATCH update worker permissions and/or job title */
export async function PATCH(req: Request) {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const memberId = String(body.member_id || '').trim()
  const permissions = body.permissions as Record<string, boolean> | undefined
  const hasTitle = body.job_title !== undefined

  if (!memberId || (!permissions && !hasTitle)) {
    return NextResponse.json(
      { error: 'member_id and permissions or job_title are required' },
      { status: 400 }
    )
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id, organization_id, status')
    .eq('id', memberId)
    .maybeSingle()

  if (!member || member.status !== 'approved') {
    return NextResponse.json({ error: 'Approved worker not found' }, { status: 404 })
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

  const update: Record<string, unknown> = {}
  if (permissions) {
    update.can_upload = Boolean(permissions.can_upload)
    update.can_delete = Boolean(permissions.can_delete)
    update.can_add_events = Boolean(permissions.can_add_events)
    update.can_view_files = Boolean(permissions.can_view_files)
  }
  if (hasTitle) {
    update.job_title = normalizeJobTitle(String(body.job_title ?? ''))
  }

  const { error } = await supabase
    .from('organization_members')
    .update(update)
    .eq('id', memberId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
