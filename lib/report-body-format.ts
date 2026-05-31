/** Split comma-glued entries that start with a month name (common in AI-compressed timelines/messages). */
const MONTH_COMMA_SPLIT =
  /,\s*(?=(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d)/i

/** Split "date: msg,date: msg" when messages were joined on one line. */
const DATE_TIME_COLON_SPLIT =
  /,\s*(?=\d{4},\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*:)/i

export function joinSectionEntries(lines: string[]): string {
  return lines.filter((l) => l.trim()).join('\n\n')
}

function splitGluedCommaEntries(text: string): string[] {
  const byMonth = text.split(MONTH_COMMA_SPLIT).map((s) => s.trim()).filter(Boolean)
  if (byMonth.length > 1) return byMonth

  const byDateTime = text.split(DATE_TIME_COLON_SPLIT).map((s) => s.trim()).filter(Boolean)
  if (byDateTime.length > 1) return byDateTime

  return [text]
}

/** Turn section body text into one display/PDF line per entry with breathing room. */
export function expandBodyToDisplayLines(body: string): string[] {
  const result: string[] = []

  for (const block of body.split(/\n\s*\n/)) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue

    for (const rawLine of trimmedBlock.split('\n')) {
      const line = rawLine.trim().replace(/^[•\-]\s*/, '')
      if (!line) continue

      for (const part of splitGluedCommaEntries(line)) {
        result.push(part)
      }
    }
  }

  return result
}

/** Re-flow section bodies so UI/PDF/exports stay one entry per paragraph. */
export function normalizeSectionBody(body: string, sectionId?: string): string {
  const expanded = expandBodyToDisplayLines(body)
  if (expanded.length === 0) return body.trim()

  if (sectionId === 'messages') {
    return expanded
      .map((line) => {
        if (/^.+?\s+—\s+.+?:\s/.test(line)) return line
        const colon = line.match(/^(.+?\d{4},?\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*:\s*(.+)$/i)
        if (colon) {
          return `${colon[1].trim()}: ${colon[2].trim()}`
        }
        return line
      })
      .join('\n\n')
  }

  return expanded.join('\n\n')
}

export function normalizeReportBodies<T extends { sections: Array<{ id: string; body: string }> }>(
  report: T
): T {
  return {
    ...report,
    sections: report.sections.map((s) => ({
      ...s,
      body: normalizeSectionBody(s.body, s.id),
    })),
  }
}
