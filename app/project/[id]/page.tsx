'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { EvidenceUpload } from '@/components/evidence-upload'
import { EVIDENCE_TYPES } from '@/lib/evidence-types'
import { supabase } from '@/lib/supabase'
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
  created_at?: string
}

export default function ProjectPageClient() {
  const params = useParams()
  const id = params.id as string
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [documents, setDocuments] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')

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

    if (!res.ok) {
      setConfigError(payload.error || 'Failed to load evidence')
      setDocuments([])
      return
    }

    setDocuments(payload.evidence || [])
  }

  async function uploadFile(file: File) {
    if (!selectedClaim) return

    const sizeError = validateUploadSize(file.size)
    if (sizeError) {
      setUploadMessage(sizeError)
      return
    }

    setUploading(true)
    setUploadMessage(null)
    setConfigError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('claim_id', selectedClaim.id)
      formData.append('project_id', id)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setUploadMessage(payload.error || 'Upload failed')
        setUploading(false)
        return
      }

      await fetchEvidence(selectedClaim.id)
      const category = payload.evidence?.evidence_type || 'Other'
      setUploadMessage(`Uploaded ${file.name} — categorized as ${category}`)
    } catch (err: any) {
      setUploadMessage(err.message || 'Upload failed')
    }

    setUploading(false)
  }

  async function deleteFile(filePath: string) {
    setConfigError(null)

    const res = await fetch(
      `/api/evidence?file_path=${encodeURIComponent(filePath)}`,
      { method: 'DELETE' }
    )

    const payload = await res.json().catch(() => ({}))

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

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center safe-x">
        <p className="text-gray-600">Loading project…</p>
      </div>
    )
  }

  if (!claims.length) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="No Claims" backHref="/" backLabel="Projects" />
        <div className="safe-x px-4 py-6 max-w-5xl mx-auto">
          <p className="text-gray-600">
            Create a claim from the home page first.
          </p>
        </div>
      </div>
    )
  }

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.file_name
      ?.toLowerCase()
      .includes(search.toLowerCase())
    const matchesType =
      filterType === 'All' || doc.evidence_type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title={selectedClaim?.client_name || 'Project'}
        subtitle={selectedClaim?.property_address}
        backHref="/"
        backLabel="Projects"
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-5xl mx-auto w-full pb-8 safe-bottom space-y-4">
        <label className="block lg:hidden">
          <span className="text-sm font-medium text-gray-700 mb-1 block">
            Active claim
          </span>
          <select
            className="w-full border border-gray-300 rounded-xl p-3 bg-white"
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
          <aside className="hidden lg:block lg:col-span-3 border rounded-xl p-3">
            <h2 className="font-bold mb-3">Claims</h2>
            {claims.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClaim(c)}
                className={`w-full text-left p-3 mb-2 rounded-lg ${
                  selectedClaim?.id === c.id
                    ? 'bg-black text-white'
                    : 'bg-gray-100'
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

            <EvidenceUpload
              uploading={uploading}
              uploadMessage={uploadMessage}
              onUpload={uploadFile}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="border border-gray-300 rounded-xl p-3 flex-1 w-full"
                placeholder="Search files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded-xl p-3 w-full sm:w-auto sm:min-w-[180px]"
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
                <article
                  key={doc.id}
                  className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
                >
                  <span className="inline-block text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-1 rounded-full mb-2">
                    {doc.evidence_type}
                  </span>
                  <button
                    type="button"
                    className="block font-medium text-blue-700 text-left w-full py-1 min-h-[44px]"
                    onClick={() => openFile(doc.file_path)}
                  >
                    {doc.file_name}
                  </button>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-4">
                    {doc.summary}
                  </p>
                  <button
                    type="button"
                    className="text-red-600 font-medium mt-3 min-h-[44px]"
                    onClick={() => deleteFile(doc.file_path)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
