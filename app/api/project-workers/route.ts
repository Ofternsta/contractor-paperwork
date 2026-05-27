import { NextResponse } from 'next/server'
import {
  listProjectWorkersForAdmin,
  setProjectWorkerAssignments,
} from '@/lib/project-worker-assignments'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = new URL(req.url).searchParams.get('project_id')?.trim()
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const result = await listProjectWorkersForAdmin(supabase, projectId, user.id)
    if ('error' in result) {
      const status = result.error === 'Forbidden' ? 403 : 404
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ workers: result.workers })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to load worker assignments'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const projectId = String(body.project_id || '').trim()
    const userIds = Array.isArray(body.user_ids)
      ? (body.user_ids as string[]).map(String)
      : []

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const result = await setProjectWorkerAssignments(
      supabase,
      projectId,
      user.id,
      userIds
    )

    if (result.error) {
      const status =
        result.error === 'Forbidden'
          ? 403
          : result.error === 'Project not found'
            ? 404
            : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update worker assignments'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
