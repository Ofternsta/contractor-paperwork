'use client'

import { useEffect, useState } from 'react'
import { isUnlimited } from '@/lib/plan-entitlements'

type TimelineEvent = {
  event_date: string
  title: string
  description: string
  source?: string
}

type ClaimAiPanelProps = {
  claimId: string
  projectId: string
  canGenerate: boolean
  canExportPdf: boolean
  canExportHtml: boolean
  exportHasWatermark: boolean
  aiSummariesLimit: number
  aiSummariesUsed: number
}

export function ClaimAiPanel({
  claimId,
  projectId,
  canGenerate,
  canExportPdf,
  canExportHtml,
  exportHasWatermark,
  aiSummariesLimit,
  aiSummariesUsed,
}: ClaimAiPanelProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiAtLimit =
    !isUnlimited(aiSummariesLimit) && aiSummariesUsed >= aiSummariesLimit

  useEffect(() => {
    if (!claimId) return
    loadTimeline()
  }, [claimId, projectId])

  async function loadTimeline() {
    setLoadingTimeline(true)
    setError(null)
    const res = await fetch(
      `/api/claim-timeline?claim_id=${claimId}&project_id=${projectId}`
    )
    const payload = await res.json().catch(() => ({}))
    if (res.ok) setEvents(payload.events || [])
    setLoadingTimeline(false)
  }

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
    } else {
      setSummary(payload.summary)
    }
    setLoadingSummary(false)
  }

  async function regenerateTimeline() {
    if (!canGenerate || aiAtLimit) return
    setLoadingTimeline(true)
    setError(null)
    const res = await fetch('/api/claim-timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim_id: claimId,
        project_id: projectId,
        persist: true,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not generate timeline')
    } else {
      setEvents(payload.events || [])
    }
    setLoadingTimeline(false)
  }

  function exportReport(format: 'pdf' | 'html') {
    const url = `/api/export-report?claim_id=${claimId}&project_id=${projectId}&format=${format}`
    window.open(url, '_blank')
  }

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg">Claim intelligence</h2>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <>
              <button
                type="button"
                onClick={generateSummary}
                disabled={loadingSummary || aiAtLimit}
                className="text-sm btn-primary text-[#052e16] px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
              >
                {loadingSummary ? 'Generating…' : 'AI summary'}
              </button>
              <button
                type="button"
                onClick={regenerateTimeline}
                disabled={loadingTimeline || aiAtLimit}
                className="text-sm border border-border px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
              >
                {loadingTimeline ? 'Updating…' : 'Refresh timeline'}
              </button>
            </>
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
              {exportHasWatermark ? 'Preview export' : 'Export HTML'}
            </button>
          )}
        </div>
      </div>

      {!isUnlimited(aiSummariesLimit) && (
        <p className="text-xs text-muted">
          AI summaries this month: {aiSummariesUsed} / {aiSummariesLimit}
          {aiAtLimit && ' — limit reached. Upgrade for more.'}
        </p>
      )}

      {exportHasWatermark && canExportHtml && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2">
          Trial exports include a watermark. Upgrade to Starter for standard PDF
          exports.
        </p>
      )}

      {error && (
        <p className="text-sm alert-error rounded-lg p-2">
          {error}
        </p>
      )}

      {summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">AI summary</p>
          <p className="text-sm text-green-100 leading-relaxed">{summary}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">Timeline</p>
        {loadingTimeline && events.length === 0 && (
          <p className="text-sm text-muted-dim">Loading timeline…</p>
        )}
        {!loadingTimeline && events.length === 0 && (
          <p className="text-sm text-muted-dim">
            Upload evidence, then refresh timeline to build a claim history.
          </p>
        )}
        <ol className="space-y-3 border-l-2 border-border pl-4 ml-1">
          {events.map((e, i) => (
            <li key={`${e.event_date}-${e.title}-${i}`} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-black" />
              <p className="text-xs text-muted-dim">{e.event_date}</p>
              <p className="font-medium text-sm">{e.title}</p>
              {e.description && (
                <p className="text-sm text-muted mt-0.5">{e.description}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
