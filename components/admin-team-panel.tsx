'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_WORKER_PERMISSIONS,
  WORKER_PERMISSION_LABELS,
  type WorkerPermissionKey,
  type WorkerPermissions,
  parseWorkerPermissions,
} from '@/lib/worker-permissions'
import { WORKER_JOB_TITLE_SUGGESTIONS } from '@/lib/worker-job-titles'

type MemberRow = {
  id: string
  user_id: string
  created_at: string
  full_name: string | null
  job_title?: string | null
  can_upload?: boolean
  can_delete?: boolean
  can_add_events?: boolean
  can_view_files?: boolean
}

type OrgInfo = {
  id: string
  name: string
  invite_code: string
}

type AdminInfo = {
  user_id: string
  full_name: string | null
}

const PERM_KEYS = Object.keys(
  WORKER_PERMISSION_LABELS
) as WorkerPermissionKey[]

export function AdminTeamPanel() {
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [pending, setPending] = useState<MemberRow[]>([])
  const [approved, setApproved] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [inviteVisible, setInviteVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [permDraft, setPermDraft] = useState<Record<string, WorkerPermissions>>(
    {}
  )
  const [titleDraft, setTitleDraft] = useState<Record<string, string>>({})
  const [permMessage, setPermMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    const res = await fetch('/api/team')
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      setOrg(payload.organization || null)
      setAdmin(payload.admin || null)
      setPending(payload.pending || [])
      const approvedList = (payload.approved || []) as MemberRow[]
      setApproved(approvedList)
      const drafts: Record<string, WorkerPermissions> = {}
      const titles: Record<string, string> = {}
      for (const m of approvedList) {
        drafts[m.id] = parseWorkerPermissions(m)
        titles[m.id] = m.job_title?.trim() || ''
      }
      setPermDraft(drafts)
      setTitleDraft(titles)
    } else {
      setLoadError(
        payload.error ||
          'Could not load team. Run supabase/member-job-titles.sql in Supabase if job titles were just added.'
      )
    }
    setLoading(false)
  }

  async function act(memberId: string, action: 'approve' | 'reject' | 'promote_admin') {
    if (action === 'promote_admin') {
      const ok = window.confirm(
        'Make this worker the organization admin? You will become a worker on the team.'
      )
      if (!ok) return
    }

    setActingId(memberId)
    await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, action }),
    })
    await load()
    setActingId(null)
    if (action === 'promote_admin') {
      window.location.reload()
    }
  }

  async function saveMember(memberId: string) {
    const permissions = permDraft[memberId]
    if (!permissions) return

    setActingId(memberId)
    setPermMessage(null)
    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        permissions,
        job_title: titleDraft[memberId] ?? '',
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPermMessage(payload.error || 'Could not save team member')
    } else {
      setPermMessage('Team member saved.')
    }
    setActingId(null)
    await load()
  }

  function setPerm(memberId: string, key: WorkerPermissionKey, value: boolean) {
    setPermDraft((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || DEFAULT_WORKER_PERMISSIONS),
        [key]: value,
      },
    }))
  }

  async function regenerateCode() {
    const ok = window.confirm(
      'Generate a new worker code? The old code will stop working for new signups.'
    )
    if (!ok) return
    setRegenerating(true)
    const res = await fetch('/api/team/regenerate-invite', { method: 'POST' })
    const payload = await res.json().catch(() => ({}))
    if (res.ok && payload.invite_code) {
      setOrg((prev) =>
        prev ? { ...prev, invite_code: payload.invite_code } : prev
      )
      setInviteVisible(true)
    }
    setRegenerating(false)
  }

  async function copyInviteCode() {
    if (!org?.invite_code) return
    try {
      await navigator.clipboard.writeText(org.invite_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-dim">Loading team…</p>
  }

  if (!org) {
    return loadError ? (
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
        {loadError}
      </p>
    ) : null
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
          {loadError}
        </p>
      )}
      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
        <h2 className="font-bold text-lg">Worker invite code</h2>
        <p className="text-sm text-muted leading-relaxed">
          Share this code with workers when they sign up. Each worker still needs
          your one-time approval before they can use the app.
        </p>
        <div className="bg-background border border-border rounded-xl p-4 text-center space-y-3">
          <p className="text-xs text-muted-dim uppercase tracking-wide">
            Worker invite code (8 characters)
          </p>
          <p
            className="text-2xl font-bold tracking-[0.2em] font-mono text-brand-bright min-h-[2rem]"
            aria-live="polite"
          >
            {inviteVisible ? org.invite_code : '••••••••'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setInviteVisible((v) => !v)}
              className="text-sm border border-border px-4 py-2 rounded-lg font-medium text-foreground min-h-[40px]"
            >
              {inviteVisible ? 'Hide code' : 'Show code'}
            </button>
            {inviteVisible && (
              <button
                type="button"
                onClick={copyInviteCode}
                className="text-sm btn-primary text-[#052e16] px-4 py-2 rounded-lg font-medium min-h-[40px]"
              >
                {copied ? 'Copied' : 'Copy code'}
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={regenerating}
            onClick={regenerateCode}
            className="text-sm text-brand-bright font-medium min-h-[40px] disabled:opacity-50"
          >
            {regenerating ? 'Generating…' : 'Generate new code'}
          </button>
        </div>
      </section>

      {permMessage && (
        <p className="text-sm text-muted border border-border rounded-lg p-2">
          {permMessage}
        </p>
      )}

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
        <h2 className="font-bold text-lg">Organization admin</h2>
        <div className="border border-border rounded-xl p-3 flex flex-col gap-1">
          <p className="font-medium text-sm text-foreground">
            {admin?.full_name?.trim() || 'You'}
          </p>
          <p className="text-xs text-muted-dim uppercase tracking-wide">
            Role: Administrator
          </p>
        </div>
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
        <h2 className="font-bold text-lg">Pending requests</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-dim">No pending worker requests.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((m) => (
              <li
                key={m.id}
                className="border border-warning/40 bg-warning-surface rounded-xl p-3 flex flex-col gap-2"
              >
                <p className="font-medium text-sm text-foreground">
                  {m.full_name || 'Worker'} — requested access
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actingId === m.id}
                    onClick={() => act(m.id, 'approve')}
                    className="flex-1 btn-primary text-[#052e16] py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingId === m.id}
                    onClick={() => act(m.id, 'reject')}
                    className="flex-1 border border-border py-2 rounded-lg text-sm font-medium text-foreground min-h-[44px] disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
        <h2 className="font-bold text-lg">Workers</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-muted-dim">
            No approved workers yet. Share your invite code and approve requests
            above.
          </p>
        ) : (
          <ul className="space-y-3">
            {approved.map((m) => {
              const perms = permDraft[m.id] || DEFAULT_WORKER_PERMISSIONS
              return (
                <li
                  key={m.id}
                  className="border border-border rounded-xl p-3 flex flex-col gap-3"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {m.full_name || 'Worker'}
                    </p>
                    <p className="text-xs text-muted-dim mt-0.5">
                      Account role: Worker
                    </p>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                      Job title
                    </span>
                    <input
                      type="text"
                      list={`job-titles-${m.id}`}
                      className="border border-border rounded-xl p-3 w-full text-sm"
                      placeholder="e.g. Field Technician"
                      value={titleDraft[m.id] ?? ''}
                      onChange={(e) =>
                        setTitleDraft((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                    />
                    <datalist id={`job-titles-${m.id}`}>
                      {WORKER_JOB_TITLE_SUGGESTIONS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-dim">
                      Shown on the team roster. Pick a suggestion or type your own.
                    </p>
                  </label>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-muted uppercase tracking-wide">
                      Permissions
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
                            setPerm(m.id, key, e.target.checked)
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actingId === m.id}
                      onClick={() => saveMember(m.id)}
                      className="text-sm btn-primary text-[#052e16] px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
                    >
                      {actingId === m.id ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === m.id}
                      onClick={() => act(m.id, 'promote_admin')}
                      className="text-sm border border-border px-3 py-2 rounded-lg font-medium text-foreground min-h-[40px] disabled:opacity-50"
                    >
                      Make organization admin
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
