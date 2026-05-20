import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type EvidenceRecord = {
  id: string
  claim_id: string
  file_name: string
  file_path: string
  file_type: string
  evidence_type: string
  summary: string
  created_at: string
}

const BUCKET = 'project-files'

function getClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function metaPath(filePath: string) {
  return `${filePath}.meta.json`
}

export async function listEvidence(
  projectId: string,
  claimId: string
): Promise<EvidenceRecord[]> {
  const supabase = getClient()
  const records: EvidenceRecord[] = []

  const prefixes = [`${projectId}/${claimId}`, `${projectId}`]

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix)

    if (error || !data) continue

    for (const item of data) {
      if (
        !item.name ||
        item.name.endsWith('.meta.json') ||
        item.name.endsWith('.json')
      )
        continue
      if (!item.id) continue

      const filePath = `${prefix}/${item.name}`
      const meta = await readMeta(supabase, filePath)

      if (meta) {
        if (meta.claim_id === claimId) records.push(meta)
        continue
      }

      if (prefix === `${projectId}/${claimId}` || prefix === projectId) {
        records.push({
          id: filePath,
          claim_id: claimId,
          file_name: item.name,
          file_path: filePath,
          file_type: '',
          evidence_type: 'Unknown',
          summary: '',
          created_at: item.created_at || new Date().toISOString(),
        })
      }
    }
  }

  return records.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

async function readMeta(
  supabase: SupabaseClient,
  filePath: string
): Promise<EvidenceRecord | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(metaPath(filePath))

  if (error || !data) return null

  try {
    return JSON.parse(await data.text()) as EvidenceRecord
  } catch {
    return null
  }
}

export async function saveEvidence(
  record: EvidenceRecord
): Promise<EvidenceRecord> {
  const supabase = getClient()
  const body = JSON.stringify(record, null, 2)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(metaPath(record.file_path), body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) throw new Error(error.message)
  return record
}

export async function uploadEvidenceFile(
  projectId: string,
  claimId: string,
  file: File
): Promise<{ filePath: string }> {
  const supabase = getClient()
  const filePath = `${projectId}/${claimId}/${Date.now()}-${file.name}`

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file)

  if (error) throw new Error(error.message)
  return { filePath }
}

export async function deleteEvidence(
  filePath: string
): Promise<void> {
  const supabase = getClient()

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath, metaPath(filePath)])

  if (error) throw new Error(error.message)
}

export function newEvidenceId() {
  return crypto.randomUUID()
}
