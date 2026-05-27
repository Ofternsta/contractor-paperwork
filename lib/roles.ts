import type { BillingPlanId } from '@/lib/stripe-config'
import type { PlanEntitlements } from '@/lib/plan-entitlements'
import {
  adminWorkerPermissions,
  type WorkerPermissions,
} from '@/lib/worker-permissions'

export type AppRole = 'admin' | 'worker' | 'client'

export type WorkerStatus = 'pending' | 'approved' | 'none'

export type UserAccess = {
  role: AppRole
  organizationId: string | null
  organizationName: string | null
  inviteCode: string | null
  workerStatus: WorkerStatus
  plan: BillingPlanId | null
  planName: string | null
  aiSummariesUsed: number
  aiSummariesLimit: number
  activeProjectsLimit: number
  canCreateProject: boolean
  canDeleteProject: boolean
  canUploadEvidence: boolean
  canViewFiles: boolean
  canEditEvidenceSummary: boolean
  canDeleteEvidence: boolean
  canManageTeam: boolean
  canManageProjectClients: boolean
  /** Staff (admin + approved workers) with plan — AI, notes, schedule, etc. */
  canUpdateClaimInfo: boolean
  /** Report workflow status (Inspection → Completed) — admins only */
  canUpdateReportStatus: boolean
  canViewInternalNotes: boolean
  canViewCalendar: boolean
  canManageSchedule: boolean
  canViewAnalytics: boolean
  canManageBilling: boolean
  canManageSystemSettings: boolean
  canViewClientPortal: boolean
  canApproveDocuments: boolean
  canExportPdf: boolean
  canExportHtml: boolean
  canUseTeamMessages: boolean
  canUseClaimPacketExport: boolean
  canArchiveProject: boolean
  exportHasWatermark: boolean
}

export function buildAccess(input: {
  role: AppRole
  organizationId: string | null
  organizationName?: string | null
  inviteCode?: string | null
  workerStatus: WorkerStatus
  plan?: BillingPlanId | null
  planName?: string | null
  entitlements?: PlanEntitlements | null
  aiSummariesUsed?: number
  activeProjectCount?: number
  workerPermissions?: WorkerPermissions | null
}): UserAccess {
  const { role, organizationId, workerStatus } = input
  const isAdmin = role === 'admin'
  const workerApproved = role === 'worker' && workerStatus === 'approved'
  const isClient = role === 'client'
  const ent = input.entitlements
  const hasPlan = Boolean(input.plan && ent)

  const staffCapable = isAdmin || workerApproved
  const wp =
    isAdmin
      ? adminWorkerPermissions()
      : workerApproved
        ? input.workerPermissions
        : null
  const aiLimit = ent?.aiSummariesPerMonth ?? 0
  const projectLimit = ent?.maxActiveProjects ?? 0

  const canManageTeam = isAdmin && Boolean(ent?.workerAccounts)
  const canManageProjectClients = isAdmin && Boolean(ent?.clientPortal)
  const canViewInternalNotes =
    staffCapable && Boolean(ent?.internalNotes)
  const canViewCalendar = staffCapable && Boolean(ent?.scheduling)
  const canManageSchedule =
    canViewCalendar && Boolean(isAdmin || wp?.can_add_events)
  const canViewFiles =
    isClient ||
    (staffCapable && hasPlan && Boolean(isAdmin || wp?.can_view_files))
  const canViewAnalytics =
    isAdmin &&
    Boolean(ent?.analyticsDashboard || ent?.advancedAnalytics)
  const canUseTeamMessages = staffCapable && Boolean(ent?.teamMessages)
  const canExportPdf =
    staffCapable &&
    Boolean(ent?.standardPdfExport || ent?.claimPacketExport)
  const canExportHtml =
    staffCapable &&
    (Boolean(ent?.standardPdfExport) ||
      Boolean(ent?.exportWatermark) ||
      Boolean(ent?.claimPacketExport))

  let canCreateProject = isAdmin
  if (hasPlan && ent && ent.maxActiveProjects >= 0) {
    const count = input.activeProjectCount ?? 0
    if (count >= ent.maxActiveProjects) {
      canCreateProject = false
    }
  }
  if (!hasPlan && isAdmin) {
    canCreateProject = false
  }

  return {
    role,
    organizationId,
    organizationName: input.organizationName ?? null,
    inviteCode: input.inviteCode ?? null,
    workerStatus,
    plan: input.plan ?? null,
    planName: input.planName ?? null,
    aiSummariesUsed: input.aiSummariesUsed ?? 0,
    aiSummariesLimit: aiLimit,
    activeProjectsLimit: projectLimit,
    canCreateProject,
    canDeleteProject: isAdmin,
    canUploadEvidence:
      staffCapable && hasPlan && Boolean(isAdmin || wp?.can_upload),
    canViewFiles,
    canEditEvidenceSummary: isAdmin,
    canDeleteEvidence:
      isAdmin || (workerApproved && hasPlan && Boolean(wp?.can_delete)),
    canManageTeam,
    canManageProjectClients,
    canUpdateClaimInfo: staffCapable && hasPlan,
    canUpdateReportStatus: isAdmin && hasPlan,
    canViewInternalNotes,
    canViewCalendar,
    canManageSchedule,
    canViewAnalytics,
    canManageBilling: isAdmin,
    canManageSystemSettings: isAdmin,
    canViewClientPortal: isClient,
    canApproveDocuments: isClient,
    canExportPdf,
    canExportHtml,
    canUseTeamMessages,
    canUseClaimPacketExport: Boolean(ent?.claimPacketExport),
    canArchiveProject:
      isAdmin &&
      hasPlan &&
      Boolean(
        ent?.claimPacketExport ||
          ent?.standardPdfExport ||
          ent?.exportWatermark
      ),
    exportHasWatermark: Boolean(ent?.exportWatermark),
  }
}
