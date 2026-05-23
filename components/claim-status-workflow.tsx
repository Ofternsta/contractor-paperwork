'use client'

import { useState } from 'react'
import {
  CLAIM_STATUSES,
  type ClaimStatus,
  claimStatusIndex,
  normalizeClaimStatus,
} from '@/lib/claim-status'

type Props = {
  claimId: string
  projectId: string
  status: string
  canEdit: boolean
  onStatusChange: (status: ClaimStatus) => void
}

export function ClaimStatusWorkflow({
  claimId,
  projectId,
  status,
  canEdit,
  onStatusChange,
}: Props) {
  const current = normalizeClaimStatus(status)
  const currentIndex = claimStatusIndex(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(next: ClaimStatus) {
    if (!canEdit || next === current || saving) return

    setSaving(true)
    setError(null)

    const res = await fetch('/api/claims/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim_id: claimId,
        project_id: projectId,
        status: next,
      }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Could not update status')
      setSaving(false)
      return
    }

    onStatusChange(next)
    setSaving(false)
  }

  return (
    <section className="border border-border rounded-xl p-4 bg-surface-elevated">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-bold text-foreground">Claim status</h2>
        <span className="text-sm font-medium text-muted">{current}</span>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {CLAIM_STATUSES.map((stage, index) => {
          const isPast = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={stage}>
              <button
                type="button"
                disabled={!canEdit || saving || isCurrent}
                onClick={() => updateStatus(stage)}
                className={`w-full text-left rounded-lg px-2 py-2 text-xs sm:text-sm border transition min-h-[52px] ${
                  isCurrent
                    ? 'btn-primary text-[#052e16] border-black font-semibold'
                    : isPast
                      ? 'bg-green-50 text-green-900 border-green-200'
                      : 'bg-surface text-muted border-border'
                } ${canEdit && !isCurrent ? 'hover:border-gray-400 cursor-pointer' : ''} ${
                  !canEdit || saving ? 'opacity-80 cursor-default' : ''
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
                  {index + 1}
                </span>
                {stage}
              </button>
            </li>
          )
        })}
      </ol>

      {canEdit && (
        <p className="text-xs text-muted-dim mt-3">
          Tap a stage to update the claim workflow.
        </p>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-dim mt-3">
          View only — status updates are for your contractor team.
        </p>
      )}

      {saving && (
        <p className="text-sm text-muted mt-2">Updating status…</p>
      )}
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  )
}
