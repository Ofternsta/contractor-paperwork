import { NextResponse } from 'next/server'
import { requireOrgPlanFeature } from '@/lib/plan-guard'
import { requireAuth } from '@/lib/require-auth'
import { createServiceClient } from '@/lib/supabase/service'

/** GET client access rows for a project (admin only) */
export async function GET(req: Request) {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = new URL(req.url).searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', project.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('project_client_access')
    .select('id, client_email, user_id, status, created_at, approved_at')
    .eq('project_id', projectId)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ access: rows || [] })
}

/** POST grant client view access { project_id, client_email } */
export async function POST(req: Request) {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const projectId = body.project_id as string
  const clientEmail = (body.client_email as string)?.trim().toLowerCase()

  if (!projectId || !clientEmail) {
    return NextResponse.json(
      { error: 'project_id and client_email required' },
      { status: 400 }
    )
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', project.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const portalCheck = await requireOrgPlanFeature(
    supabase,
    project.organization_id,
    'clientPortal',
    'Client portal'
  )
  if (!portalCheck.ok) {
    return NextResponse.json({ error: portalCheck.error }, { status: 403 })
  }

  const { data: row, error } = await supabase
    .from('project_client_access')
    .upsert(
      {
        project_id: projectId,
        client_email: clientEmail,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      },
      { onConflict: 'project_id,client_email' }
    )
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, access_id: row.id })
}

/** DELETE revoke access { access_id } */
export async function DELETE(req: Request) {
  const { supabase, user } = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessId = new URL(req.url).searchParams.get('access_id')
  if (!accessId) {
    return NextResponse.json({ error: 'access_id required' }, { status: 400 })
  }

  const { data: access } = await supabase
    .from('project_client_access')
    .select('id, project_id')
    .eq('id', accessId)
    .maybeSingle()

  if (!access) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', access.project_id)
    .maybeSingle()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', project?.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use status update (UPDATE is granted + RLS-friendly); hard DELETE often blocked.
  const revokePayload = {
    status: 'rejected' as const,
    approved_at: null,
    approved_by: null,
  }

  let { data: revoked, error: revokeError } = await supabase
    .from('project_client_access')
    .update(revokePayload)
    .eq('id', accessId)
    .select('id')
    .maybeSingle()

  if (revokeError || !revoked) {
    try {
      const service = createServiceClient()
      const fallback = await service
        .from('project_client_access')
        .update(revokePayload)
        .eq('id', accessId)
        .select('id')
        .maybeSingle()
      revoked = fallback.data
      revokeError = fallback.error
    } catch (err: unknown) {
      if (!revokeError && err instanceof Error) {
        return NextResponse.json({ error: err.message }, { status: 500 })
      }
    }
  }

  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 })
  }

  if (!revoked) {
    return NextResponse.json({ error: 'Could not revoke access' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
