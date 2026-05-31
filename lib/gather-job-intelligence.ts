import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobIntelligenceContext } from '@/lib/job-intelligence-types'
import { listEvidence } from '@/lib/evidence-storage'
import { formatParticipantsBlock } from '@/lib/job-intelligence-participants'
import { enrichMessageSenders } from '@/lib/message-sender-labels'
import { SCHEDULE_EVENT_LABELS, isScheduleEventType } from '@/lib/schedule-types'

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function enrichNoteAuthors(
  supabase: SupabaseClient,
  rows: Array<{
    id: string
    author_id: string
    body: string
    note_kind: string
    claim_id: string | null
    created_at: string
  }>
) {
  const ids = [...new Set(rows.map((r) => r.author_id))]
  let names: Record<string, string> = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', ids)
    names = Object.fromEntries(
      (profiles || []).map((p) => [
        p.id,
        p.full_name?.trim() || p.role || 'User',
      ])
    )
  }
  return rows.map((r) => ({
    ...r,
    author_name: names[r.author_id] || 'User',
  }))
}

/** Load project-wide context for AI summary and exports (focused job + full project history). */
export async function gatherJobIntelligenceContext(
  supabase: SupabaseClient,
  projectId: string,
  claimId: string
): Promise<JobIntelligenceContext | null> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) return null

  const { data: claim } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!claim) return null

  const { data: allClaims } = await supabase
    .from('claims')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const claimList = allClaims || []
  const claimIds = claimList.map((c) => c.id)
  const nameByClaim = Object.fromEntries(
    claimList.map((c) => [c.id, String(c.client_name || 'Job')])
  )

  let timelineEvents: JobIntelligenceContext['timelineEvents'] = []
  if (claimIds.length) {
    const { data: stored } = await supabase
      .from('claim_timeline_events')
      .select(
        'id, claim_id, event_date, title, description, source, created_at'
      )
      .in('claim_id', claimIds)
      .order('created_at', { ascending: true })
      .limit(300)

    timelineEvents = (stored || []).map((e) => ({
      ...e,
      client_name: nameByClaim[e.claim_id as string] || 'Job',
    }))
  }

  const { data: noteRows } = await supabase
    .from('internal_notes')
    .select('id, author_id, body, mentioned_user_ids, note_kind, claim_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200)

  const internalNotes = await enrichNoteAuthors(supabase, noteRows || [])

  const { data: messageRows } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('project_id', projectId)
    .eq('channel', 'project')
    .order('created_at', { ascending: true })
    .limit(200)

  const orgId = String(project.organization_id || '')
  const enrichedMessages = orgId
    ? await enrichMessageSenders(orgId, messageRows || [])
    : []

  const { data: scheduleRows } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('project_id', projectId)
    .order('starts_at', { ascending: true })
    .limit(200)

  const evidence: JobIntelligenceContext['evidence'] = []
  for (const c of claimList) {
    const files = await listEvidence(supabase, projectId, c.id)
    for (const e of files) {
      evidence.push({
        claim_id: c.id,
        client_name: nameByClaim[c.id] || 'Job',
        evidence_type: e.evidence_type,
        file_name: e.file_name,
        summary: e.summary,
        created_at: e.created_at,
        uploaded_by_label: e.uploaded_by_label,
      })
    }
  }

  return {
    project: project as Record<string, unknown>,
    claim: claim as Record<string, unknown>,
    allClaims: claimList as Array<Record<string, unknown>>,
    timelineEvents,
    internalNotes,
    projectMessages: enrichedMessages.map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      sender_label: m.sender_label,
    })),
    scheduleEvents: (scheduleRows || []) as Array<Record<string, unknown>>,
    evidence,
  }
}

/** Plain-text bundle for the LLM (truncated where needed). */
export function formatJobIntelligencePrompt(ctx: JobIntelligenceContext): string {
  const projectStarted = formatWhen(
    String(ctx.project.created_at || '')
  )
  const lines: string[] = [
    '=== ROLES (read carefully) ===',
    formatParticipantsBlock(ctx),
    '',
    '=== PROJECT ===',
    `Customer (property owner): ${ctx.project.customer_name}`,
    `Address: ${ctx.project.project_address}`,
    `Project notes: ${ctx.project.notes || '(none)'}`,
    `Project created: ${projectStarted}`,
    `Jobs on project: ${ctx.allClaims.length}`,
    '',
    '=== FOCUS JOB ===',
    `Job label / client name on file: ${ctx.claim.client_name}`,
    `Job reference number: ${ctx.claim.claim_number}`,
    `Property: ${ctx.claim.property_address}`,
    `Loss: ${ctx.claim.loss_type}`,
    `Insurer: ${ctx.claim.insurance_company}`,
    `Job #: ${ctx.claim.claim_number}`,
    `Status: ${ctx.claim.status}`,
    `Job notes: ${ctx.claim.notes || '(none)'}`,
    `Job created: ${formatWhen(String(ctx.claim.created_at || ''))}`,
    '',
    '=== ALL JOBS ON PROJECT ===',
  ]

  for (const c of ctx.allClaims) {
    lines.push(
      `- ${c.client_name} | status: ${c.status} | #${c.claim_number} | ${formatWhen(String(c.created_at || ''))}`
    )
  }

  lines.push('', '=== TIMELINE (chronological) ===')
  if (!ctx.timelineEvents.length) {
    lines.push('(none)')
  } else {
    for (const e of ctx.timelineEvents.slice(-80)) {
      lines.push(
        `[${formatWhen(e.created_at || e.event_date)}] (${e.client_name}) ${e.title}: ${e.description}`
      )
    }
  }

  lines.push('', '=== INTERNAL NOTES ===')
  if (!ctx.internalNotes.length) {
    lines.push('(none)')
  } else {
    for (const n of ctx.internalNotes.slice(-60)) {
      const scope = n.claim_id ? `job-linked` : 'project'
      lines.push(
        `[${formatWhen(n.created_at)}] ${n.author_name} (${n.note_kind}, ${scope}): ${n.body}`
      )
    }
  }

  lines.push('', '=== PROJECT MESSAGES ===')
  if (!ctx.projectMessages.length) {
    lines.push('(none)')
  } else {
    for (const m of ctx.projectMessages.slice(-80)) {
      lines.push(
        `[${formatWhen(m.created_at)}] ${m.sender_label}: ${m.body}`
      )
    }
  }

  lines.push('', '=== SCHEDULE & CALENDAR ===')
  if (!ctx.scheduleEvents.length) {
    lines.push('(none)')
  } else {
    for (const ev of ctx.scheduleEvents.slice(-60)) {
      const type = String(ev.event_type || 'other')
      const label = isScheduleEventType(type)
        ? SCHEDULE_EVENT_LABELS[type]
        : type
      lines.push(
        `[${formatWhen(String(ev.starts_at || ''))}] ${label} — ${ev.title || ''}: ${ev.description || ''}${ev.completed_at ? ' (completed)' : ''}`
      )
    }
  }

  lines.push('', '=== DOCUMENTS ===')
  if (!ctx.evidence.length) {
    lines.push('(none)')
  } else {
    for (const e of ctx.evidence.slice(-60)) {
      lines.push(
        `[${formatWhen(e.created_at)}] (${e.client_name}) [${e.evidence_type}] ${e.file_name} — ${e.summary}${e.uploaded_by_label ? ` · ${e.uploaded_by_label}` : ''}`
      )
    }
  }

  return lines.join('\n')
}
