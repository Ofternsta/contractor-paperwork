'use client'

import { useCallback, useEffect, useState } from 'react'

type WorkerRow = {
  user_id: string
  full_name: string | null
  assigned: boolean
}

export function ProjectWorkerPanel({ projectId }: { projectId: string }) {
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(
      `/api/project-workers?project_id=${encodeURIComponent(projectId)}`
    )
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(
        payload.error ||
          'Could not load workers. Run supabase/project-worker-assignments.sql in Supabase.'
      )
      setWorkers([])
      setLoading(false)
      return
    }

    const list = (payload.workers || []) as WorkerRow[]
    setWorkers(list)
    setSelected(new Set(list.filter((w) => w.assigned).map((w) => w.user_id)))
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    setError(null)

    const res = await fetch('/api/project-workers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_ids: [...selected],
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Could not save assignments')
    } else {
      setMessage('Worker assignments saved.')
      await load()
    }
    setSaving(false)
  }

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <h2 className="font-bold text-lg">Assign workers</h2>
      <p className="text-sm text-muted leading-relaxed">
        Approved workers only see projects you assign here. Unassigned workers
        cannot open this job or its files.
      </p>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg p-2">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-dim">Loading workers…</p>
      ) : workers.length === 0 ? (
        <p className="text-sm text-muted-dim">
          No approved workers in your organization yet. Approve workers under Team
          &amp; workers on the projects page.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[240px] overflow-y-auto border border-border rounded-xl p-2">
          {workers.map((w) => (
            <li key={w.user_id}>
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(w.user_id)}
                  onChange={() => toggle(w.user_id)}
                  className="shrink-0"
                />
                <span className="text-sm font-medium text-foreground">
                  {w.full_name?.trim() || 'Worker'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={saving || loading || workers.length === 0}
        onClick={save}
        className="btn-primary text-[#052e16] px-4 py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save worker assignments'}
      </button>
    </section>
  )
}
