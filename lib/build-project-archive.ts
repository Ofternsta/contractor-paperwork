import type { SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { buildFallbackSummary } from '@/lib/claim-ai'
import {
  buildHtmlReport,
  buildPdfReport,
} from '@/lib/export-report-builders'
import { listEvidence } from '@/lib/evidence-storage'
import { listProjectStoragePaths } from '@/lib/list-project-storage'

const BUCKET = 'project-files'

function safeSegment(raw: string, fallback: string) {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  return cleaned || fallback
}

function zipBasename(storagePath: string) {
  const parts = storagePath.split('/')
  return parts[parts.length - 1] || 'file'
}

function appendJson(zip: InstanceType<typeof JSZip>, zipPath: string, data: unknown) {
  zip.file(zipPath, JSON.stringify(data, null, 2))
}

async function downloadStorageFile(
  supabase: SupabaseClient,
  path: string
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export type ProjectArchiveInput = {
  supabase: SupabaseClient
  projectId: string
}

export async function buildProjectArchiveZip(
  input: ProjectArchiveInput
): Promise<{ buffer: Buffer; filename: string }> {
  const { supabase, projectId } = input

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    throw new Error('Project not found')
  }

  const { data: claims, error: claimsError } = await supabase
    .from('claims')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (claimsError) {
    throw new Error(claimsError.message)
  }

  const claimList = claims || []

  let timelineRows: Record<string, unknown>[] | null = []
  if (claimList.length) {
    const { data } = await supabase
      .from('claim_timeline_events')
      .select('*')
      .in(
        'claim_id',
        claimList.map((c) => c.id)
      )
      .order('event_date', { ascending: true })
    timelineRows = data
  }

  const timelineByClaim: Record<string, unknown[]> = {}
  for (const row of timelineRows || []) {
    const cid = row.claim_id as string
    if (!timelineByClaim[cid]) timelineByClaim[cid] = []
    timelineByClaim[cid].push(row)
  }

  let projectMessages: unknown[] = []
  const { data: messageRows } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, channel')
    .eq('project_id', projectId)
    .eq('channel', 'project')
    .order('created_at', { ascending: true })
    .limit(500)

  if (messageRows?.length) {
    const senderIds = [...new Set(messageRows.map((m) => m.sender_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds)
    const names = Object.fromEntries(
      (profiles || []).map((p) => [
        p.id,
        p.full_name?.trim() || p.role || 'User',
      ])
    )
    projectMessages = messageRows.map((m) => ({
      ...m,
      sender_name: names[m.sender_id] || 'User',
    }))
  }

  let internalNotes: unknown[] = []
  const { data: noteRows } = await supabase
    .from('internal_notes')
    .select('id, author_id, body, mentioned_user_ids, note_kind, claim_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (noteRows?.length) {
    const authorIds = [...new Set(noteRows.map((n) => n.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', authorIds)
    const names = Object.fromEntries(
      (profiles || []).map((p) => [
        p.id,
        p.full_name?.trim() || p.role || 'User',
      ])
    )
    internalNotes = noteRows.map((n) => ({
      ...n,
      author_name: names[n.author_id] || 'User',
    }))
  }

  let scheduleEvents: unknown[] = []
  const { data: scheduleRows } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('project_id', projectId)
    .order('starts_at', { ascending: true })
    .limit(500)

  scheduleEvents = scheduleRows || []

  const storagePaths = await listProjectStoragePaths(supabase, projectId)
  const metaPaths = new Set(
    storagePaths.filter((p) => p.endsWith('.meta.json'))
  )

  const zip = new JSZip()
  const exportedAt = new Date().toISOString()
  const customer = safeSegment(
    String(project.customer_name || 'project'),
    'project'
  )

  appendJson(zip, 'manifest.json', {
    exported_at: exportedAt,
    ledgerstack_version: 1,
    project_id: projectId,
    customer_name: project.customer_name,
    report_count: claimList.length,
    storage_file_count: storagePaths.filter((p) => !metaPaths.has(p)).length,
  })

  appendJson(zip, 'project.json', project)

  if (projectMessages.length) {
    appendJson(zip, 'messages-project.json', projectMessages)
  }

  if (internalNotes.length) {
    appendJson(zip, 'internal-notes.json', internalNotes)
  }

  if (scheduleEvents.length) {
    appendJson(zip, 'schedule.json', scheduleEvents)
  }

  for (const claim of claimList) {
    const reportFolder = safeSegment(
      String(claim.claim_number || claim.client_name || claim.id),
      'report'
    )
    const base = `reports/${reportFolder}`

    appendJson(zip, `${base}/report.json`, claim)

    const timeline = timelineByClaim[claim.id] || []
    appendJson(zip, `${base}/timeline.json`, timeline)

    const evidence = await listEvidence(supabase, projectId, claim.id)
    appendJson(zip, `${base}/documents-index.json`, evidence)

    const summary = buildFallbackSummary(claim, evidence)
    zip.file(`${base}/ai-summary.txt`, summary)

    const intelligence = {
      exported_at: exportedAt,
      report_id: claim.id,
      status: claim.status,
      timeline_entry_count: timeline.length,
      document_count: evidence.length,
      summary,
    }
    appendJson(zip, `${base}/report-intelligence.json`, intelligence)

    const html = buildHtmlReport(claim, summary, evidence)
    zip.file(`${base}/report.html`, html)

    const pdfBytes = await buildPdfReport(claim, summary, evidence)
    if (pdfBytes) {
      zip.file(`${base}/report.pdf`, pdfBytes)
    }

    for (const doc of evidence) {
      const fileBuf = await downloadStorageFile(supabase, doc.file_path)
      if (fileBuf) {
        const docName = safeSegment(doc.file_name, zipBasename(doc.file_path))
        zip.file(`${base}/documents/${docName}`, fileBuf)
      }
    }
  }

  for (const path of storagePaths) {
    if (metaPaths.has(path)) {
      const buf = await downloadStorageFile(supabase, path)
      if (buf) {
        const rel = path.replace(`${projectId}/`, '')
        zip.file(`storage-meta/${rel}`, buf)
      }
      continue
    }

    const alreadyInReport = claimList.some((c) =>
      path.startsWith(`${projectId}/${c.id}/`)
    )
    if (alreadyInReport) continue

    const buf = await downloadStorageFile(supabase, path)
    if (buf) {
      const rel = path.replace(`${projectId}/`, '')
      zip.file(`other-files/${rel}`, buf)
    }
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const datePart = exportedAt.slice(0, 10)
  const filename = `ledgerstack-${customer}-${datePart}.zip`

  return { buffer, filename }
}
