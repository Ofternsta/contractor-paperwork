export const EVIDENCE_TYPES = [
  'Damage Photo',
  'Invoice',
  'Estimate',
  'Moisture Reading',
  'Insurance Email',
  'Report',
  'Other',
] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export function normalizeEvidenceType(raw: string): EvidenceType {
  const cleaned = raw.trim().toLowerCase()

  const match = EVIDENCE_TYPES.find((t) => t.toLowerCase() === cleaned)
  if (match) return match

  if (cleaned.includes('photo') || cleaned.includes('image')) return 'Damage Photo'
  if (cleaned.includes('invoice') || cleaned.includes('receipt')) return 'Invoice'
  if (cleaned.includes('estimate') || cleaned.includes('quote')) return 'Estimate'
  if (cleaned.includes('moisture')) return 'Moisture Reading'
  if (cleaned.includes('email') || cleaned.includes('letter')) return 'Insurance Email'
  if (cleaned.includes('report')) return 'Report'

  return 'Other'
}

export function guessEvidenceTypeFromFile(file: {
  name: string
  type: string
}): EvidenceType {
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()

  if (mime.startsWith('image/')) return 'Damage Photo'
  if (name.includes('invoice') || name.includes('receipt') || name.includes('bill')) {
    return 'Invoice'
  }
  if (name.includes('estimate') || name.includes('quote') || name.includes('xact')) {
    return 'Estimate'
  }
  if (name.includes('moisture') || name.includes('hygro') || name.includes('drying')) {
    return 'Moisture Reading'
  }
  if (name.includes('email') || name.includes('correspondence') || name.includes('adjuster')) {
    return 'Insurance Email'
  }
  if (name.includes('report') || name.includes('copilot') || name.includes('inspection')) {
    return 'Report'
  }
  if (mime === 'application/pdf' || name.endsWith('.docx')) return 'Report'

  return 'Other'
}
