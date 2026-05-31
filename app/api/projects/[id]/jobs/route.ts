import { NextResponse } from 'next/server'
import { createJobForProject } from '@/lib/create-job-server'
import { loadUserAccessServer } from '@/lib/load-access-server'
import { requireAuth } from '@/lib/require-auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const { user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { access } = await loadUserAccessServer()
    if (!access?.canCreateProject || !access.organizationId) {
      return NextResponse.json(
        { error: 'You do not have permission to add jobs.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const jobDescription = String(
      body.job_description || body.jobDescription || body.notes || ''
    ).trim()

    const result = await createJobForProject(
      user.id,
      access.organizationId,
      projectId,
      jobDescription
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ job: result.job })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Add job failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
