'use client'

import { useEffect, useState } from 'react'

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
}

export function ClaimAiPanel({
  claimId,
  projectId,
  canGenerate,
}: ClaimAiPanelProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!canGenerate) return
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
    if (!canGenerate) return
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

  async function exportPdf() {
    const url = `/api/export-report?claim_id=${claimId}&project_id=${projectId}&format=pdf`
    window.open(url, '_blank')
  }

  return (
    <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg">Claim intelligence</h2>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <>
              <button
                type="button"
                onClick={generateSummary}
                disabled={loadingSummary}
                className="text-sm bg-black text-white px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
              >
                {loadingSummary ? 'Generating…' : 'AI summary'}
              </button>
              <button
                type="button"
                onClick={regenerateTimeline}
                disabled={loadingTimeline}
                className="text-sm border border-gray-300 px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
              >
                {loadingTimeline ? 'Updating…' : 'Refresh timeline'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={exportPdf}
            className="text-sm border border-gray-300 px-3 py-2 rounded-lg min-h-[40px]"
          >
            Export PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
          {error}
        </p>
      )}

      {summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">AI summary</p>
          <p className="text-sm text-blue-950 leading-relaxed">{summary}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">Timeline</p>
        {loadingTimeline && events.length === 0 && (
          <p className="text-sm text-gray-500">Loading timeline…</p>
        )}
        {!loadingTimeline && events.length === 0 && (
          <p className="text-sm text-gray-500">
            Upload evidence, then refresh timeline to build a claim history.
          </p>
        )}
        <ol className="space-y-3 border-l-2 border-gray-200 pl-4 ml-1">
          {events.map((e, i) => (
            <li key={`${e.event_date}-${e.title}-${i}`} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-black" />
              <p className="text-xs text-gray-500">{e.event_date}</p>
              <p className="font-medium text-sm">{e.title}</p>
              {e.description && (
                <p className="text-sm text-gray-600 mt-0.5">{e.description}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
