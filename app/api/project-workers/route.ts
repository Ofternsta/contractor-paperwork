import { NextResponse } from 'next/server'
import {
  listProjectWorkersForAdmin,
  setProjectWorkerAssignments,
  updateProjectWorkerPermissions,
} from '@/lib/project-worker-assignments'
import {
  DEFAULT_WORKER_PERMISSIONS,
  type WorkerPermissionKey,
  type WorkerPermissions,
} from '@/lib/worker-permissions'
import { requireAuth } from '@/lib/require-auth'

function parsePermissions(body: Record<string, unknown>): WorkerPermissions | null {
  const keys: WorkerPermissionKey[] = [
    'can_upload',
    'can_delete',
    'can_add_events',
    'can_view_files',
  ]
  if (!keys.every((k) => typeof body[k] === 'boolean')) return null
  return {
    can_upload: Boolean(body.can_upload),
    can_delete: Boolean(body.can_delete),
    can_add_events: Boolean(body.can_add_events),
    can_view_files: Boolean(body.can_view_files),
  }
}

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

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const projectId = String(body.project_id || '').trim()
    const workerUserId = String(body.user_id || '').trim()
    const permissions =
      parsePermissions(body.permissions as Record<string, unknown>) ||
      DEFAULT_WORKER_PERMISSIONS

    if (!projectId || !workerUserId) {
      return NextResponse.json(
        { error: 'project_id and user_id are required' },
        { status: 400 }
      )
    }

    const result = await updateProjectWorkerPermissions(
      supabase,
      projectId,
      user.id,
      workerUserId,
      permissions
    )

    if (result.error) {
      const status =
        result.error === 'Forbidden'
          ? 403
          : result.error.includes('not assigned')
            ? 404
            : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update permissions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
