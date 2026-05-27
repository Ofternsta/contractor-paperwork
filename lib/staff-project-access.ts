import type { SupabaseClient } from '@supabase/supabase-js'
import { isWorkerAssignedToProject } from '@/lib/project-worker-assignments'
import type { AppRole } from '@/lib/roles'

/** Admin or approved worker on the project's organization (not clients). */
export async function canAccessStaffProjectFeatures(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const role = profile?.role as AppRole | undefined
  if (!role || role === 'client') return false

  const { data: project } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.organization_id) return false

  if (role === 'admin') {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', project.organization_id)
      .eq('admin_user_id', userId)
      .maybeSingle()
    return Boolean(org)
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('status')
    .eq('organization_id', project.organization_id)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!membership) return false

  return isWorkerAssignedToProject(supabase, projectId, userId)
}

export async function getProjectOrgId(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()
  return data?.organization_id ?? null
}
