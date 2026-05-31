'use client'

import { useState } from 'react'
import { displayJobDescription } from '@/lib/job-display-notes'
import {
  statusLabel,
  type StatusStage,
} from '@/lib/project-status-workflow'

export type ProjectJobRow = {
  id: string
  client_name: string
  status: string
  notes?: string | null
}

type Props = {
  jobs: ProjectJobRow[]
  projectId: string
  legacyProjectNotes?: string | null
  workflow: StatusStage[]
  selectedId: string | null
  onSelect: (job: ProjectJobRow) => void
  canAddJob?: boolean
  onJobAdded?: (job: ProjectJobRow) => void
  variant?: 'sidebar' | 'summary'
}

function JobDetails({
  job,
  legacyProjectNotes,
  workflow,
  compact,
  selected,
  showCustomerName,
}: {
  job: ProjectJobRow
  legacyProjectNotes?: string | null
  workflow: StatusStage[]
  compact?: boolean
  selected?: boolean
  showCustomerName?: boolean
}) {
  const description = displayJobDescription(job.notes, legacyProjectNotes)
  const currentStatus = statusLabel(job.status, workflow)
  const labelClass = selected
    ? 'text-[10px] uppercase tracking-wide opacity-70 font-medium'
    : 'text-[10px] uppercase tracking-wide text-muted-dim font-medium'
  const valueClass = selected
    ? compact
      ? 'text-sm font-bold leading-snug'
      : 'font-bold leading-snug'
    : compact
      ? 'text-sm font-bold text-foreground leading-snug'
      : 'font-bold text-foreground leading-snug'
  const metaClass = selected
    ? compact
      ? 'text-xs opacity-90'
      : 'text-sm opacity-90'
    : compact
      ? 'text-xs text-foreground'
      : 'text-sm text-foreground'
  const descriptionClass = selected
    ? `${compact ? 'text-xs' : 'text-sm'} opacity-85 leading-relaxed whitespace-pre-wrap`
    : `${compact ? 'text-xs' : 'text-sm'} text-muted leading-relaxed whitespace-pre-wrap`

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div>
        <p className={labelClass}>Job description</p>
        <p className={descriptionClass}>
          {description ?? (
            <span className={selected ? 'italic opacity-75' : 'text-muted-dim italic'}>
              No job description on file
            </span>
          )}
        </p>
      </div>
      <div>
        <p className={labelClass}>Current status</p>
        <p className={metaClass}>{currentStatus}</p>
      </div>
      {showCustomerName ? (
        <div>
          <p className={labelClass}>Customer</p>
          <p className={valueClass}>{job.client_name}</p>
        </div>
      ) : null}
    </div>
  )
}

export function AddJobDialog({
  projectId,
  onClose,
  onAdded,
}: {
  projectId: string
  onClose: () => void
  onAdded: (job: ProjectJobRow) => void
}) {
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = description.trim()
    if (!trimmed) {
      setError('Job description is required.')
      return
    }

    setSaving(true)
    setError(null)
    const res = await fetch(`/api/projects/${projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_description: trimmed }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not add job')
      setSaving(false)
      return
    }
    onAdded(payload.job as ProjectJobRow)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-job-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-4 shadow-xl space-y-3"
      >
        <h3 id="add-job-title" className="font-bold text-lg text-foreground">
          Add a job
        </h3>
        <p className="text-sm text-muted">
          Describe the work for this job on the project. Each job has its own
          status, files, and timeline.
        </p>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">
            Job description <span className="text-red-600">*</span>
          </span>
          <textarea
            className="input-field w-full min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Kitchen remodel — cabinets, counters, and flooring"
            required
            autoFocus
          />
        </label>
        {error && (
          <p className="text-sm alert-error rounded-lg p-2">{error}</p>
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm border border-border px-3 py-2 rounded-lg min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !description.trim()}
            className="text-sm btn-primary text-[#052e16] px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add job'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProjectJobsList({
  jobs,
  projectId,
  legacyProjectNotes,
  workflow,
  selectedId,
  onSelect,
  canAddJob = false,
  onJobAdded,
  variant = 'sidebar',
}: Props) {
  const [addOpen, setAddOpen] = useState(false)

  if (variant === 'summary') {
    const job = jobs.find((j) => j.id === selectedId) ?? jobs[0]
    if (!job) return null
    return (
      <div className="card p-4 lg:hidden">
        <h2 className="font-bold text-foreground mb-3">Active job</h2>
        <JobDetails
          job={job}
          legacyProjectNotes={legacyProjectNotes}
          workflow={workflow}
          compact
          showCustomerName={jobs.length > 1}
        />
      </div>
    )
  }

  return (
    <>
      <aside className="hidden lg:block lg:col-span-3 card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-foreground">Jobs</h2>
          {canAddJob && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-xs border border-border px-2.5 py-1.5 rounded-lg hover:border-brand-dim/50 font-medium"
            >
              Add a job
            </button>
          )}
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-dim">No jobs on this project yet.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => {
              const isSelected = selectedId === job.id
              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(job)}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                      isSelected
                        ? 'btn-primary text-[#052e16] border-black'
                        : 'bg-surface-elevated border-border hover:border-brand-dim/50'
                    }`}
                  >
                    <JobDetails
                      job={job}
                      legacyProjectNotes={legacyProjectNotes}
                      workflow={workflow}
                      compact
                      selected={isSelected}
                      showCustomerName={jobs.length > 1}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      {addOpen && (
        <AddJobDialog
          projectId={projectId}
          onClose={() => setAddOpen(false)}
          onAdded={(job) => onJobAdded?.(job)}
        />
      )}
    </>
  )
}
