/** Replace Unicode punctuation that breaks Helvetica PDF rendering. */
export function normalizePdfCharacters(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\u2192/g, ' to ')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/** True when text looks like "S t a t u s" (spaces between individual letters). */
export function hasGarbledLetterSpacing(text: string): boolean {
  return /(?:^| )([A-Za-z0-9])(?: [A-Za-z0-9]){2,}(?: |$)/.test(text)
}

/**
 * Repair text where each letter was separated by spaces (garbled AI/PDF output only).
 * Does not run on normal prose — avoids turning "is a" into "isa".
 */
export function collapseLetterSpacing(text: string): string {
  if (!hasGarbledLetterSpacing(text)) return text

  let prev = ''
  let current = text
  for (let i = 0; i < 24; i++) {
    prev = current
    current = current.replace(
      /([A-Za-z0-9]) (?=[A-Za-z0-9](?: |$))/g,
      '$1'
    )
    if (current === prev) break
  }
  return current.replace(/ {2,}/g, ' ').trim()
}

/** For list sections that may contain garbled spaced-out tokens. */
export function sanitizeReportText(text: string): string {
  return collapseLetterSpacing(normalizePdfCharacters(text))
}

/** For narrative overview text — preserve normal word spacing. */
export function sanitizePdfText(text: string): string {
  return normalizePdfCharacters(text)
}
