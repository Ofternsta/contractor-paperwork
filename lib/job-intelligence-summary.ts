import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  formatJobIntelligencePrompt,
  gatherJobIntelligenceContext,
} from '@/lib/gather-job-intelligence'
import {
  JOB_INTELLIGENCE_SECTION_IDS,
  JOB_INTELLIGENCE_SECTION_TITLES,
  type JobIntelligenceContext,
  type JobIntelligenceReport,
  type JobIntelligenceSection,
  type JobIntelligenceSectionId,
} from '@/lib/job-intelligence-types'
import {
  joinSectionEntries,
  normalizeReportBodies,
} from '@/lib/report-body-format'

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function orderedSections(sections: JobIntelligenceSection[]): JobIntelligenceSection[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  return JOB_INTELLIGENCE_SECTION_IDS.map((id) => {
    const existing = byId.get(id)
    if (existing) return existing
    return {
      id,
      title: JOB_INTELLIGENCE_SECTION_TITLES[id],
      body: 'No activity recorded in this category yet.',
    }
  })
}

export function buildFallbackReport(ctx: JobIntelligenceContext): JobIntelligenceReport {
  const focusClaimId = String(ctx.claim.id || '')
  const focusEvidence = ctx.evidence.filter((e) => e.claim_id === focusClaimId)

  const projectBody = [
    `Customer: ${ctx.project.customer_name}`,
    `Address: ${ctx.project.project_address}`,
    `Project started: ${formatWhen(String(ctx.project.created_at || ''))}`,
    ctx.project.notes
      ? `Project notes: ${ctx.project.notes}`
      : null,
    `${ctx.allClaims.length} job(s) on this project.`,
    ...ctx.allClaims.map(
      (c) =>
        `• ${c.client_name} — ${c.status} (job #${c.claim_number})`
    ),
  ]
    .filter(Boolean)
    .join('\n')

  const statusBody = [
    `Current status: ${ctx.claim.status}`,
    `Loss type: ${ctx.claim.loss_type}`,
    `Insurer: ${ctx.claim.insurance_company}`,
    `Job number: ${ctx.claim.claim_number}`,
    ctx.claim.notes ? `Job notes: ${ctx.claim.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const timelineBody =
    ctx.timelineEvents.length === 0
      ? 'No timeline entries yet.'
      : joinSectionEntries(
          ctx.timelineEvents.map(
            (e) =>
              `${formatWhen(e.created_at || e.event_date)} — ${e.client_name}: ${e.title}. ${e.description}`
          )
        )

  const notesBody =
    ctx.internalNotes.length === 0
      ? 'No internal notes.'
      : joinSectionEntries(
          ctx.internalNotes.map(
            (n) =>
              `${formatWhen(n.created_at)} — ${n.author_name} (${n.note_kind}): ${n.body}`
          )
        )

  const messagesBody =
    ctx.projectMessages.length === 0
      ? 'No project messages.'
      : joinSectionEntries(
          ctx.projectMessages.map(
            (m) => `${formatWhen(m.created_at)} — ${m.sender_label}: ${m.body}`
          )
        )

  const scheduleBody =
    ctx.scheduleEvents.length === 0
      ? 'No scheduled events.'
      : joinSectionEntries(
          ctx.scheduleEvents.map((ev) => {
            const done = ev.completed_at ? ' (done)' : ''
            return `${formatWhen(String(ev.starts_at || ''))} — ${ev.title || 'Event'}: ${ev.description || ''}${done}`
          })
        )

  const documentsBody =
    ctx.evidence.length === 0
      ? 'No documents uploaded.'
      : joinSectionEntries([
          `Total documents across project: ${ctx.evidence.length}`,
          `On this job: ${focusEvidence.length}`,
          ...ctx.evidence.map(
            (e) =>
              `${formatWhen(e.created_at)} — ${e.client_name} [${e.evidence_type}] ${e.file_name}: ${e.summary}`
          ),
        ])

  const sections: JobIntelligenceSection[] = [
    { id: 'project_overview', title: JOB_INTELLIGENCE_SECTION_TITLES.project_overview, body: projectBody },
    { id: 'job_status', title: JOB_INTELLIGENCE_SECTION_TITLES.job_status, body: statusBody },
    { id: 'timeline', title: JOB_INTELLIGENCE_SECTION_TITLES.timeline, body: timelineBody },
    { id: 'internal_notes', title: JOB_INTELLIGENCE_SECTION_TITLES.internal_notes, body: notesBody },
    { id: 'messages', title: JOB_INTELLIGENCE_SECTION_TITLES.messages, body: messagesBody },
    { id: 'schedule', title: JOB_INTELLIGENCE_SECTION_TITLES.schedule, body: scheduleBody },
    { id: 'documents', title: JOB_INTELLIGENCE_SECTION_TITLES.documents, body: documentsBody },
  ]

  const overview = `Project for ${ctx.project.customer_name} at ${ctx.project.project_address}. Focus job ${ctx.claim.client_name} is ${ctx.claim.status} with ${focusEvidence.length} document(s), ${ctx.timelineEvents.length} timeline entries, ${ctx.internalNotes.length} internal note(s), ${ctx.projectMessages.length} message(s), and ${ctx.scheduleEvents.length} calendar event(s) since the project began.`

  return {
    generatedAt: new Date().toISOString(),
    overview,
    sections,
    claimId: focusClaimId,
    projectId: String(ctx.project.id),
    projectName: String(ctx.project.customer_name || 'Project'),
    jobLabel: String(ctx.claim.client_name || 'Job'),
  }
}

async function generateWithGroq(
  ctx: JobIntelligenceContext
): Promise<JobIntelligenceReport | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })
    const dataBlock = formatJobIntelligencePrompt(ctx)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write detailed contractor project reports from field data. Return JSON only:
{
  "overview": "Detailed AI narrative (4-8 sentences) synthesizing the full project story since start — place this last in the report; sections above hold categorized facts",
  "sections": [
    { "id": "project_overview", "title": "...", "body": "..." },
    { "id": "job_status", "title": "...", "body": "..." },
    { "id": "timeline", "title": "...", "body": "..." },
    { "id": "internal_notes", "title": "...", "body": "..." },
    { "id": "messages", "title": "...", "body": "..." },
    { "id": "schedule", "title": "...", "body": "..." },
    { "id": "documents", "title": "...", "body": "..." }
  ]
}
Use ONLY facts from the data. Each section body: one entry per line, separated by a blank line (double newline). Never join entries with commas on a single line. For messages always include sender name: "May 26, 2026, 11:21 PM — Name (Role): message text". Timeline, notes, schedule, and documents follow the same one-entry-per-paragraph rule. Do not merge sections. If a category is empty, say so briefly.`,
        },
        {
          role: 'user',
          content: dataBlock,
        },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) return null

    const parsed = JSON.parse(raw) as {
      overview?: string
      sections?: Array<{ id?: string; title?: string; body?: string }>
    }

    const sections: JobIntelligenceSection[] = (parsed.sections || [])
      .filter((s) => s.body && s.id && JOB_INTELLIGENCE_SECTION_IDS.includes(s.id as JobIntelligenceSectionId))
      .map((s) => ({
        id: s.id as JobIntelligenceSectionId,
        title:
          s.title?.trim() ||
          JOB_INTELLIGENCE_SECTION_TITLES[s.id as JobIntelligenceSectionId],
        body: String(s.body).trim(),
      }))

    const claimId = String(ctx.claim.id || '')
    return normalizeReportBodies({
      generatedAt: new Date().toISOString(),
      overview:
        parsed.overview?.trim() ||
        buildFallbackReport(ctx).overview,
      sections: orderedSections(sections),
      claimId,
      projectId: String(ctx.project.id),
      projectName: String(ctx.project.customer_name || 'Project'),
      jobLabel: String(ctx.claim.client_name || 'Job'),
    })
  } catch (err) {
    console.error('Job intelligence summary failed:', err)
    return null
  }
}

export async function generateJobIntelligenceReport(
  supabase: SupabaseClient,
  projectId: string,
  claimId: string
): Promise<JobIntelligenceReport | null> {
  const ctx = await gatherJobIntelligenceContext(supabase, projectId, claimId)
  if (!ctx) return null

  const ai = await generateWithGroq(ctx)
  if (ai) return ai

  return normalizeReportBodies(buildFallbackReport(ctx))
}

/** Flat text for legacy callers. */
export function reportToPlainText(report: JobIntelligenceReport): string {
  const parts = [
    ...report.sections.map((s) => `${s.title}\n${s.body}`),
    `AI summary\n${report.overview}`,
  ]
  return parts.join('\n\n')
}
