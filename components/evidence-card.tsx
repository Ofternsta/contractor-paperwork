'use client'

import { useEffect, useState } from 'react'
import { moveEvidenceCategory } from '@/lib/move-evidence-category-client'
import {
  defaultFileCategories,
  normalizeFileCategoryLabel,
  type FileCategory,
} from '@/lib/project-file-categories'

type EvidenceCardProps = {
  doc: {
    id: string
    file_name: string
    file_path: string
    file_type?: string
    evidence_type: string
    summary: string
    created_at?: string
    uploaded_by_label?: string
  }
  projectId?: string
  claimId?: string
  categories?: FileCategory[]
  categoryLabels?: string[]
  canEdit: boolean
  canDelete: boolean
  canRescan?: boolean
  variant?: 'full' | 'detail'
  onOpen: (filePath: string) => void
  onDelete: (filePath: string) => void
  onUpdated: () => void
}

export function EvidenceCard({
  doc,
  projectId,
  claimId,
  categories: categoriesProp,
  categoryLabels: categoryLabelsProp,
  canEdit,
  canDelete,
  canRescan = false,
  variant = 'full',
  onOpen,
  onDelete,
  onUpdated,
}: EvidenceCardProps) {
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(doc.summary)
  const [evidenceType, setEvidenceType] = useState(doc.evidence_type)
  const [saving, setSaving] = useState(false)
  const [movingCategory, setMovingCategory] = useState(false)
  const [rescanning, setRescanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPdf =
    doc.file_type === 'application/pdf' ||
    doc.file_name.toLowerCase().endsWith('.pdf')
  const isImage =
    doc.file_type?.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp)$/i.test(doc.file_name)
  const canRunAiRescan = isPdf || isImage
  const isDetail = variant === 'detail'

  const categories =
    categoriesProp?.length ? categoriesProp : defaultFileCategories()

  const categoryLabels =
    categoryLabelsProp?.length
      ? categoryLabelsProp
      : categories.map((c) => c.label)

  const displayCategory = normalizeFileCategoryLabel(evidenceType, categories)

  useEffect(() => {
    setSummary(doc.summary)
    setEvidenceType(doc.evidence_type)
    setEditing(false)
  }, [doc.file_path, doc.summary, doc.evidence_type])

  async function save() {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/evidence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: doc.file_path,
        summary,
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

  async function moveToCategory(nextLabel: string) {
    if (nextLabel === displayCategory) return
    setMovingCategory(true)
    setError(null)
    try {
      await moveEvidenceCategory(doc.file_path, nextLabel)
      setEvidenceType(nextLabel)
      onUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not move document')
    }
    setMovingCategory(false)
  }

  async function rescanText() {
    if (!canRescan || !projectId || !claimId || rescanning) return
    setRescanning(true)
    setError(null)
    try {
      const { rescanEvidenceWithAi } = await import('@/lib/upload-evidence-server')
      await rescanEvidenceWithAi(
        projectId,
        claimId,
        doc.file_path,
        doc.file_name,
        doc.file_type || 'application/pdf'
      )
      onUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Re-scan failed')
    }
    setRescanning(false)
  }

  return (
    <article
      className={
        isDetail
          ? 'pt-3 space-y-3'
          : 'border border-border rounded-xl p-4 bg-surface-elevated shadow-sm'
      }
    >
      {canEdit && !editing && isDetail && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-dim mb-1">
            Category
          </label>
          <select
            value={displayCategory}
            disabled={movingCategory}
            onChange={(e) => void moveToCategory(e.target.value)}
            className="border border-border rounded-xl p-2 w-full text-sm bg-surface min-h-[44px] disabled:opacity-50"
            aria-label="Move document to category"
          >
            {categoryLabels.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {movingCategory && (
            <p className="text-xs text-muted-dim mt-1">Moving…</p>
          )}
        </div>
      )}

      {!isDetail && !canEdit && (
        <span className="inline-block text-xs font-semibold bg-surface border border-border text-foreground px-2 py-1 rounded-full mb-2">
          {displayCategory}
        </span>
      )}

      {!isDetail && (
        <>
          <button
            type="button"
            className="block font-medium text-brand-bright text-left w-full py-1 min-h-[44px]"
            onClick={() => onOpen(doc.file_path)}
          >
            {doc.file_name}
          </button>
          {doc.created_at && (
            <p className="text-xs text-muted-dim mt-1">
              Uploaded {new Date(doc.created_at).toLocaleString()}
              {doc.uploaded_by_label ? ` · ${doc.uploaded_by_label}` : ''}
            </p>
          )}
        </>
      )}

      {isDetail && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(doc.file_path)}
            className="text-sm font-medium text-brand-bright min-h-[40px]"
          >
            View file
          </button>
          {doc.uploaded_by_label && (
            <span className="text-xs text-muted-dim">
              Uploaded by {doc.uploaded_by_label}
            </span>
          )}
        </div>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="border border-border rounded-xl p-3 w-full min-h-[100px] text-sm bg-surface"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 btn-primary text-[#052e16] py-2 rounded-lg text-sm font-medium min-h-[44px] disabled:opacity-50"
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
              className="flex-1 border border-border py-2 rounded-lg text-sm min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted leading-relaxed">{doc.summary}</p>
      )}

      {error && !editing && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-3">
          {canRescan && canRunAiRescan && (
            <button
              type="button"
              className="text-sm font-medium text-brand-bright min-h-[44px] disabled:opacity-50"
              disabled={rescanning}
              onClick={rescanText}
            >
              {rescanning ? 'Re-scanning…' : 'Re-scan text'}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="text-sm font-medium text-foreground min-h-[44px]"
              onClick={() => setEditing(true)}
            >
              Edit summary text
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="text-red-500 font-medium text-sm min-h-[44px]"
              onClick={() => onDelete(doc.file_path)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}
