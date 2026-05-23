'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { EvidenceCard } from '@/components/evidence-card'
import { ClaimAiPanel } from '@/components/claim-ai-panel'
import { ClaimStatusWorkflow } from '@/components/claim-status-workflow'
import type { ClaimStatus } from '@/lib/claim-status'
import { ClientPortalPanel } from '@/components/client-portal-panel'
import { EvidenceUpload } from '@/components/evidence-upload'
import { InternalNotesPanel } from '@/components/internal-notes-panel'
import { ProjectSchedulePanel } from '@/components/project-schedule-panel'
import { PlanUpgradeBanner } from '@/components/plan-upgrade-banner'
import { ProjectClientPanel } from '@/components/project-client-panel'
import { isUnlimited } from '@/lib/plan-entitlements'
import { EVIDENCE_TYPES } from '@/lib/evidence-types'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { uploadEvidenceWithAi } from '@/lib/upload-evidence-server'
import { validateUploadSize } from '@/lib/upload-limits'

type Claim = {
  id: string
  client_name: string
  property_address: string
  status: string
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
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    loadUserAccess().then(({ access: a }) => setAccess(a))
  }, [])

  async function fetchClaims() {
    setLoading(true)

    const { data, error } = await supabase
      .from('claims')
      .select('id, client_name, property_address, status')
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

    if (!targetId) {
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
      setConfigError(payload.error || 'Failed to load evidence')
      setDocuments([])
      return
    }

    setDocuments(payload.evidence || [])
  }

  async function uploadFile(file: File) {
    if (!selectedClaim || !access?.canUploadEvidence) return

    const sizeError = validateUploadSize(file.size)
    if (sizeError) {
      setUploadMessage(sizeError)
      return
    }

    setUploading(true)
    setUploadMessage(null)
    setConfigError(null)

    try {
      const evidence = await uploadEvidenceWithAi(id, selectedClaim.id, file)

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
  }

  async function uploadMany(files: File[]) {
    if (!selectedClaim || !access?.canUploadEvidence) return
    setUploading(true)
    setUploadMessage(null)
    let ok = 0
    for (const file of files) {
      const sizeError = validateUploadSize(file.size)
      if (sizeError) {
        setUploadMessage(sizeError)
        break
      }
      try {
        await uploadEvidenceWithAi(id, selectedClaim.id, file)
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
    const { data, error } = await supabase.storage
      .from('project-files')
      .createSignedUrl(filePath, 3600)

    if (error || !data?.signedUrl) {
      setConfigError(error?.message || 'Could not open file')
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  useEffect(() => {
    if (!id) return
    fetchClaims()
  }, [id])

  useEffect(() => {
    if (selectedClaim?.id) {
      fetchEvidence(selectedClaim.id)
    }
  }, [selectedClaim?.id])

  if (loading || !access) {
    return (
      <div className="min-h-dvh flex items-center justify-center safe-x">
        <p className="text-gray-600">Loading project…</p>
      </div>
    )
  }

  if (!claims.length) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="No access" backHref="/projects" backLabel="Projects" />
        <div className="safe-x px-4 py-6 max-w-5xl mx-auto">
          <p className="text-gray-600">
            You do not have access to this project, or it has no claims yet.
          </p>
        </div>
      </div>
    )
  }

  const activeClaim = selectedClaim ?? claims[0]
  if (!activeClaim) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="No access" backHref="/projects" backLabel="Projects" />
        <div className="safe-x px-4 py-6 max-w-5xl mx-auto">
          <p className="text-gray-600">No claim selected for this project.</p>
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
    const matchesSearch = !q || haystack.includes(q)
    const matchesType =
      filterType === 'All' || doc.evidence_type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title={selectedClaim?.client_name || 'Project'}
        subtitle={selectedClaim?.property_address}
        backHref="/projects"
        backLabel="Projects"
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-5xl mx-auto w-full pb-8 safe-bottom space-y-4">
        {access.role === 'client' && (
          <p className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">
            View only — you cannot upload or edit files on this project.
          </p>
        )}

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

        {access.canManageProjectClients && (
          <ProjectClientPanel projectId={id} />
        )}

        {access.role === 'admin' && !access.canManageProjectClients && (
          <PlanUpgradeBanner message="Client portal access is available on Professional and Enterprise. Upgrade to invite clients to view projects." />
        )}

        <label className="block lg:hidden">
          <span className="text-sm font-medium text-muted mb-1 block">
            Active claim
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
                {c.client_name} — {c.status}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <aside className="hidden lg:block lg:col-span-3 card p-3">
            <h2 className="font-bold mb-3">Claims</h2>
            {claims.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClaim(c)}
                className={`w-full text-left p-3 mb-2 rounded-lg transition-colors ${
                  selectedClaim?.id === c.id
                    ? 'btn-primary text-[#052e16]'
                    : 'bg-surface-elevated border border-border hover:border-brand-dim/50'
                }`}
              >
                <p className="font-bold">{c.client_name}</p>
                <p className="text-xs opacity-80">{c.status}</p>
              </button>
            ))}
          </aside>

          <div className="lg:col-span-9 space-y-4">
            {configError && (
              <p className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-xl">
                {configError}
              </p>
            )}

            <ClaimStatusWorkflow
              claimId={activeClaim.id}
              projectId={id}
              status={activeClaim.status}
              canEdit={access.canUpdateClaimInfo}
              onStatusChange={(next: ClaimStatus) => {
                setClaims((prev) =>
                  prev.map((c) =>
                    c.id === activeClaim.id ? { ...c, status: next } : c
                  )
                )
                setSelectedClaim((c) =>
                  c?.id === activeClaim.id ? { ...c, status: next } : c
                )
              }}
            />

            <ClaimAiPanel
              claimId={activeClaim.id}
              projectId={id}
              canGenerate={access.canUpdateClaimInfo}
              canExportPdf={access.canExportPdf}
              canExportHtml={access.canExportHtml}
              exportHasWatermark={access.exportHasWatermark}
              aiSummariesLimit={access.aiSummariesLimit}
              aiSummariesUsed={access.aiSummariesUsed}
            />

            {access.canViewClientPortal && (
              <ClientPortalPanel
                projectId={id}
                canApprove={access.canApproveDocuments}
              />
            )}

            {access.canManageSchedule && (
              <ProjectSchedulePanel
                projectId={id}
                claimId={activeClaim.id}
                canEdit={access.canUpdateClaimInfo}
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
                onUpload={uploadFile}
                onUploadMany={uploadMany}
              />
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="border border-gray-300 rounded-xl p-3 flex-1 w-full"
                placeholder="Search files, summaries, OCR text…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="input-field w-full sm:w-auto sm:min-w-[180px]"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option>All</option>
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {filtered.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No evidence uploaded yet.
                </p>
              )}

              {filtered.map((doc) => (
                <EvidenceCard
                  key={doc.id}
                  doc={doc}
                  canEdit={access.canEditEvidenceSummary}
                  canDelete={access.canDeleteEvidence}
                  onOpen={openFile}
                  onDelete={deleteFile}
                  onUpdated={() => fetchEvidence(activeClaim.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
