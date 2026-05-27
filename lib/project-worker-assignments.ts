import type { SupabaseClient } from '@supabase/supabase-js'
import { isOrganizationAdmin } from '@/lib/org-admin'
import { getProjectOrgId } from '@/lib/staff-project-access'

export type ProjectWorkerRow = {
  user_id: string
  full_name: string | null
  assigned: boolean
  assignment_id: string | null
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
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'approved')

  if (membersError) return { error: membersError.message }

  const userIds = (members || []).map((m) => m.user_id)
  if (!userIds.length) return { workers: [] }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
    .eq('role', 'worker')

  const { data: assignments, error: assignError } = await supabase
    .from('project_worker_assignments')
    .select('id, user_id')
    .eq('project_id', projectId)

  if (assignError) return { error: assignError.message }

  const assignedByUser = Object.fromEntries(
    (assignments || []).map((a) => [a.user_id, a.id])
  )

  const workers: ProjectWorkerRow[] = (profiles || []).map((p) => ({
    user_id: p.id,
    full_name: p.full_name,
    assigned: Boolean(assignedByUser[p.id]),
    assignment_id: assignedByUser[p.id] ?? null,
  }))

  workers.sort((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '', undefined, {
      sensitivity: 'base',
    })
  )

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
      return { error: 'One or more workers are not approved members of this organization.' }
    }
  }

  const { error: deleteError } = await supabase
    .from('project_worker_assignments')
    .delete()
    .eq('project_id', projectId)

  if (deleteError) return { error: deleteError.message }

  if (!uniqueIds.length) return {}

  const rows = uniqueIds.map((user_id) => ({
    project_id: projectId,
    user_id,
    assigned_by: adminUserId,
  }))

  const { error: insertError } = await supabase
    .from('project_worker_assignments')
    .insert(rows)

  if (insertError) return { error: insertError.message }

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
  })
}
