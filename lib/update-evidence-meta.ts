import type { SupabaseClient } from '@supabase/supabase-js'
import type { EvidenceRecord } from '@/lib/evidence-storage'

const BUCKET = 'project-files'

function metaPath(filePath: string) {
  return `${filePath}.meta.json`
}

export async function updateEvidenceMeta(
  supabase: SupabaseClient,
  filePath: string,
  updates: { summary?: string; evidence_type?: string }
): Promise<EvidenceRecord> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(metaPath(filePath))

  if (error || !data) {
    throw new Error('Could not load evidence metadata')
  }

  const record = JSON.parse(await data.text()) as EvidenceRecord

  if (updates.summary !== undefined) record.summary = updates.summary
  if (updates.evidence_type !== undefined) {
    record.evidence_type = updates.evidence_type
  }

  const body = JSON.stringify(record, null, 2)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(metaPath(filePath), body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (uploadError) throw new Error(uploadError.message)
  return record
}
