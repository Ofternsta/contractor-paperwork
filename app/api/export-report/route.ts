import { NextResponse } from 'next/server'
import { generateClaimSummary } from '@/lib/claim-ai'
import { listEvidence } from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 60

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtmlReport(
  claim: Record<string, unknown>,
  summary: string,
  evidence: Awaited<ReturnType<typeof listEvidence>>
) {
  const evidenceRows = evidence
    .map(
      (e) => `<tr><td>${escapeHtml(e.evidence_type)}</td><td>${escapeHtml(e.file_name)}</td><td>${escapeHtml(e.summary)}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Claim Report</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.5rem}table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}
@media print{body{margin:0}}</style></head><body>
<h1>Claim Evidence Report</h1>
<p><strong>Client:</strong> ${escapeHtml(String(claim.client_name))}</p>
<p><strong>Property:</strong> ${escapeHtml(String(claim.property_address))}</p>
<p><strong>Claim #:</strong> ${escapeHtml(String(claim.claim_number))}</p>
<p><strong>Insurer:</strong> ${escapeHtml(String(claim.insurance_company))}</p>
<p><strong>Status:</strong> ${escapeHtml(String(claim.status))}</p>
<h2>AI Summary</h2>
<p>${escapeHtml(summary)}</p>
<h2>Evidence (${evidence.length})</h2>
<table><thead><tr><th>Type</th><th>File</th><th>Summary</th></tr></thead>
<tbody>${evidenceRows}</tbody></table>
<p><em>Generated ${new Date().toLocaleString()} — Contractor Paperwork. Use Print → Save as PDF.</em></p>
</body></html>`
}

async function buildPdfReport(
  claim: Record<string, unknown>,
  summary: string,
  evidence: Awaited<ReturnType<typeof listEvidence>>
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

    addLine('Claim Evidence Report', true)
    y += 6
    addLine(`Client: ${claim.client_name}`)
    addLine(`Property: ${claim.property_address}`)
    addLine(`Claim #: ${claim.claim_number}`)
    addLine(`Insurer: ${claim.insurance_company}`)
    addLine(`Status: ${claim.status}`)
    addLine(`Loss type: ${claim.loss_type}`)
    y += 8
    addLine('AI Summary', true)
    addLine(summary)
    y += 8
    addLine(`Evidence (${evidence.length} files)`, true)

    for (const e of evidence) {
      addLine(`• [${e.evidence_type}] ${e.file_name}`)
      addLine(`  ${e.summary}`)
      if (e.extracted_text) {
        addLine(`  Extracted: ${e.extracted_text.slice(0, 400)}`)
      }
      y += 4
    }

    addLine('')
    addLine(`Generated ${new Date().toLocaleString()} — Contractor Paperwork`)

    return doc.output('arraybuffer')
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URL(req.url).searchParams
    const claimId = params.get('claim_id')
    const projectId = params.get('project_id')
    const format = params.get('format') || 'pdf'

    if (!claimId || !projectId) {
      return NextResponse.json(
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const { data: claim, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const evidence = await listEvidence(supabase, projectId, claimId)
    const summary = await generateClaimSummary(claim, evidence)
    const safeName = `claim-${claim.claim_number || claimId}`.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )

    if (format === 'html') {
      const html = buildHtmlReport(claim, summary, evidence)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${safeName}.html"`,
        },
      })
    }

    const pdfBytes = await buildPdfReport(claim, summary, evidence)

    if (pdfBytes) {
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    const html = buildHtmlReport(claim, summary, evidence)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeName}.html"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
