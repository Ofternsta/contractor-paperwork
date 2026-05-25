'use client'

import { useMemo, useState } from 'react'
import { EvidenceCard } from '@/components/evidence-card'
import { EVIDENCE_TYPES, type EvidenceType } from '@/lib/evidence-types'

export type EvidenceDoc = {
  id: string
  file_name: string
  file_path: string
  file_type?: string
  evidence_type: string
  summary: string
  created_at?: string
  uploaded_by_label?: string
}

type EvidenceFoldersProps = {
  documents: EvidenceDoc[]
  projectId: string
  claimId: string
  canEdit: boolean
  canDelete: boolean
  canRescan: boolean
  onOpen: (filePath: string) => void
  onDelete: (filePath: string) => void
  onUpdated: () => void
}

function folderKey(type: string): EvidenceType {
  const normalized = EVIDENCE_TYPES.find(
    (t) => t.toLowerCase() === type.trim().toLowerCase()
  )
  return normalized ?? 'Other'
}

function formatUploadedAt(createdAt?: string) {
  if (!createdAt) return 'Upload time unknown'
  return new Date(createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function sortChronological(a: EvidenceDoc, b: EvidenceDoc) {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0
  return ta - tb
}

export function EvidenceFolders({
  documents,
  projectId,
  claimId,
  canEdit,
  canDelete,
  canRescan,
  onOpen,
  onDelete,
  onUpdated,
}: EvidenceFoldersProps) {
  const [expanded, setExpanded] = useState<Set<EvidenceType>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      EVIDENCE_TYPES.map((t) => [t, [] as EvidenceDoc[]])
    ) as Record<EvidenceType, EvidenceDoc[]>

    for (const doc of documents) {
      map[folderKey(doc.evidence_type)].push(doc)
    }

    for (const type of EVIDENCE_TYPES) {
      map[type].sort(sortChronological)
    }

    return map
  }, [documents])

  const totalCount = documents.length

  function toggleFolder(type: EvidenceType) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function selectFile(filePath: string) {
    setSelectedPath((current) => (current === filePath ? null : filePath))
  }

  function handleDelete(filePath: string) {
    setSelectedPath((current) => (current === filePath ? null : current))
    onDelete(filePath)
  }

  if (totalCount === 0) {
    return (
      <section className="space-y-2" aria-label="Evidence by category">
        {EVIDENCE_TYPES.map((type) => (
          <div
            key={type}
            className="border border-border rounded-xl bg-surface-elevated overflow-hidden"
          >
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="font-semibold text-foreground">{type}</span>
              <span className="text-sm text-muted-dim tabular-nums">0 files</span>
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-dim text-center py-4">
          No evidence uploaded yet. Upload files to add them to a category folder.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2" aria-label="Evidence by category">
      {EVIDENCE_TYPES.map((type) => {
        const files = grouped[type]
        const count = files.length
        const isOpen = expanded.has(type)

        return (
          <div
            key={type}
            className="border border-border rounded-xl bg-surface-elevated overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleFolder(type)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 min-h-[48px] text-left hover:bg-surface transition-colors"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-foreground">{type}</span>
              <span className="flex items-center gap-2 text-sm text-muted">
                <span className="tabular-nums">
                  {count} {count === 1 ? 'file' : 'files'}
                </span>
                <span
                  className={`text-muted-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </button>

            {isOpen && (
              <ul className="border-t border-border divide-y divide-border">
                {files.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted-dim">
                    No files in this category.
                  </li>
                )}
                {files.map((doc) => {
                  const isSelected = selectedPath === doc.file_path
                  return (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => selectFile(doc.file_path)}
                        className={`flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 px-4 py-3 min-h-[44px] text-left transition-colors ${
                          isSelected
                            ? 'bg-brand/10 border-l-2 border-l-brand'
                            : 'hover:bg-surface'
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground truncate">
                          {doc.file_name}
                        </span>
                        <span className="text-xs text-muted-dim shrink-0">
                          {formatUploadedAt(doc.created_at)}
                        </span>
                      </button>

                      {isSelected && (
                        <div className="px-4 pb-4 border-t border-border bg-surface/50">
                          <EvidenceCard
                            doc={doc}
                            projectId={projectId}
                            claimId={claimId}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canRescan={canRescan}
                            variant="detail"
                            onOpen={onOpen}
                            onDelete={handleDelete}
                            onUpdated={onUpdated}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}
