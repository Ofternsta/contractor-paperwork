import 'server-only'
import type { EvidenceRecord } from '@/lib/evidence-storage'

export type TimelineEvent = {
  event_date: string
  title: string
  description: string
  source: 'ai' | 'evidence' | 'manual'
}

export async function generateClaimSummary(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  const fallback = buildFallbackSummary(claim, evidence)
  if (!apiKey) return fallback

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })

    const evidenceBlock = evidence
      .slice(0, 40)
      .map(
        (e) =>
          `- [${e.evidence_type}] ${e.file_name}: ${e.summary}${e.extracted_text ? `\n  Text: ${e.extracted_text.slice(0, 500)}` : ''}`
      )
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You write concise restoration insurance claim summaries for contractors. Use only facts from the data provided. 3-5 sentences.',
        },
        {
          role: 'user',
          content: `Claim:
Client: ${claim.client_name}
Property: ${claim.property_address}
Loss: ${claim.loss_type}
Insurer: ${claim.insurance_company}
Claim #: ${claim.claim_number}
Status: ${claim.status}
Notes: ${claim.notes || 'none'}

Evidence (${evidence.length} files):
${evidenceBlock || '(none)'}`,
        },
      ],
    })

    return completion.choices?.[0]?.message?.content?.trim() || fallback
  } catch (err) {
    console.error('Claim summary failed:', err)
    return fallback
  }
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

function buildFallbackSummary(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
) {
  const types = [...new Set(evidence.map((e) => e.evidence_type))]
  return `${claim.client_name} — ${claim.status} claim at ${claim.property_address}. ${evidence.length} evidence file(s) on record${types.length ? ` (${types.join(', ')})` : ''}. Insurer: ${claim.insurance_company}, claim #${claim.claim_number}.`
}

function buildFallbackTimeline(
  claim: Record<string, unknown>,
  evidence: EvidenceRecord[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      event_date: new Date().toISOString().slice(0, 10),
      title: 'Claim opened',
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
