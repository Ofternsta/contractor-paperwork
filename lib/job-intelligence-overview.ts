import 'server-only'

import { formatJobIntelligencePrompt } from '@/lib/gather-job-intelligence'
import {
  formatParticipantsBlock,
  listStaffParticipants,
} from '@/lib/job-intelligence-participants'
import type { JobIntelligenceContext } from '@/lib/job-intelligence-types'
import { normalizePdfCharacters } from '@/lib/pdf-text'

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function buildFallbackOverview(ctx: JobIntelligenceContext): string {
  const customer = String(ctx.project.customer_name || 'the customer')
  const address = String(ctx.project.project_address || 'the property')
  const jobRef = String(ctx.claim.claim_number || '')
  const loss = String(ctx.claim.loss_type || 'work')
  const status = String(ctx.claim.status || 'in progress')
  const started = formatWhen(String(ctx.project.created_at || ''))
  const staff = listStaffParticipants(ctx)

  const completedEvent = [...ctx.timelineEvents]
    .reverse()
    .find((e) => /completed/i.test(String(e.description || e.title)))

  const staffPhrase = staff.length
    ? `Contractor staff activity included ${staff.slice(0, 4).join(', ')}.`
    : ''

  const completedPhrase = completedEvent
    ? ` The job reached a completed state by ${formatWhen(completedEvent.created_at || completedEvent.event_date)}.`
    : ''

  const docCount = ctx.evidence.length
  const docPhrase =
    docCount > 0
      ? ` ${docCount} document(s) were uploaded to the project file.`
      : ''

  return normalizePdfCharacters(
    `This project for ${customer} at ${address} began on ${started}. ` +
      `The focus job (${jobRef || 'reference on file'}) covers ${loss} and is currently ${status}.${completedPhrase}` +
      ` ${customer} is the customer (property owner), not the contractor.${staffPhrase}${docPhrase}`
  ).trim()
}

const OVERVIEW_SYSTEM_PROMPT = `You write a contractor project narrative overview (4-6 sentences, past tense, clear prose).

RULES:
- The "Project customer" is the property owner/client. NEVER say the customer managed, led, ran, or supervised the project.
- People listed under "Contractor staff involved" are organization employees (admins/workers). Only they perform contractor work.
- Job reference numbers like AUTO-123 are internal IDs, not customer names.
- Use only facts from the data. No filler. Correct grammar and spacing between words.
- Return JSON only: { "overview": "..." }`

export async function generateOverviewWithGroq(
  ctx: JobIntelligenceContext
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })
    const dataBlock = [
      formatParticipantsBlock(ctx),
      '',
      formatJobIntelligencePrompt(ctx),
    ].join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OVERVIEW_SYSTEM_PROMPT },
        { role: 'user', content: dataBlock },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) return null

    const parsed = JSON.parse(raw) as { overview?: string }
    const overview = parsed.overview?.trim()
    if (!overview) return null

    return normalizePdfCharacters(overview)
  } catch (err) {
    console.error('Job intelligence overview failed:', err)
    return null
  }
}
