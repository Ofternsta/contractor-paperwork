'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { AppNav } from '@/components/app-nav'
import {
  SCHEDULE_EVENT_LABELS,
  type ScheduleEventType,
} from '@/lib/schedule-types'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type ScheduleEvent = {
  id: string
  project_id: string
  title: string
  event_type: ScheduleEventType
  starts_at: string
  completed_at: string | null
}

export default function CalendarPage() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  const rangeStart = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const rangeEnd = useMemo(() => {
    const d = new Date(rangeStart)
    d.setMonth(d.getMonth() + 2)
    return d
  }, [rangeStart])

  useEffect(() => {
    loadUserAccess().then(({ access: a }) => {
      if (!a || a.role === 'client' || !a.canManageSchedule) {
        router.replace('/projects')
        return
      }
      setAccess(a)
    })
  }, [router])

  useEffect(() => {
    if (!access) return
    const from = rangeStart.toISOString()
    const to = rangeEnd.toISOString()
    fetch(`/api/schedule?org=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [access, rangeStart, rangeEnd])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    setSigningOut(false)
  }

  if (!access) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  const byDay = events.reduce<Record<string, ScheduleEvent[]>>((acc, ev) => {
    const key = new Date(ev.starts_at).toDateString()
    acc[key] = acc[key] || []
    acc[key].push(ev)
    return acc
  }, {})

  const days = Object.keys(byDay).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title="Calendar"
        subtitle={access.organizationName || 'Organization schedule'}
        onSignOut={signOut}
        signingOut={signingOut}
      />
      <main className="flex-1 safe-x px-4 py-4 max-w-2xl mx-auto w-full pb-8 space-y-4">
        <AppNav access={access} />
        <p className="text-sm text-muted">
          Upcoming inspections, deadlines, reminders, and insurance follow-ups
          across all projects. Open a project to add or edit events.
        </p>
        {loading ? (
          <p className="text-muted-dim">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-muted-dim text-center py-8">
            No events in the next two months.
          </p>
        ) : (
          <ul className="space-y-4">
            {days.map((day) => (
              <li key={day}>
                <h2 className="font-bold text-foreground mb-2">{day}</h2>
                <ul className="space-y-2">
                  {byDay[day].map((ev) => (
                    <li
                      key={ev.id}
                      className={`border rounded-xl p-3 ${
                        ev.completed_at
                          ? 'border-gray-100 opacity-60'
                          : 'border-border bg-surface-elevated'
                      }`}
                    >
                      <Link
                        href={`/project/${ev.project_id}`}
                        className="font-medium text-blue-800"
                      >
                        {ev.title}
                      </Link>
                      <p className="text-xs text-muted-dim mt-1">
                        {SCHEDULE_EVENT_LABELS[ev.event_type]} ·{' '}
                        {new Date(ev.starts_at).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
