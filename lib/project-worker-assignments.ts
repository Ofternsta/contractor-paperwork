import type { SupabaseClient } from '@supabase/supabase-js'
import { isOrganizationAdmin } from '@/lib/org-admin'
import { getProjectOrgId } from '@/lib/staff-project-access'
import { compareByWorkerName } from '@/lib/sort-team-members'
import {
  DEFAULT_WORKER_PERMISSIONS,
  parseWorkerPermissions,
  type WorkerPermissions,
} from '@/lib/worker-permissions'

export type ProjectWorkerRow = {
  user_id: string
  full_name: string | null
  job_title: string | null
  assigned: boolean
  assignment_id: string | null
  permissions: WorkerPermissions
}

type AssignmentRow = {
  id: string
  user_id: string
  can_upload: boolean
  can_delete: boolean
  can_add_events: boolean
  can_view_files: boolean
}

export async function isWorkerAssignedToProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('project_worker_assignments')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  return Boolean(data)
}

export async function getProjectWorkerPermissions(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<WorkerPermissions | null> {
  const { data } = await supabase
    .from('project_worker_assignments')
    .select('can_upload, can_delete, can_add_events, can_view_files')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null
  return parseWorkerPermissions(data)
}

export async function listProjectWorkersForAdmin(
  supabase: SupabaseClient,
  projectId: string,
  adminUserId: string
): Promise<{ workers: ProjectWorkerRow[] } | { error: string }> {
  const orgId = await getProjectOrgId(supabase, projectId)
  if (!orgId) return { error: 'Project not found' }

  const isAdmin = await isOrganizationAdmin(supabase, orgId, adminUserId)
  if (!isAdmin) return { error: 'Forbidden' }

  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id, job_title')
    .eq('organization_id', orgId)
    .eq('status', 'approved')

  if (membersError) return { error: membersError.message }

  const memberRows = members || []
  const userIds = memberRows.map((m) => m.user_id)
  if (!userIds.length) return { workers: [] }

  const jobTitleByUser = Object.fromEntries(
    memberRows.map((m) => [m.user_id, m.job_title ?? null])
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
    .eq('role', 'worker')

  const { data: assignments, error: assignError } = await supabase
    .from('project_worker_assignments')
    .select(
      'id, user_id, can_upload, can_delete, can_add_events, can_view_files'
    )
    .eq('project_id', projectId)

  if (assignError) return { error: assignError.message }

  const assignmentByUser = Object.fromEntries(
    (assignments || []).map((a) => [a.user_id, a as AssignmentRow])
  )

  const workers: ProjectWorkerRow[] = (profiles || []).map((p) => {
    const row = assignmentByUser[p.id]
    return {
      user_id: p.id,
      full_name: p.full_name,
      job_title: jobTitleByUser[p.id] ?? null,
      assigned: Boolean(row),
      assignment_id: row?.id ?? null,
      permissions: row
        ? parseWorkerPermissions(row)
        : { ...DEFAULT_WORKER_PERMISSIONS },
    }
  })

  workers.sort(compareByWorkerName)
  return { workers }
}

export async function setProjectWorkerAssignments(
  supabase: SupabaseClient,
  projectId: string,
  adminUserId: string,
  userIds: string[]
): Promise<{ error?: string }> {
  const orgId = await getProjectOrgId(supabase, projectId)
  if (!orgId) return { error: 'Project not found' }

  const isAdmin = await isOrganizationAdmin(supabase, orgId, adminUserId)
  if (!isAdmin) return { error: 'Forbidden' }

  const uniqueIds = [...new Set(userIds.filter(Boolean))]

  if (uniqueIds.length) {
    const { data: validMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('status', 'approved')
      .in('user_id', uniqueIds)

    const validSet = new Set((validMembers || []).map((m) => m.user_id))
    const invalid = uniqueIds.filter((id) => !validSet.has(id))
    if (invalid.length) {
      return {
        error:
          'One or more workers are not approved members of this organization.',
      }
    }
  }

  const { data: current, error: currentError } = await supabase
    .from('project_worker_assignments')
    .select('user_id')
    .eq('project_id', projectId)

  if (currentError) return { error: currentError.message }

  const currentIds = new Set((current || []).map((r) => r.user_id))
  const nextIds = new Set(uniqueIds)

  const toRemove = [...currentIds].filter((id) => !nextIds.has(id))
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id))

  if (toRemove.length) {
    const { error: deleteError } = await supabase
      .from('project_worker_assignments')
      .delete()
      .eq('project_id', projectId)
      .in('user_id', toRemove)

    if (deleteError) return { error: deleteError.message }
  }

  if (toAdd.length) {
    const rows = toAdd.map((user_id) => ({
      project_id: projectId,
      user_id,
      assigned_by: adminUserId,
      ...DEFAULT_WORKER_PERMISSIONS,
    }))

    const { error: insertError } = await supabase
      .from('project_worker_assignments')
      .insert(rows)

    if (insertError) return { error: insertError.message }
  }

  return {}
}

export async function updateProjectWorkerPermissions(
  supabase: SupabaseClient,
  projectId: string,
  adminUserId: string,
  workerUserId: string,
  permissions: WorkerPermissions
): Promise<{ error?: string }> {
  const orgId = await getProjectOrgId(supabase, projectId)
  if (!orgId) return { error: 'Project not found' }

  const isAdmin = await isOrganizationAdmin(supabase, orgId, adminUserId)
  if (!isAdmin) return { error: 'Forbidden' }

  const { data: assignment, error: findError } = await supabase
    .from('project_worker_assignments')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', workerUserId)
    .maybeSingle()

  if (findError) return { error: findError.message }
  if (!assignment) {
    return { error: 'Worker is not assigned to this project.' }
  }

  const { error } = await supabase
    .from('project_worker_assignments')
    .update({
      can_upload: permissions.can_upload,
      can_delete: permissions.can_delete,
      can_add_events: permissions.can_add_events,
      can_view_files: permissions.can_view_files,
    })
    .eq('id', assignment.id)

  if (error) return { error: error.message }
  return {}
}

export async function assignWorkerToProject(
  supabase: SupabaseClient,
  projectId: string,
  workerUserId: string,
  assignedBy: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('project_worker_assignments')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', workerUserId)
    .maybeSingle()

  if (existing) return

  await supabase.from('project_worker_assignments').insert({
    project_id: projectId,
    user_id: workerUserId,
    assigned_by: assignedBy,
    ...DEFAULT_WORKER_PERMISSIONS,
  })
}
