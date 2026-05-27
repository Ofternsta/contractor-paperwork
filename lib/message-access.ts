import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRole } from '@/lib/roles'

export type MessageChannel = 'org_team' | 'project'

export async function canAccessOrgTeamMessages(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .eq('admin_user_id', userId)
    .maybeSingle()

  if (org) return true

  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  return Boolean(member)
}

/** Project messages are internal (admin + approved workers only). */
export async function canAccessProjectMessages(
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

  if (role === 'admin') {
    const { data: project, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    return !error && Boolean(project)
  }

  if (role === 'worker') {
    const { canAccessStaffProjectFeatures } = await import(
      '@/lib/staff-project-access'
    )
    return canAccessStaffProjectFeatures(supabase, projectId, userId)
  }

  return false
}

export function canSendOrgTeamMessages(
  role: AppRole,
  workerStatus: 'pending' | 'approved' | 'none'
) {
  return role === 'admin' || (role === 'worker' && workerStatus === 'approved')
}

export function canSendProjectMessages(role: AppRole, workerStatus: string) {
  if (role === 'admin') return true
  if (role === 'worker' && workerStatus === 'approved') return true
  return false
}
