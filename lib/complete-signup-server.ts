import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInviteCode, isProceduralInviteFormat } from '@/lib/invite-code'
import type { AppRole } from '@/lib/roles'
import { lookupOrganizationByInvite } from '@/lib/validate-invite'

export type SignupMetadata = {
  role?: string
  full_name?: string
  organization_name?: string
  invite_code?: string
  billing_plan?: string
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
): Promise<{ error: string | null; created: boolean; organizationId?: string }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    return { error: null, created: false, organizationId: undefined }
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
    return { error: profileError.message, created: false, organizationId: undefined }
  }

  if (role === 'admin') {
    let code = generateInviteCode()
    for (let i = 0; i < 5 && !isProceduralInviteFormat(code); i++) {
      code = generateInviteCode()
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        admin_user_id: userId,
        name:
          overrides?.organizationName?.trim() ||
          metadata.organization_name?.trim() ||
          'My Company',
        invite_code: code,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      await supabase.from('profiles').delete().eq('id', userId)
      return {
        error: orgError?.message || 'Could not create organization',
        created: false,
        organizationId: undefined,
      }
    }

    return { error: null, created: true, organizationId: org.id }
  }

  if (role === 'worker') {
    const lookup = await lookupOrganizationByInvite(
      supabase,
      overrides?.inviteCode || metadata.invite_code || ''
    )

    if (!lookup.ok) {
      await supabase.from('profiles').delete().eq('id', userId)
      return { error: lookup.error, created: false, organizationId: undefined }
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
      return { error: memberError.message, created: false, organizationId: undefined }
    }
  }

  return { error: null, created: true, organizationId: undefined }
}
