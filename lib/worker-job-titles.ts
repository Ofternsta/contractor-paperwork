/** Suggested titles admins can pick for workers (free text also allowed). */
export const WORKER_JOB_TITLE_SUGGESTIONS = [
  'Field Technician',
  'Lead Technician',
  'Project Manager',
  'Estimator',
  'Office Administrator',
  'Inspector',
  'Subcontractor Liaison',
  'Apprentice',
] as const

export const MAX_JOB_TITLE_LENGTH = 80

export function normalizeJobTitle(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_JOB_TITLE_LENGTH)
}
