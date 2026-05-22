import { generateInviteCode } from '@/lib/invite-code'
import type { AppRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export async function completeSignupProfile(input: {
  userId: string
  role: AppRole
  fullName?: string
  organizationName?: string
  inviteCode?: string
}): Promise<string | null> {
  const { error: profileError } = await supabase.from('profiles').insert({
    id: input.userId,
    role: input.role,
    full_name: input.fullName?.trim() || null,
  })

  if (profileError) {
    return profileError.message
  }

  if (input.role === 'admin') {
    const code = generateInviteCode()
    const { error: orgError } = await supabase.from('organizations').insert({
      admin_user_id: input.userId,
      name: input.organizationName?.trim() || 'My Company',
      invite_code: code,
    })

    if (orgError) return orgError.message
    return null
  }

  if (input.role === 'worker') {
    const code = input.inviteCode?.trim().toUpperCase()
    if (!code) {
      return 'Organization invite code is required for worker accounts.'
    }

    const { data: org, error: orgLookupError } = await supabase
      .from('organizations')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()

    if (orgLookupError || !org) {
      return 'Invalid organization invite code. Ask your admin for the correct code.'
    }

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: input.userId,
        status: 'pending',
      })

    if (memberError) return memberError.message
    return null
  }

  return null
}

export async function linkClientAccessByEmail() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return

  await supabase
    .from('project_client_access')
    .update({ user_id: user.id })
    .eq('client_email', user.email.toLowerCase())
    .is('user_id', null)
}
