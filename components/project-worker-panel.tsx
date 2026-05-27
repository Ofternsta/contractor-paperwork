'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_WORKER_PERMISSIONS,
  WORKER_PERMISSION_LABELS,
  type WorkerPermissionKey,
  type WorkerPermissions,
} from '@/lib/worker-permissions'
import { formatWorkerListLabel } from '@/lib/sort-team-members'

type WorkerRow = {
  user_id: string
  full_name: string | null
  job_title: string | null
  assigned: boolean
  assignment_id: string | null
  permissions: WorkerPermissions
}

const PERM_KEYS = Object.keys(
  WORKER_PERMISSION_LABELS
) as WorkerPermissionKey[]

export function ProjectWorkerPanel({ projectId }: { projectId: string }) {
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set())
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [permDraft, setPermDraft] = useState<Record<string, WorkerPermissions>>(
    {}
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPermsId, setSavingPermsId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignedWorkers = useMemo(
    () => workers.filter((w) => w.assigned),
    [workers]
  )

  const availableToAdd = useMemo(
    () => workers.filter((w) => !draftIds.has(w.user_id)),
    [workers, draftIds]
  )

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
          'Could not load workers. Run supabase/project-worker-permissions.sql in Supabase.'
      )
      setWorkers([])
      setLoading(false)
      return
    }

    const list = (payload.workers || []) as WorkerRow[]
    setWorkers(list)
    const assigned = list.filter((w) => w.assigned)
    setDraftIds(new Set(assigned.map((w) => w.user_id)))
    const perms: Record<string, WorkerPermissions> = {}
    for (const w of assigned) {
      perms[w.user_id] = w.permissions
    }
    setPermDraft(perms)
    setMode(assigned.length > 0 ? 'view' : 'edit')
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  function addWorker(userId: string) {
    setDraftIds((prev) => new Set(prev).add(userId))
    setPermDraft((prev) => ({
      ...prev,
      [userId]: prev[userId] || { ...DEFAULT_WORKER_PERMISSIONS },
    }))
    setDropdownOpen(false)
  }

  function removeDraftWorker(userId: string) {
    setDraftIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }

  function startEdit() {
    setDraftIds(new Set(assignedWorkers.map((w) => w.user_id)))
    setMessage(null)
    setMode('edit')
    setExpandedUserId(null)
  }

  async function saveAssignments() {
    setSaving(true)
    setMessage(null)
    setError(null)

    const res = await fetch('/api/project-workers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_ids: [...draftIds],
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Could not save assignments')
      setSaving(false)
      return
    }

    setMessage('Workers saved.')
    setSaving(false)
    setMode('view')
    setDropdownOpen(false)
    await load()
  }

  function toggleExpand(userId: string) {
    setExpandedUserId((current) => (current === userId ? null : userId))
    setPermDraft((prev) => ({
      ...prev,
      [userId]:
        prev[userId] ||
        workers.find((w) => w.user_id === userId)?.permissions ||
        DEFAULT_WORKER_PERMISSIONS,
    }))
  }

  function setPerm(userId: string, key: WorkerPermissionKey, value: boolean) {
    setPermDraft((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || DEFAULT_WORKER_PERMISSIONS),
        [key]: value,
      },
    }))
  }

  async function savePermissions(userId: string) {
    const permissions = permDraft[userId]
    if (!permissions) return

    setSavingPermsId(userId)
    setMessage(null)
    setError(null)

    const res = await fetch('/api/project-workers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_id: userId,
        permissions,
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Could not save permissions')
    } else {
      setMessage('Project permissions saved.')
      await load()
    }
    setSavingPermsId(null)
  }

  const draftWorkers = workers.filter((w) => draftIds.has(w.user_id))

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-lg">Project workers</h2>
          <p className="text-sm text-muted leading-relaxed mt-1">
            Assign workers to this job and set what each person can do on this
            project only.
          </p>
        </div>
        {mode === 'view' && assignedWorkers.length > 0 && (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm border border-border px-3 py-2 rounded-lg font-medium min-h-[40px]"
          >
            Edit
          </button>
        )}
      </div>

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
          No approved workers yet. Add workers on the Team page first.
        </p>
      ) : mode === 'view' ? (
        <ul className="space-y-2">
          {assignedWorkers.length === 0 ? (
            <li className="text-sm text-muted-dim">
              No workers assigned. Click Edit to add workers.
            </li>
          ) : (
            assignedWorkers.map((w) => {
              const expanded = expandedUserId === w.user_id
              const perms = permDraft[w.user_id] || w.permissions
              return (
                <li
                  key={w.user_id}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(w.user_id)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-surface min-h-[48px]"
                  >
                    <span className="font-medium text-sm text-foreground">
                      {formatWorkerListLabel(w.full_name, w.job_title)}
                    </span>
                    <span className="text-muted-dim text-xs shrink-0">
                      {expanded ? '▲' : '▼'}
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-border p-3 space-y-3 bg-surface">
                      <fieldset className="space-y-2">
                        <legend className="text-xs font-semibold text-muted uppercase tracking-wide">
                          Permissions on this project
                        </legend>
                        {PERM_KEYS.map((key) => (
                          <label
                            key={key}
                            className="flex items-start gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={perms[key]}
                              onChange={(e) =>
                                setPerm(w.user_id, key, e.target.checked)
                              }
                            />
                            <span>
                              <span className="font-medium text-foreground">
                                {WORKER_PERMISSION_LABELS[key].label}
                              </span>
                              <span className="block text-xs text-muted-dim">
                                {WORKER_PERMISSION_LABELS[key].description}
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <button
                        type="button"
                        disabled={savingPermsId === w.user_id}
                        onClick={() => savePermissions(w.user_id)}
                        className="text-sm btn-primary text-[#052e16] px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
                      >
                        {savingPermsId === w.user_id
                          ? 'Saving…'
                          : 'Save permissions'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })
          )}
        </ul>
      ) : (
        <>
          {draftWorkers.length > 0 && (
            <ul className="space-y-2">
              {draftWorkers.map((w) => (
                <li
                  key={w.user_id}
                  className="flex items-center justify-between gap-2 border border-border rounded-lg p-3"
                >
                  <span className="text-sm font-medium">
                    {formatWorkerListLabel(w.full_name, w.job_title)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDraftWorker(w.user_id)}
                    className="text-xs text-red-700 font-medium min-h-[36px] px-2"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              disabled={availableToAdd.length === 0}
              className="w-full border border-border rounded-xl p-3 text-sm text-left flex justify-between items-center min-h-[48px] disabled:opacity-50"
            >
              <span>
                {availableToAdd.length === 0
                  ? 'All workers added'
                  : 'Add a worker…'}
              </span>
              <span className="text-muted-dim">▼</span>
            </button>
            {dropdownOpen && availableToAdd.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-border rounded-xl bg-surface-elevated shadow-lg">
                {availableToAdd.map((w) => (
                  <li key={w.user_id}>
                    <button
                      type="button"
                      onClick={() => addWorker(w.user_id)}
                      className="w-full text-left px-3 py-3 text-sm hover:bg-surface min-h-[44px]"
                    >
                      {formatWorkerListLabel(w.full_name, w.job_title)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveAssignments}
              className="btn-primary text-[#052e16] px-4 py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {assignedWorkers.length > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setMode('view')
                  setDraftIds(new Set(assignedWorkers.map((w) => w.user_id)))
                  setDropdownOpen(false)
                }}
                className="border border-border px-4 py-3 rounded-xl text-sm font-medium min-h-[48px]"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
