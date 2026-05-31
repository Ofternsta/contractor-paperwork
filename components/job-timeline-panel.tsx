'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LegalNotice } from '@/components/legal-notice'
import { isUnlimited } from '@/lib/plan-entitlements'

type TimelineEvent = {
  id?: string
  claim_id?: string
  event_date: string
  title: string
  description: string
  source?: string
  created_at?: string
  client_name?: string
}

type JobTimelinePanelProps = {
  claimId: string
  projectId: string
  timelineRefreshKey?: number
  canGenerate: boolean
  aiSummariesLimit: number
  aiSummariesUsed: number
}

function eventSortTime(e: TimelineEvent): number {
  const raw = e.created_at || e.event_date
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

function formatTimelineSource(source?: string): string | undefined {
  if (!source) return undefined
  if (source === 'evidence') return 'Document'
  if (source === 'ai') return 'AI'
  if (source === 'manual') return 'Team'
  return source
}

function formatEventWhen(e: TimelineEvent): string {
  if (e.created_at) {
    return new Date(e.created_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
  return e.event_date
}

function TimelineList({
  events,
  newestFirst,
  showClaimName,
}: {
  events: TimelineEvent[]
  newestFirst: boolean
  showClaimName?: boolean
}) {
  const ordered = [...events].sort((a, b) => {
    const diff = eventSortTime(b) - eventSortTime(a)
    return newestFirst ? diff : -diff
  })

  if (!ordered.length) {
    return <p className="text-sm text-muted-dim">No entries yet.</p>
  }

  return (
    <ol className="space-y-3 border-l-2 border-border pl-4 ml-1">
      {ordered.map((e, i) => (
        <li
          key={e.id || `${e.event_date}-${e.title}-${i}`}
          className="relative"
        >
          <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-brand" />
          <p className="text-xs text-muted-dim">{formatEventWhen(e)}</p>
          <p className="font-medium text-sm text-foreground">
            {e.title}
            {showClaimName && e.client_name ? (
              <span className="text-muted font-normal"> · {e.client_name}</span>
            ) : null}
          </p>
          {e.description ? (
            <p className="text-sm text-muted mt-0.5">{e.description}</p>
          ) : null}
          {formatTimelineSource(e.source) ? (
            <p className="text-[10px] uppercase tracking-wide text-muted-dim mt-1">
              {formatTimelineSource(e.source)}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function JobTimelinePanel({
  claimId,
  projectId,
  timelineRefreshKey = 0,
  canGenerate,
  aiSummariesLimit,
  aiSummariesUsed,
}: JobTimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [projectStatusEvents, setProjectStatusEvents] = useState<TimelineEvent[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [loadingStatusHistory, setLoadingStatusHistory] = useState(false)
  const [showFullTimeline, setShowFullTimeline] = useState(false)
  const [showStatusHistory, setShowStatusHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiAtLimit =
    !isUnlimited(aiSummariesLimit) && aiSummariesUsed >= aiSummariesLimit

  const loadTimeline = useCallback(async () => {
    if (!claimId) return
    setLoadingTimeline(true)
    setError(null)
    const res = await fetch(
      `/api/claim-timeline?claim_id=${claimId}&project_id=${projectId}`
    )
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      setEvents(payload.events || [])
    } else {
      setError(payload.error || 'Could not load timeline')
    }
    setLoadingTimeline(false)
  }, [claimId, projectId])

  useEffect(() => {
    loadTimeline()
    setShowFullTimeline(false)
    setShowStatusHistory(false)
    setProjectStatusEvents([])
  }, [loadTimeline, timelineRefreshKey])

  const latestEvent = useMemo(() => {
    if (!events.length) return null
    return [...events].sort((a, b) => eventSortTime(b) - eventSortTime(a))[0]
  }, [events])

  const claimStatusUpdates = useMemo(
    () => events.filter((e) => e.title === 'Status updated'),
    [events]
  )

  async function loadProjectStatusHistory() {
    setLoadingStatusHistory(true)
    setError(null)
    const res = await fetch(
      `/api/claim-timeline?project_id=${projectId}&kind=status_updates`
    )
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not load status history')
      setLoadingStatusHistory(false)
      return
    }
    setProjectStatusEvents(payload.events || [])
    setLoadingStatusHistory(false)
  }

  async function toggleStatusHistory() {
    const next = !showStatusHistory
    setShowStatusHistory(next)
    if (next && projectStatusEvents.length === 0) {
      await loadProjectStatusHistory()
    }
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
      await loadTimeline()
    }
    setLoadingTimeline(false)
  }

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg text-foreground">Job timeline</h2>
        {canGenerate && (
          <button
            type="button"
            onClick={regenerateTimeline}
            disabled={loadingTimeline || aiAtLimit}
            className="text-sm border border-border px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
          >
            {loadingTimeline ? 'Updating…' : 'Refresh timeline'}
          </button>
        )}
      </div>

      {!isUnlimited(aiSummariesLimit) && (
        <p className="text-xs text-muted">
          AI summaries this month: {aiSummariesUsed} / {aiSummariesLimit}
          {aiAtLimit && ' — limit reached. Upgrade for more.'}
        </p>
      )}

      {error && (
        <p className="text-sm alert-error rounded-lg p-2">{error}</p>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Latest update</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFullTimeline((v) => !v)}
              className="text-xs border border-border px-2.5 py-1.5 rounded-lg hover:border-brand-dim/50"
            >
              {showFullTimeline ? 'Hide full timeline' : 'View full timeline'}
            </button>
            <button
              type="button"
              onClick={toggleStatusHistory}
              className="text-xs border border-border px-2.5 py-1.5 rounded-lg hover:border-brand-dim/50"
            >
              {showStatusHistory
                ? 'Hide status history'
                : 'All status updates (project)'}
            </button>
          </div>
        </div>

        {loadingTimeline && !latestEvent && (
          <p className="text-sm text-muted-dim">Loading…</p>
        )}

        {!loadingTimeline && !latestEvent && (
          <p className="text-sm text-muted-dim">
            Upload documents or change job status to build history. Use Refresh
            timeline to add AI-derived milestones from files.
          </p>
        )}

        {latestEvent && !showFullTimeline && (
          <div className="border border-border rounded-lg p-3 bg-surface">
            <p className="text-xs text-muted-dim">{formatEventWhen(latestEvent)}</p>
            <p className="font-medium text-sm text-foreground mt-0.5">
              {latestEvent.title}
            </p>
            {latestEvent.description && (
              <p className="text-sm text-muted mt-1">{latestEvent.description}</p>
            )}
            {formatTimelineSource(latestEvent.source) && (
              <p className="text-[10px] uppercase tracking-wide text-muted-dim mt-2">
                {formatTimelineSource(latestEvent.source)}
              </p>
            )}
          </div>
        )}

        {showFullTimeline && (
          <div className="pt-1">
            <p className="text-xs text-muted mb-2">
              Full timeline for this job ({events.length}{' '}
              {events.length === 1 ? 'entry' : 'entries'})
            </p>
            <TimelineList events={events} newestFirst />
          </div>
        )}

        {showStatusHistory && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted mb-2 mt-3">
              Every status change on this project
              {claimStatusUpdates.length > 0 &&
                ` · ${claimStatusUpdates.length} on this job`}
            </p>
            {loadingStatusHistory && (
              <p className="text-sm text-muted-dim">Loading status history…</p>
            )}
            {!loadingStatusHistory && (
              <TimelineList
                events={projectStatusEvents}
                newestFirst
                showClaimName
              />
            )}
          </div>
        )}
      </div>

      <LegalNotice id="ai" />
    </section>
  )
}
