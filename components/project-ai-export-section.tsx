'use client'

import { useEffect, useState } from 'react'
import { JobIntelligenceSummary } from '@/components/job-intelligence-summary'
import { LegalNotice } from '@/components/legal-notice'
import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'
import { isUnlimited } from '@/lib/plan-entitlements'

type ProjectAiExportSectionProps = {
  claimId: string
  projectId: string
  canGenerate: boolean
  canExportPdf: boolean
  canExportHtml: boolean
  aiSummariesLimit: number
  aiSummariesUsed: number
}

export function ProjectAiExportSection({
  claimId,
  projectId,
  canGenerate,
  canExportPdf,
  canExportHtml,
  aiSummariesLimit,
  aiSummariesUsed,
}: ProjectAiExportSectionProps) {
  const [report, setReport] = useState<JobIntelligenceReport | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiAtLimit =
    !isUnlimited(aiSummariesLimit) && aiSummariesUsed >= aiSummariesLimit

  useEffect(() => {
    setReport(null)
    setError(null)
  }, [claimId, projectId])

  async function generateSummary() {
    if (!canGenerate || aiAtLimit) return
    setLoadingSummary(true)
    setError(null)
    const res = await fetch('/api/claim-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, project_id: projectId }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not generate summary')
    } else if (payload.report) {
      setReport(payload.report as JobIntelligenceReport)
    }
    setLoadingSummary(false)
  }

  function exportReport(format: 'pdf' | 'html') {
    const url = `/api/export-report?claim_id=${claimId}&project_id=${projectId}&format=${format}`
    window.open(url, '_blank')
  }

  const showSection =
    canGenerate || canExportPdf || canExportHtml || report !== null

  if (!showSection) return null

  return (
    <section className="border border-brand-dim/40 rounded-xl p-4 bg-surface-elevated space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-lg text-foreground">
            AI summary &amp; export
          </h2>
          <p className="text-xs text-muted mt-1">
            Full project report for the selected job — status, timeline,
            messages, notes, calendar, and documents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <button
              type="button"
              onClick={generateSummary}
              disabled={loadingSummary || aiAtLimit}
              className="text-sm btn-primary text-[#052e16] px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
            >
              {loadingSummary ? 'Generating…' : 'Generate AI summary'}
            </button>
          )}
          {canExportPdf && (
            <button
              type="button"
              onClick={() => exportReport('pdf')}
              className="text-sm border border-border px-3 py-2 rounded-lg min-h-[40px]"
            >
              Export PDF
            </button>
          )}
          {canExportHtml && !canExportPdf && (
            <button
              type="button"
              onClick={() => exportReport('html')}
              className="text-sm border border-border px-3 py-2 rounded-lg min-h-[40px]"
            >
              Export HTML
            </button>
          )}
        </div>
      </div>

      {!isUnlimited(aiSummariesLimit) && canGenerate && (
        <p className="text-xs text-muted">
          AI summaries this month: {aiSummariesUsed} / {aiSummariesLimit}
          {aiAtLimit && ' — limit reached. Upgrade for more.'}
        </p>
      )}

      {error && (
        <p className="text-sm alert-error rounded-lg p-2">{error}</p>
      )}

      {!report && canGenerate && !loadingSummary && (
        <p className="text-sm text-muted-dim">
          Generate a categorized summary, then export a formatted PDF or HTML
          packet with the same content.
        </p>
      )}

      {report && <JobIntelligenceSummary report={report} />}

      {(canExportPdf || canExportHtml) && <LegalNotice id="export-backup" />}
      {canGenerate && <LegalNotice id="ai" />}
    </section>
  )
}
