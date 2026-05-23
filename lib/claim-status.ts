export const CLAIM_STATUSES = [
  'Inspection',
  'Documentation',
  'Estimate Sent',
  'Approved',
  'In Progress',
  'Completed',
] as const

export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const DEFAULT_CLAIM_STATUS: ClaimStatus = 'Inspection'

const LEGACY_STATUS_MAP: Record<string, ClaimStatus> = {
  inspection: 'Inspection',
  documentation: 'Documentation',
  'estimate sent': 'Estimate Sent',
  approved: 'Approved',
  'in progress': 'In Progress',
  completed: 'Completed',
}

export function normalizeClaimStatus(
  raw: string | null | undefined
): ClaimStatus {
  if (!raw?.trim()) return DEFAULT_CLAIM_STATUS
  if (CLAIM_STATUSES.includes(raw as ClaimStatus)) return raw as ClaimStatus
  const mapped = LEGACY_STATUS_MAP[raw.trim().toLowerCase()]
  return mapped ?? DEFAULT_CLAIM_STATUS
}

export function claimStatusIndex(status: ClaimStatus): number {
  return CLAIM_STATUSES.indexOf(status)
}

export function isClaimStatus(value: string): value is ClaimStatus {
  return CLAIM_STATUSES.includes(value as ClaimStatus)
}
