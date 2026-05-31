import type { EvidenceRecord } from '@/lib/evidence-storage'

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildHtmlReport(
  claim: Record<string, unknown>,
  summary: string,
  evidence: EvidenceRecord[]
) {
  const evidenceRows = evidence
    .map((e) => {
      const when = e.created_at
        ? new Date(e.created_at).toLocaleString()
        : '—'
      const who = e.uploaded_by_label || '—'
      return `<tr><td>${escapeHtml(e.evidence_type)}</td><td>${escapeHtml(e.file_name)}</td><td>${escapeHtml(when)}</td><td>${escapeHtml(who)}</td><td>${escapeHtml(e.summary)}</td></tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LedgerStack Job Export</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.5rem}table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}
@media print{body{margin:0}}
</style></head><body>
<h1>Job — documents</h1>
<p><strong>Client:</strong> ${escapeHtml(String(claim.client_name))}</p>
<p><strong>Property:</strong> ${escapeHtml(String(claim.property_address))}</p>
<p><strong>Job #:</strong> ${escapeHtml(String(claim.claim_number))}</p>
<p><strong>Insurer:</strong> ${escapeHtml(String(claim.insurance_company))}</p>
<p><strong>Status:</strong> ${escapeHtml(String(claim.status))}</p>
<h2>AI Summary</h2>
<p>${escapeHtml(summary)}</p>
<h2>Documents (${evidence.length})</h2>
<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>By</th><th>Summary</th></tr></thead>
<tbody>${evidenceRows}</tbody></table>
<p><em>Generated ${new Date().toLocaleString()} — LedgerStack. Use Print → Save as PDF.</em></p>
</body></html>`
}

export async function buildPdfReport(
  claim: Record<string, unknown>,
  summary: string,
  evidence: EvidenceRecord[]
): Promise<ArrayBuffer | null> {
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 48
    let y = margin
    const lineHeight = 14
    const pageWidth = doc.internal.pageSize.getWidth()
    const maxWidth = pageWidth - margin * 2

    function addLine(text: string, bold = false) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, maxWidth)
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += lineHeight
      }
    }

    addLine('Report — documents', true)
    y += 6
    addLine(`Client: ${claim.client_name}`)
    addLine(`Property: ${claim.property_address}`)
    addLine(`Job #: ${claim.claim_number}`)
    addLine(`Insurer: ${claim.insurance_company}`)
    addLine(`Status: ${claim.status}`)
    addLine(`Loss type: ${claim.loss_type}`)
    y += 8
    addLine('AI Summary', true)
    addLine(summary)
    y += 8
    addLine(`Documents (${evidence.length} files)`, true)

    for (const e of evidence) {
      const when = e.created_at
        ? new Date(e.created_at).toLocaleString()
        : 'unknown time'
      const who = e.uploaded_by_label || 'unknown uploader'
      addLine(`• [${e.evidence_type}] ${e.file_name}`)
      addLine(`  Uploaded ${when} · ${who}`)
      addLine(`  ${e.summary}`)
      if (e.extracted_text) {
        addLine(`  Extracted: ${e.extracted_text.slice(0, 400)}`)
      }
      y += 4
    }

    addLine('')
    addLine(`Generated ${new Date().toLocaleString()} — LedgerStack`)

    return doc.output('arraybuffer')
  } catch {
    return null
  }
}
