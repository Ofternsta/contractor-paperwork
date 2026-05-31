import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildProjectArchiveZip } from '@/lib/build-project-archive'
import { getOrgPlanContext } from '@/lib/org-plan'
import { PLAN_ENTITLEMENTS } from '@/lib/plan-entitlements'
import { createServiceClient } from '@/lib/supabase/service'

const BACKUP_BUCKET = 'org-backups'

export async function getOrganizationBackupLimit(
  service: SupabaseClient,
  organizationId: string
): Promise<number> {
  const planCtx = await getOrgPlanContext(service, organizationId)
  if (!planCtx) return PLAN_ENTITLEMENTS.starter.maxOrganizationBackups
  return planCtx.entitlements.maxOrganizationBackups
}

export type BackupType = 'scheduled' | 'report_completed' | 'manual'

export type BackupSettings = {
  backup_enabled: boolean
  backup_frequency: 'daily' | 'weekly'
  backup_on_report_completed: boolean
  last_scheduled_backup_at: string | null
}

export async function orgCanUseBackups(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const planCtx = await getOrgPlanContext(supabase, organizationId)
  if (!planCtx) return false
  const ent = planCtx.entitlements
  return ent.maxOrganizationBackups > 0
}

export async function loadBackupSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<BackupSettings | null> {
  const { data } = await supabase
    .from('organizations')
    .select(
      'backup_enabled, backup_frequency, backup_on_report_completed, last_scheduled_backup_at'
    )
    .eq('id', organizationId)
    .maybeSingle()

  if (!data) return null

  return {
    backup_enabled: Boolean(data.backup_enabled),
    backup_frequency:
      data.backup_frequency === 'daily' ? 'daily' : 'weekly',
    backup_on_report_completed: Boolean(data.backup_on_report_completed),
    last_scheduled_backup_at: data.last_scheduled_backup_at,
  }
}

function backupDue(settings: BackupSettings): boolean {
  if (!settings.backup_enabled) return false
  if (!settings.last_scheduled_backup_at) return true

  const last = new Date(settings.last_scheduled_backup_at).getTime()
  const hours =
    settings.backup_frequency === 'daily' ? 24 : 24 * 7
  return Date.now() - last >= hours * 60 * 60 * 1000
}

/** Drop completed backups over the org's current plan limit (e.g. after downgrade). */
export async function enforceOrganizationBackupLimit(
  service: SupabaseClient,
  organizationId: string
): Promise<void> {
  const maxBackups = await getOrganizationBackupLimit(service, organizationId)
  await pruneOldBackups(service, organizationId, maxBackups)
}

async function pruneOldBackups(
  service: SupabaseClient,
  organizationId: string,
  maxBackups: number
) {
  const { data: rows } = await service
    .from('organization_backups')
    .select('id, storage_path')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const excess = (rows || []).slice(maxBackups)
  if (!excess.length) return

  const paths = excess.map((r) => r.storage_path)
  await service.storage.from(BACKUP_BUCKET).remove(paths)
  await service
    .from('organization_backups')
    .delete()
    .in(
      'id',
      excess.map((r) => r.id)
    )
}

export async function backupProject(
  service: SupabaseClient,
  organizationId: string,
  projectId: string,
  backupType: BackupType
): Promise<{ backupId?: string; error?: string }> {
  const backupId = crypto.randomUUID()
  const { buffer, filename } = await buildProjectArchiveZip({
    supabase: service,
    projectId,
  })

  const storagePath = `${organizationId}/${backupId}/${filename}`

  const { error: insertError } = await service.from('organization_backups').insert({
    id: backupId,
    organization_id: organizationId,
    project_id: projectId,
    backup_type: backupType,
    storage_path: storagePath,
    filename,
    status: 'pending',
  })

  if (insertError) {
    return { error: insertError.message }
  }

  const { error: uploadError } = await service.storage
    .from(BACKUP_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/zip',
      upsert: false,
    })

  if (uploadError) {
    await service
      .from('organization_backups')
      .update({
        status: 'failed',
        error_message: uploadError.message,
      })
      .eq('id', backupId)
    return { error: uploadError.message }
  }

  await service
    .from('organization_backups')
    .update({
      status: 'completed',
      byte_size: buffer.length,
      error_message: null,
    })
    .eq('id', backupId)

  const maxBackups = await getOrganizationBackupLimit(service, organizationId)
  await pruneOldBackups(service, organizationId, maxBackups)

  return { backupId }
}

export async function runScheduledBackupForOrg(
  service: SupabaseClient,
  organizationId: string,
  options?: { force?: boolean; backupType?: BackupType }
): Promise<{ backedUp: number; error?: string }> {
  const settings = await loadBackupSettings(service, organizationId)
  const backupType = options?.backupType ?? 'scheduled'

  if (!options?.force && (!settings || !backupDue(settings))) {
    return { backedUp: 0 }
  }

  if (!(await orgCanUseBackups(service, organizationId))) {
    return { backedUp: 0, error: 'Plan does not include backups' }
  }

  const { data: projects } = await service
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)

  let backedUp = 0
  let lastError: string | undefined

  for (const project of projects || []) {
    const result = await backupProject(
      service,
      organizationId,
      project.id,
      backupType
    )
    if (result.error) {
      lastError = result.error
    } else {
      backedUp += 1
    }
  }

  if (backupType === 'scheduled') {
    await service
      .from('organizations')
      .update({ last_scheduled_backup_at: new Date().toISOString() })
      .eq('id', organizationId)
  }

  return { backedUp, error: lastError }
}

export async function runAllDueScheduledBackups(): Promise<{
  orgs: number
  projects: number
  errors: string[]
}> {
  const service = createServiceClient()
  const { data: orgs } = await service
    .from('organizations')
    .select('id, backup_enabled, backup_frequency, last_scheduled_backup_at')
    .eq('backup_enabled', true)

  let orgCount = 0
  let projectCount = 0
  const errors: string[] = []

  for (const org of orgs || []) {
    const settings: BackupSettings = {
      backup_enabled: true,
      backup_frequency:
        org.backup_frequency === 'daily' ? 'daily' : 'weekly',
      backup_on_report_completed: true,
      last_scheduled_backup_at: org.last_scheduled_backup_at,
    }

    if (!backupDue(settings)) continue

    const result = await runScheduledBackupForOrg(service, org.id)
    if (result.backedUp > 0) orgCount += 1
    projectCount += result.backedUp
    if (result.error) errors.push(`${org.id}: ${result.error}`)
  }

  return { orgs: orgCount, projects: projectCount, errors }
}

export async function triggerProjectCompletedBackup(
  organizationId: string,
  projectId: string
): Promise<void> {
  const service = createServiceClient()

  const settings = await loadBackupSettings(service, organizationId)
  if (!settings?.backup_enabled || !settings.backup_on_report_completed) {
    return
  }

  if (!(await orgCanUseBackups(service, organizationId))) return

  await backupProject(
    service,
    organizationId,
    projectId,
    'report_completed'
  )
}

export function createBackupServiceClient() {
  return createServiceClient()
}
