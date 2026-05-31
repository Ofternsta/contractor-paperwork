import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'
import { expandBodyToDisplayLines } from '@/lib/report-body-format'
import { sanitizePdfText, sanitizeReportText } from '@/lib/pdf-text'

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function entryHtml(line: string) {
  const messageMatch = line.match(/^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:—|-)\s*(.+?):\s*(.+)$/i)
  if (messageMatch) {
    const [, when, sender, body] = messageMatch
    return `<div class="entry"><p class="entry-when">${escapeHtml(when.trim())}</p><p class="entry-body"><strong>${escapeHtml(sender.trim())}</strong>: ${escapeHtml(body.trim())}</p></div>`
  }

  const datedMatch = line.match(/^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*:\s*(.+)$/i)
  if (datedMatch) {
    const [, when, rest] = datedMatch
    return `<div class="entry"><p class="entry-when">${escapeHtml(when.trim())}</p><p class="entry-body">${escapeHtml(rest.trim())}</p></div>`
  }

  return `<p class="entry-body">${escapeHtml(line)}</p>`
}

function sectionHtml(section: { title: string; body: string }, index: number) {
  const entries = expandBodyToDisplayLines(section.body)
    .map((line) => entryHtml(line))
    .join('')

  return `
    <section class="report-section" id="section-${index}">
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
      <div class="section-body">${entries}</div>
    </section>`
}

export function buildHtmlJobReport(report: JobIntelligenceReport) {
  const generated = new Date(report.generatedAt).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const sectionsHtml = report.sections.map((s, i) => sectionHtml(s, i)).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LedgerStack — ${escapeHtml(report.jobLabel)}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
      --accent: #059669;
      --accent-soft: #ecfdf5;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--ink);
      max-width: 820px;
      margin: 0 auto;
      padding: 2rem 1.5rem 3rem;
      line-height: 1.55;
      font-size: 14px;
    }
    .report-header {
      border-bottom: 3px solid var(--accent);
      padding-bottom: 1.25rem;
      margin-bottom: 1.75rem;
    }
    .report-brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
      margin: 0 0 0.5rem;
    }
    h1 {
      font-size: 1.65rem;
      margin: 0 0 0.35rem;
      line-height: 1.25;
    }
    .report-meta {
      color: var(--muted);
      font-size: 13px;
      margin: 0;
    }
    .overview-card {
      background: var(--accent-soft);
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      padding: 1.1rem 1.25rem;
      margin-top: 1.75rem;
    }
    .overview-card h2 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin: 0 0 0.5rem;
    }
    .overview-card p { margin: 0; white-space: pre-line; }
    .report-section {
      margin-bottom: 1.75rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
      page-break-inside: avoid;
    }
    .report-section:last-of-type { border-bottom: none; }
    .section-title {
      font-size: 1.05rem;
      margin: 0 0 0.85rem;
      padding-left: 0.75rem;
      border-left: 4px solid var(--accent);
      color: var(--ink);
    }
    .section-body { display: flex; flex-direction: column; gap: 1rem; }
    .entry { margin: 0; }
    .entry-when {
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 0.25rem;
    }
    .entry-body { margin: 0; }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    @media print {
      body { margin: 0; padding: 1rem; }
      .report-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="report-header">
    <p class="report-brand">LedgerStack</p>
    <h1>${escapeHtml(report.jobLabel)}</h1>
    <p class="report-meta">
      ${escapeHtml(report.projectName)} · Generated ${escapeHtml(generated)}
    </p>
  </header>

  ${sectionsHtml}

  <div class="overview-card ai-summary-block">
    <h2>AI summary</h2>
    <p>${escapeHtml(sanitizePdfText(report.overview))}</p>
  </div>

  <p class="footer">Confidential project report — LedgerStack</p>
</body>
</html>`
}

export async function buildPdfJobReport(
  report: JobIntelligenceReport
): Promise<ArrayBuffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 48
    const contentX = margin + 10
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxWidth = pageWidth - margin - contentX
    let y = margin
    const lineHeight = 14
    const entryGap = 10
    const sectionGap = 20

    function newPageIfNeeded(extra = lineHeight) {
      if (y + extra > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    function wrapLines(text: string): string[] {
      const wrapped = doc.splitTextToSize(sanitizeReportText(text), maxWidth)
      if (Array.isArray(wrapped)) return wrapped.map(String)
      return [String(wrapped)]
    }

    function printLines(lines: string[], x: number) {
      const safe = Array.isArray(lines) ? lines : [String(lines)]
      for (const line of safe) {
        newPageIfNeeded()
        doc.text(String(line), x, y)
        y += lineHeight
      }
    }

    function addWrappedText(
      text: string,
      opts?: { bold?: boolean; size?: number; color?: [number, number, number]; x?: number }
    ) {
      const x = opts?.x ?? contentX
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
      doc.setFontSize(opts?.size ?? 10)
      if (opts?.color) doc.setTextColor(...opts.color)
      else doc.setTextColor(15, 23, 42)

      printLines(wrapLines(text), x)

      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
    }

    function addSectionTitle(title: string) {
      newPageIfNeeded(sectionGap + 24)
      y += sectionGap
      const barY = y - 11
      doc.setFillColor(5, 150, 105)
      doc.rect(margin, barY, 4, 16, 'F')
      addWrappedText(title, { bold: true, size: 12, x: contentX })
      y += 6
    }

    function addTimelineStyleEntry(when: string, detail: string) {
      addWrappedText(when.trim(), { size: 9, color: [71, 85, 105] })
      addWrappedText(detail.trim())
      y += entryGap
    }

    function addEntryLine(line: string) {
      const cleaned = sanitizeReportText(line)

      const messageMatch = cleaned.match(
        /^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:—|-)\s*(.+?):\s*(.+)$/i
      )
      if (messageMatch) {
        const [, when, sender, body] = messageMatch
        addTimelineStyleEntry(when, `${sender.trim()}: ${body.trim()}`)
        return
      }

      const datedMatch = cleaned.match(
        /^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*:\s*(.+)$/i
      )
      if (datedMatch) {
        const [, when, rest] = datedMatch
        addTimelineStyleEntry(when, rest)
        return
      }

      const dateOnly = cleaned.match(
        /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i
      )
      if (dateOnly) {
        addWrappedText(dateOnly[1], { size: 9, color: [71, 85, 105] })
        y += entryGap
        return
      }

      addWrappedText(cleaned)
      y += entryGap
    }

    doc.setFillColor(236, 253, 245)
    doc.rect(0, 0, pageWidth, 72, 'F')
    doc.setTextColor(5, 120, 90)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('LEDGERSTACK PROJECT REPORT', margin, 28)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(18)
    doc.text(String(report.jobLabel).slice(0, 60), margin, 48)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const meta = `${report.projectName} · ${new Date(report.generatedAt).toLocaleString()}`
    y = 62
    printLines(wrapLines(meta), margin)
    y = 92
    doc.setTextColor(15, 23, 42)

    for (const section of report.sections) {
      addSectionTitle(section.title)
      const entries = expandBodyToDisplayLines(section.body)
      if (!entries.length) {
        addWrappedText('No entries.')
        y += entryGap
        continue
      }
      for (const entry of entries) {
        addEntryLine(entry)
      }
    }

    addSectionTitle('AI summary')
    printLines(wrapLines(sanitizePdfText(report.overview)), contentX)

    newPageIfNeeded(30)
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    addWrappedText('Confidential project report — LedgerStack', {
      color: [100, 116, 139],
    })

    return doc.output('arraybuffer')
  } catch {
    return null
  }
}
