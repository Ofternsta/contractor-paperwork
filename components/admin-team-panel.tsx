'use client'

import { useEffect, useState } from 'react'

type PendingMember = {
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
  const [pending, setPending] = useState<PendingMember[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/team')
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      setOrg(payload.organization || null)
      setPending(payload.pending || [])
    }
    setLoading(false)
  }

  async function act(memberId: string, action: 'approve' | 'reject') {
    setActingId(memberId)
    await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, action }),
    })
    await load()
    setActingId(null)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Loading team…</p>
    )
  }

  if (!org) return null

  return (
    <section className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <h2 className="font-bold text-lg">Team & workers</h2>
      <p className="text-sm text-gray-600 leading-relaxed">
        Share this code with workers. Each worker needs your{' '}
        <strong>one-time approval</strong> before they can see projects.
      </p>
      <div className="bg-gray-100 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Worker invite code
        </p>
        <p className="text-2xl font-bold tracking-[0.2em]">{org.invite_code}</p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-gray-500">No pending worker requests.</p>
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
                  className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actingId === m.id}
                  onClick={() => act(m.id, 'reject')}
                  className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
