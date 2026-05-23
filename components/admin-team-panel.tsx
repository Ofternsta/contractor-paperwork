'use client'

import { useEffect, useState } from 'react'

type MemberRow = {
  id: string
  user_id: string
  created_at: string
  full_name: string | null
}

type OrgInfo = {
  id: string
  name: string
  invite_code: string
}

export function AdminTeamPanel() {
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [pending, setPending] = useState<MemberRow[]>([])
  const [approved, setApproved] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/team')
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      setOrg(payload.organization || null)
      setPending(payload.pending || [])
      setApproved(payload.approved || [])
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
    }
    setRegenerating(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <p className="text-sm text-muted-dim">Loading team…</p>
    )
  }

  if (!org) return null

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <h2 className="font-bold text-lg">Team & workers</h2>
      <p className="text-sm text-muted leading-relaxed">
        This <strong>auto-generated</strong> code is required for worker signup.
        Each worker needs your <strong>one-time approval</strong> after they join.
      </p>
      <div className="bg-gray-100 rounded-xl p-4 text-center space-y-2">
        <p className="text-xs text-muted-dim uppercase tracking-wide mb-1">
          Worker invite code (8 characters)
        </p>
        <p className="text-2xl font-bold tracking-[0.2em] font-mono">
          {org.invite_code}
        </p>
        <button
          type="button"
          disabled={regenerating}
          onClick={regenerateCode}
          className="text-sm text-brand-bright font-medium min-h-[40px] disabled:opacity-50"
        >
          {regenerating ? 'Generating…' : 'Generate new code'}
        </button>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-dim">No pending worker requests.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((m) => (
            <li
              key={m.id}
              className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex flex-col gap-2"
            >
              <p className="font-medium text-sm">
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
                  className="flex-1 border border-border py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {approved.length > 0 && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <p className="text-sm font-medium text-gray-800">Approved workers</p>
          <ul className="space-y-2">
            {approved.map((m) => (
              <li
                key={m.id}
                className="border border-border rounded-xl p-3 flex flex-col gap-2"
              >
                <p className="font-medium text-sm">{m.full_name || 'Worker'}</p>
                <button
                  type="button"
                  disabled={actingId === m.id}
                  onClick={() => act(m.id, 'promote_admin')}
                  className="text-sm border border-border py-2 rounded-lg font-medium min-h-[44px] disabled:opacity-50"
                >
                  Make organization admin
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
