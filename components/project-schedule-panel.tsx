'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  SCHEDULE_EVENT_LABELS,
  SCHEDULE_EVENT_TYPES,
  type ScheduleEventType,
} from '@/lib/schedule-types'

type ScheduleEvent = {
  id: string
  project_id: string
  claim_id: string | null
  event_type: ScheduleEventType
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  assigned_user_id: string | null
  reminder_at: string | null
  completed_at: string | null
}

type RosterMember = { id: string; label: string; role: string }

type Props = {
  projectId: string
  claimId?: string | null
  canEdit: boolean
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ProjectSchedulePanel({ projectId, claimId, canEdit }: Props) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [eventType, setEventType] = useState<ScheduleEventType>('inspection')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [reminderAt, setReminderAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ project_id: projectId })
    if (claimId) params.set('claim_id', claimId)
    const res = await fetch(`/api/schedule?${params}`)
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not load schedule')
      setEvents([])
    } else {
      setError(null)
      setEvents(payload.events || [])
    }
    setLoading(false)
  }, [projectId, claimId])

  useEffect(() => {
    load()
    fetch('/api/team/roster')
      .then((r) => r.json())
      .then((d) => setRoster(d.roster || []))
      .catch(() => setRoster([]))
  }, [load])

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit || !title.trim() || !startsAt) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        claim_id: claimId || null,
        event_type: eventType,
        title: title.trim(),
        description: description.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        assigned_user_id: assignedUserId || null,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not save event')
      setSaving(false)
      return
    }
    setTitle('')
    setDescription('')
    setStartsAt('')
    setEndsAt('')
    setAssignedUserId('')
    setReminderAt('')
    setShowForm(false)
    await load()
    setSaving(false)
  }

  async function toggleComplete(ev: ScheduleEvent) {
    if (!canEdit) return
    const res = await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ev.id,
        project_id: projectId,
        completed_at: ev.completed_at ? null : new Date().toISOString(),
      }),
    })
    if (res.ok) await load()
  }

  const upcoming = events.filter((e) => !e.completed_at)
  const done = events.filter((e) => e.completed_at)

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-lg">Schedule &amp; calendar</h2>
          <p className="text-sm text-muted mt-1">
            Inspections, deadlines, reminders, insurance follow-ups, and worker
            assignments.
          </p>
        </div>
        <Link
          href="/calendar"
          className="text-sm font-medium text-brand-bright min-h-[44px] inline-flex items-center"
        >
          Org calendar →
        </Link>
      </div>

      {error && (
        <p className="text-sm alert-error rounded-lg p-2">
          {error}
        </p>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm font-medium border border-border rounded-xl px-4 py-2 min-h-[44px]"
        >
          {showForm ? 'Cancel' : 'Add event'}
        </button>
      )}

      {showForm && canEdit && (
        <form onSubmit={addEvent} className="space-y-3 border border-gray-100 rounded-xl p-3 bg-surface">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as ScheduleEventType)}
            className="w-full border border-border rounded-xl p-3 bg-surface-elevated"
          >
            {SCHEDULE_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHEDULE_EVENT_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full border border-border rounded-xl p-3 bg-surface-elevated"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="w-full border border-border rounded-xl p-3 bg-surface-elevated resize-none"
          />
          <label className="block text-sm font-medium text-muted">
            Start
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full border border-border rounded-xl p-3 bg-surface-elevated"
            />
          </label>
          <label className="block text-sm font-medium text-muted">
            End (optional)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full border border-border rounded-xl p-3 bg-surface-elevated"
            />
          </label>
          <label className="block text-sm font-medium text-muted">
            Reminder (optional)
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className="mt-1 w-full border border-border rounded-xl p-3 bg-surface-elevated"
            />
          </label>
          <select
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            className="w-full border border-border rounded-xl p-3 bg-surface-elevated"
          >
            <option value="">Unassigned</option>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.role})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary text-[#052e16] py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save event'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-dim">Loading schedule…</p>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold text-muted mb-2">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-dim">No upcoming events.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((ev) => (
                  <li
                    key={ev.id}
                    className="border border-gray-100 rounded-lg p-3 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{ev.title}</span>
                      <span className="text-xs text-muted-dim shrink-0">
                        {SCHEDULE_EVENT_LABELS[ev.event_type]}
                      </span>
                    </div>
                    <p className="text-muted mt-1">{formatWhen(ev.starts_at)}</p>
                    {ev.reminder_at && (
                      <p className="text-xs text-amber-800 mt-1">
                        Reminder: {formatWhen(ev.reminder_at)}
                      </p>
                    )}
                    {ev.assigned_user_id && (
                      <p className="text-xs text-muted-dim mt-1">
                        Assigned:{' '}
                        {roster.find((r) => r.id === ev.assigned_user_id)?.label ||
                          'Team member'}
                      </p>
                    )}
                    {ev.description && (
                      <p className="text-muted mt-1">{ev.description}</p>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => toggleComplete(ev)}
                        className="mt-2 text-xs font-medium text-green-700"
                      >
                        Mark complete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {done.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted mb-2">Completed</h3>
              <ul className="space-y-2 opacity-75">
                {done.map((ev) => (
                  <li
                    key={ev.id}
                    className="border border-gray-100 rounded-lg p-3 text-sm line-through"
                  >
                    {ev.title} · {formatWhen(ev.starts_at)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
