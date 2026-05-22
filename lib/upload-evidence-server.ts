import type { EvidenceRecord } from '@/lib/evidence-storage'

/** Upload file to storage, then run server AI/OCR via /api/upload. */
export async function uploadEvidenceWithAi(
  projectId: string,
  claimId: string,
  file: File
): Promise<EvidenceRecord> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('project_id', projectId)
  formData.append('claim_id', claimId)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const payload = await res.json().catch(() => ({}))

  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    throw new Error(payload.error || 'Upload failed')
  }

  return payload.evidence as EvidenceRecord
}
