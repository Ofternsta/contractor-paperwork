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

  let error: { message: string } | null = null

  try {
    const service = createServiceClient()
    const result = await service
      .from('project_client_access')
      .delete()
      .eq('id', accessId)
    error = result.error
  } catch (err: unknown) {
    const fallback = await supabase
      .from('project_client_access')
      .delete()
      .eq('id', accessId)
    error = fallback.error
    if (!error && err instanceof Error) {
      error = { message: err.message }
    }
  }

  if (error) {
    const msg = error.message
    if (msg.toLowerCase().includes('permission denied')) {
      return NextResponse.json(
        {
          error:
            'Could not revoke access. Run supabase/client-access-delete-grant.sql in the Supabase SQL Editor, then try again.',
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
