import 'server-only'
import type { EvidenceRecord } from '@/lib/evidence-storage'

export type TimelineEvent = {
  event_date: string
  title: string
  description: string
  source: 'ai' | 'evidence' | 'manual'
}

/** @deprecated Use generateJobIntelligenceReport — kept for timeline helpers only */
export async function generateClaimSummary(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
): Promise<string> {
  return buildFallbackSummary(claim, evidence)
}

export async function generateClaimTimeline(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
): Promise<TimelineEvent[]> {
  const apiKey = process.env.GROQ_API_KEY
  const fallback = buildFallbackTimeline(claim, evidence)
  if (!apiKey) return fallback

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })

    const evidenceBlock = evidence
      .map(
        (e) =>
          `${e.created_at?.slice(0, 10) || 'unknown'} | ${e.evidence_type} | ${e.file_name} | ${e.summary}`
      )
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Return JSON: { "events": [ { "event_date": "YYYY-MM-DD", "title": "...", "description": "..." } ] }
Build a chronological claim timeline from evidence. Max 12 events. Use evidence dates when available.`,
        },
        {
          role: 'user',
          content: `Claim status: ${claim.status}
Evidence:
${evidenceBlock || 'No evidence yet'}`,
        },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as {
      events?: Array<{ event_date?: string; title?: string; description?: string }>
    }

    const events = (parsed.events || [])
      .filter((e) => e.title)
      .map((e) => ({
        event_date: e.event_date || new Date().toISOString().slice(0, 10),
        title: e.title!,
        description: e.description || '',
        source: 'ai' as const,
      }))

    return events.length ? events : fallback
  } catch (err) {
    console.error('Timeline generation failed:', err)
    return fallback
  }
}

export function buildFallbackSummary(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
) {
  const types = [...new Set(evidence.map((e) => e.evidence_type))]
  return `${claim.client_name} — ${claim.status} job at ${claim.property_address}. ${evidence.length} document(s) on record${types.length ? ` (${types.join(', ')})` : ''}. Reference: ${claim.insurance_company}, job #${claim.claim_number}.`
}

function buildFallbackTimeline(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      event_date: new Date().toISOString().slice(0, 10),
      title: 'Job opened',
      description: `${claim.status} — ${claim.loss_type}`,
      source: 'manual',
    },
  ]

  for (const e of evidence.slice(0, 8)) {
    events.push({
      event_date: e.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      title: e.evidence_type,
      description: e.summary,
      source: 'evidence',
    })
  }

  return events
}
