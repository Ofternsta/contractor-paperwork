import { NextResponse } from 'next/server'
import { getProjectWorkerPermissions } from '@/lib/project-worker-assignments'
import { isOrganizationAdmin } from '@/lib/org-admin'
import { getProjectOrgId } from '@/lib/staff-project-access'
import { requireAuth } from '@/lib/require-auth'

/** Effective worker permissions on a single project (for project page UI). */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params
    const orgId = await getProjectOrgId(supabase, projectId)
    if (!orgId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (await isOrganizationAdmin(supabase, orgId, user.id)) {
      return NextResponse.json({ role: 'admin' })
    }

    const permissions = await getProjectWorkerPermissions(
      supabase,
      projectId,
      user.id
    )

    if (!permissions) {
      return NextResponse.json(
        { error: 'You are not assigned to this project.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ role: 'worker', permissions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Access check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
