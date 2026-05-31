import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bodyToHtmlParagraphs(body: string) {
  const lines = body.split('\n').filter((l) => l.trim())
  return lines
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
        return `<li>${escapeHtml(trimmed.replace(/^[•-]\s*/, ''))}</li>`
      }
      return `<p>${escapeHtml(trimmed)}</p>`
    })
    .join('')
}

function sectionHtml(section: { title: string; body: string }, index: number) {
  const lines = section.body.split('\n').filter((l) => l.trim())
  const hasBullets = lines.some(
    (l) => l.trim().startsWith('•') || l.trim().startsWith('- ')
  )
  const bodyContent = hasBullets
    ? `<ul class="section-list">${bodyToHtmlParagraphs(section.body)}</ul>`
    : bodyToHtmlParagraphs(section.body)

  return `
    <section class="report-section" id="section-${index}">
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
      <div class="section-body">${bodyContent}</div>
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
      margin-bottom: 1.75rem;
    }
    .overview-card h2 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin: 0 0 0.5rem;
    }
    .overview-card p { margin: 0; }
    .report-section {
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
      page-break-inside: avoid;
    }
    .report-section:last-child { border-bottom: none; }
    .section-title {
      font-size: 1.05rem;
      margin: 0 0 0.65rem;
      padding-left: 0.65rem;
      border-left: 4px solid var(--accent);
      color: var(--ink);
    }
    .section-body p { margin: 0 0 0.5rem; }
    .section-list {
      margin: 0;
      padding-left: 1.25rem;
    }
    .section-list li { margin-bottom: 0.35rem; }
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
    <p>${escapeHtml(report.overview)}</p>
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
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxWidth = pageWidth - margin * 2
    let y = margin
    const lineHeight = 14
    const sectionGap = 18

    function newPageIfNeeded(extra = lineHeight) {
      if (y + extra > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    function addLine(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
      if (opts?.size) doc.setFontSize(opts.size)
      else doc.setFontSize(10)
      if (opts?.color) doc.setTextColor(...opts.color)
      else doc.setTextColor(15, 23, 42)

      const lines = doc.splitTextToSize(text, maxWidth)
      for (const line of lines) {
        newPageIfNeeded()
        doc.text(line, margin, y)
        y += lineHeight
      }
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
    }

    function addSectionTitle(title: string) {
      newPageIfNeeded(sectionGap + 20)
      y += sectionGap
      doc.setFillColor(5, 150, 105)
      doc.rect(margin, y - 10, 4, 16, 'F')
      addLine(title, { bold: true, size: 12, color: [15, 23, 42] })
      y += 4
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
    doc.text(doc.splitTextToSize(meta, maxWidth)[0] || meta, margin, 62)
    y = 88
    doc.setTextColor(0, 0, 0)

    for (const section of report.sections) {
      addSectionTitle(section.title)
      const paragraphs = section.body.split('\n')
      for (const para of paragraphs) {
        const t = para.trim()
        if (!t) continue
        addLine(t)
      }
    }

    addSectionTitle('AI summary')
    addLine(report.overview)

    newPageIfNeeded(30)
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    addLine('Confidential project report — LedgerStack')

    return doc.output('arraybuffer')
  } catch {
    return null
  }
}
