'use client'

import { useState } from 'react'
import { EVIDENCE_TYPES } from '@/lib/evidence-types'

type EvidenceCardProps = {
  doc: {
    id: string
    file_name: string
    file_path: string
    evidence_type: string
    summary: string
    created_at?: string
    uploaded_by_label?: string
  }
  canEdit: boolean
  canDelete: boolean
  onOpen: (filePath: string) => void
  onDelete: (filePath: string) => void
  onUpdated: () => void
}

export function EvidenceCard({
  doc,
  canEdit,
  canDelete,
  onOpen,
  onDelete,
  onUpdated,
}: EvidenceCardProps) {
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(doc.summary)
  const [evidenceType, setEvidenceType] = useState(doc.evidence_type)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/evidence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: doc.file_path,
        summary,
        evidence_type: evidenceType,
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Could not save')
      setSaving(false)
      return
    }

    setEditing(false)
    onUpdated()
    setSaving(false)
  }

  return (
    <article className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <span className="inline-block text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-1 rounded-full mb-2">
        {doc.evidence_type}
      </span>
      <button
        type="button"
        className="block font-medium text-blue-700 text-left w-full py-1 min-h-[44px]"
        onClick={() => onOpen(doc.file_path)}
      >
        {doc.file_name}
      </button>

      {doc.created_at && (
        <p className="text-xs text-gray-500 mt-1">
          Uploaded {new Date(doc.created_at).toLocaleString()}
          {doc.uploaded_by_label ? ` · ${doc.uploaded_by_label}` : ''}
        </p>
      )}

      {editing ? (
        <div className="mt-2 space-y-2">
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            className="border border-gray-300 rounded-xl p-2 w-full text-sm"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="border border-gray-300 rounded-xl p-3 w-full min-h-[100px] text-sm"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setSummary(doc.summary)
                setEvidenceType(doc.evidence_type)
              }}
              className="flex-1 border py-2 rounded-lg text-sm min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{doc.summary}</p>
      )}

      <div className="flex flex-wrap gap-3 mt-3">
        {canEdit && !editing && (
          <button
            type="button"
            className="text-sm font-medium text-gray-800 min-h-[44px]"
            onClick={() => setEditing(true)}
          >
            Edit summary
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="text-red-600 font-medium text-sm min-h-[44px]"
            onClick={() => onDelete(doc.file_path)}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  )
}
