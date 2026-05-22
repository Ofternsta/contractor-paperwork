export type AppRole = 'admin' | 'worker' | 'client'

export type WorkerStatus = 'pending' | 'approved' | 'none'

export type UserAccess = {
  role: AppRole
  organizationId: string | null
  organizationName: string | null
  inviteCode: string | null
  workerStatus: WorkerStatus
  canCreateProject: boolean
  canDeleteProject: boolean
  canUploadEvidence: boolean
  canEditEvidenceSummary: boolean
  canDeleteEvidence: boolean
  canManageTeam: boolean
  canManageProjectClients: boolean
  canUpdateClaimInfo: boolean
  canViewInternalNotes: boolean
  canViewAnalytics: boolean
  canManageBilling: boolean
  canManageSystemSettings: boolean
  canViewClientPortal: boolean
  canApproveDocuments: boolean
  canExportPdf: boolean
}

export function buildAccess(input: {
  role: AppRole
  organizationId: string | null
  organizationName?: string | null
  inviteCode?: string | null
  workerStatus: WorkerStatus
}): UserAccess {
  const { role, organizationId, workerStatus } = input
  const isAdmin = role === 'admin'
  const workerApproved = role === 'worker' && workerStatus === 'approved'

  const isClient = role === 'client'

  return {
    role,
    organizationId,
    organizationName: input.organizationName ?? null,
    inviteCode: input.inviteCode ?? null,
    workerStatus,
    canCreateProject: isAdmin || workerApproved,
    canDeleteProject: isAdmin,
    canUploadEvidence: isAdmin || workerApproved,
    canEditEvidenceSummary: isAdmin,
    canDeleteEvidence: isAdmin,
    canManageTeam: isAdmin,
    canManageProjectClients: isAdmin,
    canUpdateClaimInfo: isAdmin || workerApproved,
    canViewInternalNotes: isAdmin || workerApproved,
    canViewAnalytics: isAdmin,
    canManageBilling: isAdmin,
    canManageSystemSettings: isAdmin,
    canViewClientPortal: isClient,
    canApproveDocuments: isClient,
    canExportPdf: isAdmin || workerApproved,
  }
}
