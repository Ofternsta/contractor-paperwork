import type { SupabaseClient } from '@supabase/supabase-js'
import type { EvidenceRecord } from '@/lib/evidence-storage'
import type { AppRole } from '@/lib/roles'

export type EvidenceUploaderFields = {
  uploaded_by_id: string
  uploaded_by_name: string | null
  uploaded_by_role: AppRole
  uploaded_by_label: string
}

export function evidenceRoleLabel(role: string): string {
  if (role === 'admin') return 'Admin'
  if (role === 'worker') return 'Worker'
  if (role === 'client') return 'Client'
  return 'User'
}

export function evidenceUploaderLabel(
  fullName: string | null | undefined,
  role: string
): string {
  const roleText = evidenceRoleLabel(role)
  const trimmed = fullName?.trim()
  return trimmed ? `${trimmed} (${roleText})` : roleText
}

export async function loadEvidenceUploader(
  supabase: SupabaseClient,
  userId: string
): Promise<EvidenceUploaderFields> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle()

  const role = (profile?.role as AppRole) || 'worker'
  const name = profile?.full_name ?? null

  return {
    uploaded_by_id: userId,
    uploaded_by_name: name,
    uploaded_by_role: role,
    uploaded_by_label: evidenceUploaderLabel(name, role),
  }
}

export async function enrichEvidenceRecords(
  supabase: SupabaseClient,
  records: EvidenceRecord[]
): Promise<EvidenceRecord[]> {
  const missingNameIds = [
    ...new Set(
      records
        .filter((r) => r.uploaded_by_id && !r.uploaded_by_name)
        .map((r) => r.uploaded_by_id as string)
    ),
  ]

  let profiles: Record<string, { full_name: string | null; role: string }> = {}

  if (missingNameIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', missingNameIds)

    profiles = Object.fromEntries(
      (data || []).map((p) => [
        p.id,
        { full_name: p.full_name, role: p.role },
      ])
    )
  }

  return records.map((record) => {
    const profile = record.uploaded_by_id
      ? profiles[record.uploaded_by_id]
      : undefined
    const name = record.uploaded_by_name ?? profile?.full_name ?? null
    const role = record.uploaded_by_role ?? profile?.role ?? 'unknown'
    const label =
      record.uploaded_by_label ||
      (record.uploaded_by_id || name
        ? evidenceUploaderLabel(name, role)
        : 'Unknown uploader')

    return {
      ...record,
      uploaded_by_name: name,
      uploaded_by_role: role as AppRole | 'unknown',
      uploaded_by_label: label,
    }
  })
}
