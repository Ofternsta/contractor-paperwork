import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateInviteCode,
  isProceduralInviteFormat,
} from '@/lib/invite-code'

export async function convertWorkerToAdmin(
  supabase: SupabaseClient,
  userId: string,
  organizationName: string
): Promise<{ error: string | null; inviteCode?: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return { error: 'Profile not found. Sign out and sign in again.' }
  }

  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('admin_user_id', userId)
    .maybeSingle()

  if (existingOrg) {
    return { error: 'You already have an admin organization.' }
  }

  await supabase.from('organization_members').delete().eq('user_id', userId)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)

  if (profileError) {
    return { error: profileError.message }
  }

  let inviteCode = generateInviteCode()
  for (let i = 0; i < 5 && !isProceduralInviteFormat(inviteCode); i++) {
    inviteCode = generateInviteCode()
  }
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      admin_user_id: userId,
      name: organizationName.trim() || 'My Company',
      invite_code: inviteCode,
    })
    .select('id')
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  await supabase
    .from('projects')
    .update({ organization_id: org.id })
    .eq('user_id', userId)

  return { error: null, inviteCode }
}
