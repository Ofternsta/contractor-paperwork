'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { EvidenceFolders } from '@/components/evidence-folders'
import { ProjectPageHeader } from '@/components/project-page-header'
import { JobTimelinePanel } from '@/components/job-timeline-panel'
import { ProjectAiExportSection } from '@/components/project-ai-export-section'
import { ClaimStatusWorkflow } from '@/components/claim-status-workflow'
import { ProjectArchivePanel } from '@/components/project-archive-panel'
import {
  defaultFileCategories,
  type FileCategory,
} from '@/lib/project-file-categories'
import {
  DEFAULT_STATUS_WORKFLOW,
  isCompletedStatus,
  normalizeStatusKey,
  statusLabel,
  type StatusStage,
} from '@/lib/project-status-workflow'
import { EvidenceUpload } from '@/components/evidence-upload'
import { LedgerStackLoader } from '@/components/ledgerstack-loader'
import { InternalNotesPanel } from '@/components/internal-notes-panel'
import { MessagePanel } from '@/components/message-panel'
import { ProjectJobsList } from '@/components/project-jobs-list'
import { ProjectSchedulePanel } from '@/components/project-schedule-panel'
import { isUnlimited } from '@/lib/plan-entitlements'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import type { WorkerPermissions } from '@/lib/worker-permissions'
import { supabase } from '@/lib/supabase'
import { uploadEvidenceWithAi } from '@/lib/upload-evidence-server'
import { validateUploadSize } from '@/lib/upload-limits'

type Claim = {
  id: string
  client_name: string
  property_address: string
  status: string
  notes?: string | null
}

type Evidence = {
  id: string
  claim_id: string
  file_name: string
  file_path: string
  file_type: string
  evidence_type: string
  summary: string
  extracted_text?: string
  created_at?: string
  uploaded_by_label?: string
}

export default function ProjectPageClient() {
  const params = useParams()
  const id = params.id as string
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [documents, setDocuments] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string>('Processing…')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [archivePrompt, setArchivePrompt] = useState(false)
  const [statusWorkflow, setStatusWorkflow] = useState<StatusStage[]>(
    DEFAULT_STATUS_WORKFLOW.map((s) => ({ ...s }))
  )
  const [fileCategories, setFileCategories] = useState<FileCategory[]>(
    defaultFileCategories()
  )
  const [projectNotes, setProjectNotes] = useState<string | null>(null)

  function mergeWorkerProjectAccess(
    base: UserAccess,
    wp: WorkerPermissions
  ): UserAccess {
    return {
      ...base,
      canUploadEvidence: wp.can_upload,
      canViewFiles: wp.can_view_files,
      canDeleteEvidence: wp.can_delete,
      canManageSchedule: base.canViewCalendar && wp.can_add_events,
      canUpdateClaimInfo:
        wp.can_upload || wp.can_add_events || wp.can_view_files,
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))

    async function loadAccessForProject() {
      const { access: base } = await loadUserAccess()
      if (!base) {
        setAccess(null)
        return
      }

      if (base.role === 'worker') {
        const res = await fetch(`/api/projects/${id}/my-access`)
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !payload.permissions) {
          window.location.href = '/projects'
          return
        }
        setAccess(mergeWorkerProjectAccess(base, payload.permissions))
        return
      }

      setAccess(base)
      if (base.role === 'client') {
        void fetch('/api/auth/link-client-access', { method: 'POST' })
      }
    }

    void loadAccessForProject()
  }, [id])

  useEffect(() => {
    async function loadProjectConfig() {
      const [workflowRes, categoriesRes, projectRes] = await Promise.all([
        fetch(`/api/projects/${id}/workflow`),
        fetch(`/api/projects/${id}/file-categories`),
        supabase.from('projects').select('notes').eq('id', id).maybeSingle(),
      ])
      const workflowPayload = await workflowRes.json().catch(() => ({}))
      const categoriesPayload = await categoriesRes.json().catch(() => ({}))
      if (workflowRes.ok && workflowPayload.workflow) {
        setStatusWorkflow(workflowPayload.workflow as StatusStage[])
      }
      if (categoriesRes.ok && categoriesPayload.categories) {
        setFileCategories(categoriesPayload.categories as FileCategory[])
      }
      if (!projectRes.error && projectRes.data) {
        setProjectNotes(projectRes.data.notes ?? null)
      }
    }
    void loadProjectConfig()
  }, [id])

  async function fetchClaims() {
    setLoading(true)

    const { data, error } = await supabase
      .from('claims')
      .select('id, client_name, property_address, status, notes')
      .eq('project_id', id)

    if (error) {
      console.error(error)
      setClaims([])
      setSelectedClaim(null)
      setLoading(false)
      return
    }

    const safe = (data || []) as Claim[]
    setClaims(safe)
    setSelectedClaim(safe.length > 0 ? safe[0] : null)
    setLoading(false)
  }

  async function fetchEvidence(claimId?: string) {
    const targetId = claimId || selectedClaim?.id

    if (!targetId || !access?.canViewFiles) {
      setDocuments([])
      return
    }

    setConfigError(null)

    const res = await fetch(
      `/api/evidence?claim_id=${targetId}&project_id=${id}`
    )
    const payload = await res.json().catch(() => ({}))

    if (res.status === 401) {
      window.location.href = '/login'
      return
    }

    if (!res.ok) {
      setConfigError(payload.error || 'Failed to load documents')
      setDocuments([])
      return
    }

    setDocuments(payload.evidence || [])
  }

  async function uploadFile(file: File) {
    if (!selectedClaim || !access?.canUploadEvidence) return

    if (file.size === 0) {
      setUploadMessage('That file is empty. Please try again.')
      return
    }

    const sizeError = validateUploadSize(file.size)
    if (sizeError) {
      setUploadMessage(sizeError)
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadProgressLabel('Preparing…')
    setUploadMessage(null)
    setConfigError(null)

    try {
      const evidence = await uploadEvidenceWithAi(
        id,
        selectedClaim.id,
        file,
        (pct, label) => {
          setUploadProgress(pct)
          setUploadProgressLabel(label)
        }
      )

      await fetchEvidence(selectedClaim.id)
      setUploadMessage(
        `Uploaded ${file.name} — categorized as ${evidence.evidence_type}`
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      if (message.toLowerCase().includes('jwt') || message.includes('401')) {
        window.location.href = '/login'
        return
      }
      setUploadMessage(message)
    }

    setUploading(false)
    setUploadProgress(null)
  }

  async function uploadMany(files: File[]) {
    if (!selectedClaim || !access?.canUploadEvidence) return
    setUploading(true)
    setUploadProgress(0)
    setUploadMessage(null)
    let ok = 0
    const total = files.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const sizeError = validateUploadSize(file.size)
      if (sizeError) {
        setUploadMessage(sizeError)
        break
      }
      try {
        await uploadEvidenceWithAi(id, selectedClaim.id, file, (pct, label) => {
          const overall = Math.round(((i + pct / 100) / total) * 100)
          setUploadProgress(overall)
          setUploadProgressLabel(
            total > 1 ? `File ${i + 1} of ${total}: ${label}` : label
          )
        })
        ok++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setUploadMessage(message)
        break
      }
    }
    await fetchEvidence(selectedClaim.id)
    if (ok > 0) {
      setUploadMessage(`Uploaded ${ok} file(s) with AI analysis`)
    }
    setUploading(false)
    setUploadProgress(null)
  }

  async function deleteFile(filePath: string) {
    if (!access?.canDeleteEvidence) return
    setConfigError(null)

    const res = await fetch(
      `/api/evidence?file_path=${encodeURIComponent(filePath)}`,
      { method: 'DELETE' }
    )

    const payload = await res.json().catch(() => ({}))

    if (res.status === 401) {
      window.location.href = '/login'
      return
    }

    if (!res.ok) {
      setConfigError(payload.error || 'Failed to delete file')
      return
    }

    await fetchEvidence(selectedClaim?.id)
  }

  async function openFile(filePath: string) {
    if (!access?.canViewFiles) {
      setConfigError('You do not have permission to view project files.')
      return
    }

    setConfigError(null)

    const res = await fetch(
      `/api/evidence/open?file_path=${encodeURIComponent(filePath)}&project_id=${encodeURIComponent(id)}`
    )
    const payload = await res.json().catch(() => ({}))

    if (res.status === 401) {
      window.location.href = '/login'
      return
    }

    if (!res.ok || !payload.signedUrl) {
      setConfigError(payload.error || 'Could not open file')
      return
    }

    window.open(payload.signedUrl as string, '_blank')
  }

  useEffect(() => {
    if (!id) return
    fetchClaims()
  }, [id])

  useEffect(() => {
    if (selectedClaim?.id && access?.canViewFiles) {
      fetchEvidence(selectedClaim.id)
    }
    if (selectedClaim?.id && access && !access.canViewFiles) {
      setDocuments([])
    }
  }, [selectedClaim?.id, access?.canViewFiles])

  if (loading || !access) {
    return (
      <div className="min-h-dvh flex items-center justify-center safe-x">
        <LedgerStackLoader />
      </div>
    )
  }

  if (!claims.length) {
    return (
      <div className="min-h-dvh">
        <ProjectPageHeader
          title="No access"
          location="Return to your project list."
          backHref="/projects"
          backLabel="Projects"
        />
        <div className="safe-x px-4 py-6 max-w-5xl mx-auto">
          <p className="text-gray-600">
            {access.role === 'client'
              ? 'There are no jobs on this project yet. Your contractor will add progress here.'
              : 'You do not have access to this project, or it has no jobs yet.'}
          </p>
        </div>
      </div>
    )
  }

  const activeClaim = selectedClaim ?? claims[0]
  const isClientViewer = access.role === 'client'
  const activeStatusKey = activeClaim
    ? normalizeStatusKey(activeClaim.status, statusWorkflow)
    : null
  const allJobsCompleted =
    claims.length > 0 &&
    claims.every((c) => isCompletedStatus(c.status, statusWorkflow))

  if (!activeClaim) {
    return (
      <div className="min-h-dvh">
        <ProjectPageHeader
          title="No access"
          location="Return to your project list."
          backHref="/projects"
          backLabel="Projects"
        />
        <div className="safe-x px-4 py-6 max-w-5xl mx-auto">
          <p className="text-gray-600">No job selected for this project.</p>
        </div>
      </div>
    )
  }

  const q = search.toLowerCase().trim()
  const filtered = documents.filter((doc) => {
    const haystack = [
      doc.file_name,
      doc.summary,
      doc.evidence_type,
      doc.extracted_text,
      doc.uploaded_by_label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return !q || haystack.includes(q)
  })

  return (
    <div className="min-h-dvh flex flex-col">
      <ProjectPageHeader
        title={activeClaim.client_name}
        location={activeClaim.property_address}
        backHref="/projects"
        backLabel="Projects"
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-5xl mx-auto w-full pb-8 safe-bottom space-y-4">
        {access.planName && access.role !== 'client' && (
          <p className="text-xs text-gray-600">
            {access.planName} plan
            {!isUnlimited(access.aiSummariesLimit) && (
              <>
                {' '}
                · AI {access.aiSummariesUsed}/{access.aiSummariesLimit} used this
                month
              </>
            )}
          </p>
        )}

        <label className="block lg:hidden">
          <span className="text-sm font-medium text-muted mb-1 block">
            Active job
          </span>
          <select
            className="input-field"
            value={selectedClaim?.id || ''}
            onChange={(e) => {
              const claim = claims.find((c) => c.id === e.target.value)
              if (claim) setSelectedClaim(claim)
            }}
          >
            {claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.client_name} — {statusLabel(c.status, statusWorkflow)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <ProjectJobsList
            jobs={claims}
            projectNotes={projectNotes}
            workflow={statusWorkflow}
            selectedId={selectedClaim?.id ?? null}
            onSelect={(job) => {
              const claim = claims.find((c) => c.id === job.id)
              if (claim) setSelectedClaim(claim)
            }}
          />

          <div className="lg:col-span-9 space-y-4">
            <ProjectJobsList
              variant="summary"
              jobs={claims}
              projectNotes={projectNotes}
              workflow={statusWorkflow}
              selectedId={selectedClaim?.id ?? null}
              onSelect={(job) => {
                const claim = claims.find((c) => c.id === job.id)
                if (claim) setSelectedClaim(claim)
              }}
            />
            {configError && (
              <p className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-xl">
                {configError}
              </p>
            )}

            <ClaimStatusWorkflow
              claimId={activeClaim.id}
              projectId={id}
              status={activeClaim.status}
              workflow={statusWorkflow}
              canEdit={access.canUpdateReportStatus}
              showReadOnlyHint={!isClientViewer}
              onStatusChange={(next: string) => {
                setClaims((prev) =>
                  prev.map((c) =>
                    c.id === activeClaim.id ? { ...c, status: next } : c
                  )
                )
                setSelectedClaim((c) =>
                  c?.id === activeClaim.id ? { ...c, status: next } : c
                )
                setTimelineRefreshKey((k) => k + 1)
              }}
              onMarkedCompleted={() => {
                if (access.canArchiveProject) setArchivePrompt(true)
              }}
            />

            {access.canArchiveProject && (
              <ProjectArchivePanel
                projectId={id}
                projectName={activeClaim.client_name}
                jobCompleted={
                  activeStatusKey !== null &&
                  isCompletedStatus(activeStatusKey, statusWorkflow)
                }
                allJobsCompleted={allJobsCompleted}
                canArchive
                promptSave={archivePrompt}
                onPromptDismiss={() => setArchivePrompt(false)}
              />
            )}

            {!isClientViewer && (
              <JobTimelinePanel
                claimId={activeClaim.id}
                projectId={id}
                timelineRefreshKey={timelineRefreshKey}
                canGenerate={access.canUpdateClaimInfo}
                aiSummariesLimit={access.aiSummariesLimit}
                aiSummariesUsed={access.aiSummariesUsed}
              />
            )}

            {access.canViewCalendar && (
              <ProjectSchedulePanel
                projectId={id}
                claimId={activeClaim.id}
                canEdit={access.canManageSchedule && access.canUpdateClaimInfo}
              />
            )}

            {access.canUseTeamMessages && access.role !== 'client' && (
              <MessagePanel
                channel="project"
                projectId={id}
                currentUserId={userId}
                title="Project messages"
                subtitle="Chat scoped to this job — admins and approved workers only."
                canSend={
                  access.role === 'admin' ||
                  (access.role === 'worker' &&
                    access.workerStatus === 'approved')
                }
              />
            )}

            {access.canViewInternalNotes && (
              <InternalNotesPanel
                projectId={id}
                claimId={activeClaim.id}
                currentUserId={userId}
                canPost={access.canUpdateClaimInfo}
              />
            )}

            {access.canUploadEvidence && (
              <EvidenceUpload
                uploading={uploading}
                uploadMessage={uploadMessage}
                uploadProgress={uploadProgress}
                uploadProgressLabel={uploadProgressLabel}
                onUpload={uploadFile}
                onUploadMany={uploadMany}
              />
            )}

            {access.canViewFiles ? (
              <>
                <input
                  className="input-field w-full"
                  placeholder="Search files, summaries, OCR text…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <EvidenceFolders
                  documents={filtered}
                  projectId={id}
                  claimId={activeClaim.id}
                  categories={fileCategories}
                  canEdit={access.canEditEvidenceSummary}
                  canDelete={access.canDeleteEvidence}
                  canRescan={access.canUploadEvidence}
                  emptyMessage={
                    isClientViewer
                      ? 'No documents have been shared with you yet. Your contractor will select files for you to view.'
                      : undefined
                  }
                  onOpen={openFile}
                  onDelete={deleteFile}
                  onUpdated={() => fetchEvidence(activeClaim.id)}
                />
              </>
            ) : (
              <p className="text-sm text-muted border border-border rounded-xl p-4">
                Your account cannot view project files. Contact your organization
                admin if you need access.
              </p>
            )}

            {!isClientViewer && (
              <ProjectAiExportSection
                claimId={activeClaim.id}
                projectId={id}
                canGenerate={access.canUpdateClaimInfo}
                canExportPdf={access.canExportPdf}
                canExportHtml={access.canExportHtml}
                aiSummariesLimit={access.aiSummariesLimit}
                aiSummariesUsed={access.aiSummariesUsed}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
