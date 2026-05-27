'use client'

import { useEffect, useState } from 'react'

type AccessRow = {
  id: string
  client_email: string
  status: string
  approved_at: string | null
}

export function ProjectClientPanel({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/project-access?project_id=${projectId}`)
    const payload = await res.json().catch(() => ({}))
    if (res.ok) setRows(payload.access || [])
    setLoading(false)
  }

  async function grantAccess(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    setMessage(null)

    const res = await fetch('/api/project-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        client_email: email.trim(),
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setMessage(payload.error || 'Could not grant access')
    } else {
      setMessage(`Access granted to ${email.trim().toLowerCase()}`)
      setEmail('')
      await load()
    }
    setSaving(false)
  }

  async function revoke(accessId: string) {
    setMessage(null)
    const res = await fetch(`/api/project-access?access_id=${accessId}`, {
      method: 'DELETE',
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setMessage(payload.error || 'Could not revoke access')
      return
    }

    setMessage('Client access revoked.')
    await load()
  }

  useEffect(() => {
    load()
  }, [projectId])

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <h2 className="font-bold text-lg">Client access</h2>
      <p className="text-sm text-muted leading-relaxed">
        Clients must sign up as <strong>Client</strong> and use this email. You
        grant <strong>one-time view access</strong> to this project only (documents
        and invoices — not internal team messages).
      </p>

      <form onSubmit={grantAccess} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@email.com"
          className="border border-border rounded-xl p-3 flex-1"
        />
        <button
          type="submit"
          disabled={saving}
          className="btn-primary text-[#052e16] px-4 py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-50 shrink-0"
        >
          {saving ? '…' : 'Grant access'}
        </button>
      </form>

      {message && (
        <p className="text-sm text-green-800">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-dim">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-dim">No clients have access yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg p-3 text-sm"
            >
              <span>
                {r.client_email}
                <span className="text-green-700 ml-2 text-xs font-medium">
                  {r.status}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revoke(r.id)}
                className="text-red-600 font-medium min-h-[44px] px-2"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
