import type { JobIntelligenceContext } from '@/lib/job-intelligence-types'

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

/** Contractor staff who posted messages or notes (excludes the project customer). */
export function listStaffParticipants(ctx: JobIntelligenceContext): string[] {
  const customer = normalizeName(String(ctx.project.customer_name || ''))
  const seen = new Set<string>()
  const out: string[] = []

  function add(label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    const baseName = trimmed.split(' (')[0].trim()
    if (customer && normalizeName(baseName) === customer) return
    if (seen.has(trimmed)) return
    seen.add(trimmed)
    out.push(trimmed)
  }

  for (const m of ctx.projectMessages) {
    add(m.sender_label)
  }
  for (const n of ctx.internalNotes) {
    add(n.author_name)
  }

  return out
}

export function formatParticipantsBlock(ctx: JobIntelligenceContext): string {
  const customer = String(ctx.project.customer_name || 'Unknown')
  const staff = listStaffParticipants(ctx)
  const lines = [
    `Project customer (property owner — NOT contractor staff): ${customer}`,
    staff.length
      ? `Contractor staff involved: ${staff.join('; ')}`
      : 'Contractor staff involved: (none named in messages or notes)',
  ]
  return lines.join('\n')
}
