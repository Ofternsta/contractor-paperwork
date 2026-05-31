import { NextResponse } from 'next/server'
import {
  canAdminArchiveProject,
  requireExistingProject,
} from '@/lib/archive-access'
import { buildProjectArchiveZip } from '@/lib/build-project-archive'
import { getOrgPlanContext } from '@/lib/org-plan'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URL(req.url).searchParams
    const projectId = params.get('project_id')?.trim()

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    if (!(await canAdminArchiveProject(supabase, projectId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectRef = await requireExistingProject(supabase, projectId)
    if (!projectRef) {
      return NextResponse.json(
        { error: 'Project not found or has been deleted' },
        { status: 404 }
      )
    }

    const planCtx = await getOrgPlanContext(supabase, projectRef.organizationId)
    if (!planCtx) {
      return NextResponse.json(
        { error: 'Active subscription required to save project archives.' },
        { status: 403 }
      )
    }

    const canArchive =
      planCtx.entitlements.standardPdfExport ||
      planCtx.entitlements.claimPacketExport

    if (!canArchive) {
      return NextResponse.json(
        {
          error:
            'Project archives are not included on your plan. Upgrade to Starter or higher.',
        },
        { status: 403 }
      )
    }

    const { buffer, filename } = await buildProjectArchiveZip({
      supabase,
      projectId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Could not build project archive'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
