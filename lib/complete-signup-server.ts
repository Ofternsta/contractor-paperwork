import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInviteCode, isProceduralInviteFormat } from '@/lib/invite-code'
import type { AppRole } from '@/lib/roles'
import { lookupOrganizationByInvite } from '@/lib/validate-invite'

export type SignupMetadata = {
  role?: string
  full_name?: string
  organization_name?: string
  invite_code?: string
}

function parseRole(raw: string | undefined): AppRole | null {
  if (raw === 'admin' || raw === 'worker' || raw === 'client') return raw
  return null
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
  metadata: SignupMetadata,
  overrides?: {
    role?: AppRole
    fullName?: string
    organizationName?: string
    inviteCode?: string
  }
): Promise<{ error: string | null; created: boolean }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    return { error: null, created: false }
  }

  const role =
    overrides?.role ?? parseRole(metadata.role) ?? ('client' as AppRole)

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    role,
    full_name:
      overrides?.fullName?.trim() ||
      metadata.full_name?.trim() ||
      null,
  })

  if (profileError) {
    return { error: profileError.message, created: false }
  }

  if (role === 'admin') {
    let code = generateInviteCode()
    for (let i = 0; i < 5 && !isProceduralInviteFormat(code); i++) {
      code = generateInviteCode()
    }

    const { error: orgError } = await supabase.from('organizations').insert({
      admin_user_id: userId,
      name:
        overrides?.organizationName?.trim() ||
        metadata.organization_name?.trim() ||
        'My Company',
      invite_code: code,
    })

    if (orgError) {
      await supabase.from('profiles').delete().eq('id', userId)
      return { error: orgError.message, created: false }
    }
  }

  if (role === 'worker') {
    const lookup = await lookupOrganizationByInvite(
      supabase,
      overrides?.inviteCode || metadata.invite_code || ''
    )

    if (!lookup.ok) {
      await supabase.from('profiles').delete().eq('id', userId)
      return { error: lookup.error, created: false }
    }

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: lookup.organizationId,
        user_id: userId,
        status: 'pending',
      })

    if (memberError) {
      await supabase.from('profiles').delete().eq('id', userId)
      return { error: memberError.message, created: false }
    }
  }

  return { error: null, created: true }
}
