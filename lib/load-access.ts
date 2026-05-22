import { buildAccess, type AppRole, type UserAccess, type WorkerStatus } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export async function loadUserAccess(): Promise<{
  userId: string | null
  access: UserAccess | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { userId: null, access: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile?.role as AppRole) || 'client'
  let organizationId: string | null = null
  let organizationName: string | null = null
  let inviteCode: string | null = null
  let workerStatus: WorkerStatus = 'none'

  if (role === 'admin') {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, invite_code')
      .eq('admin_user_id', user.id)
      .maybeSingle()

    organizationId = org?.id ?? null
    organizationName = org?.name ?? null
    inviteCode = org?.invite_code ?? null
  }

  if (role === 'worker') {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('status, organization_id, organizations(name, invite_code)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const org = membership?.organizations as
      | { name: string; invite_code: string }
      | null
      | undefined

    organizationId = membership?.organization_id ?? null
    organizationName = org?.name ?? null
    inviteCode = org?.invite_code ?? null
    workerStatus =
      membership?.status === 'approved'
        ? 'approved'
        : membership
          ? 'pending'
          : 'none'
  }

  return {
    userId: user.id,
    access: buildAccess({
      role,
      organizationId,
      organizationName,
      inviteCode,
      workerStatus,
    }),
  }
}

/** Client: project IDs this user may view */
export async function loadClientProjectIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('project_client_access')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'approved')

  return (data || []).map((r) => r.project_id)
}
