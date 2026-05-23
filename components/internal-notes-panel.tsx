'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Note = {
  id: string
  author_id: string
  author_name: string
  author_role: string
  body: string
  note_kind: string
  claim_id: string | null
  created_at: string
  mentioned_users: Array<{ id: string; name: string }>
}

type RosterMember = { id: string; label: string; role: string }

type Props = {
  projectId: string
  claimId?: string | null
  currentUserId: string | null
  canPost: boolean
}

function kindLabel(kind: string) {
  if (kind === 'status_update') return 'Status update'
  if (kind === 'mention') return 'Mention'
  return 'Note'
}

function renderBodyHtml(body: string) {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi,
    '<span class="font-semibold text-blue-800">@$1</span>'
  )
}

export function InternalNotesPanel({
  projectId,
  claimId,
  currentUserId,
  canPost,
}: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [noteKind, setNoteKind] = useState<'note' | 'status_update'>('note')
  const [mentionOpen, setMentionOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ project_id: projectId })
    if (claimId) params.set('claim_id', claimId)
    const res = await fetch(`/api/internal-notes?${params}`)
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not load notes')
      setNotes([])
    } else {
      setError(null)
      setNotes(payload.notes || [])
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

  function insertMention(member: RosterMember) {
    const token = `@[${member.label}](${member.id}) `
    const el = textareaRef.current
    if (el) {
      const start = el.selectionStart ?? draft.length
      const end = el.selectionEnd ?? draft.length
      const next = draft.slice(0, start) + token + draft.slice(end)
      setDraft(next)
      setMentionOpen(false)
      setTimeout(() => el.focus(), 0)
    } else {
      setDraft((d) => d + token)
      setMentionOpen(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canPost || !draft.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/internal-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        claim_id: claimId || null,
        body: draft.trim(),
        note_kind: noteKind,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not post note')
      setSaving(false)
      return
    }
    setDraft('')
    setNoteKind('note')
    await load()
    setSaving(false)
  }

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
      <div>
        <h2 className="font-bold text-lg">Internal notes &amp; team log</h2>
        <p className="text-sm text-muted mt-1">
          Worker notes, @mentions, status updates, and communication history.
          Clients cannot see this.
        </p>
      </div>

      {error && (
        <p className="text-sm alert-error rounded-lg p-2">
          {error}
        </p>
      )}

      {canPost && (
        <form onSubmit={submit} className="space-y-2 border border-gray-100 rounded-xl p-3 bg-surface">
          <div className="flex flex-wrap gap-2">
            <select
              value={noteKind}
              onChange={(e) =>
                setNoteKind(e.target.value as 'note' | 'status_update')
              }
              className="border border-border rounded-lg p-2 text-sm bg-surface-elevated"
            >
              <option value="note">Worker note</option>
              <option value="status_update">Status update</option>
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMentionOpen((v) => !v)}
                className="border border-border rounded-lg px-3 py-2 text-sm font-medium min-h-[40px] bg-surface-elevated"
              >
                @ Mention
              </button>
              {mentionOpen && (
                <ul className="absolute z-10 mt-1 w-48 bg-surface-elevated border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {roster
                    .filter((m) => m.id !== currentUserId)
                    .map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                          onClick={() => insertMention(m)}
                        >
                          {m.label}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an internal note… Use @ Mention to notify a teammate."
            rows={3}
            className="w-full border border-border rounded-xl p-3 text-sm resize-none bg-surface-elevated"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="w-full btn-primary text-[#052e16] py-3 rounded-xl font-medium text-sm disabled:opacity-50 min-h-[48px]"
          >
            {saving ? 'Posting…' : 'Post to team log'}
          </button>
        </form>
      )}

      <div
        className="border border-gray-100 rounded-xl bg-surface max-h-[360px] overflow-y-auto divide-y divide-gray-100"
        aria-live="polite"
      >
        {loading && (
          <p className="text-sm text-muted-dim text-center py-6">Loading history…</p>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-sm text-muted-dim text-center py-6">
            No internal notes yet.
          </p>
        )}
        {notes.map((n) => {
          const mine = n.author_id === currentUserId
          return (
            <article key={n.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`font-semibold ${mine ? 'text-black' : 'text-foreground'}`}>
                  {n.author_name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-muted">
                  {kindLabel(n.note_kind)}
                </span>
                <span className="text-xs text-muted-dim ml-auto">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
              <p
                className="leading-relaxed whitespace-pre-wrap text-gray-800"
                dangerouslySetInnerHTML={{ __html: renderBodyHtml(n.body) }}
              />
              {n.mentioned_users.length > 0 && (
                <p className="text-xs text-brand-bright mt-2">
                  Notified: {n.mentioned_users.map((u) => u.name).join(', ')}
                </p>
              )}
            </article>
          )
        })}
      </div>

      <button
        type="button"
        onClick={load}
        className="text-xs text-brand-bright font-medium min-h-[40px]"
      >
        Refresh log
      </button>
    </section>
  )
}
