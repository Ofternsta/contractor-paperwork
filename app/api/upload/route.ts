import { NextResponse } from 'next/server'
import { analyzeEvidence } from '@/lib/analyze-evidence'
import { extractTextFromFile } from '@/lib/extract-text'
import {
  newEvidenceId,
  saveEvidence,
  uploadEvidenceFile,
} from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'
import { validateUploadSize } from '@/lib/upload-limits'

export const maxDuration = 60

const BUCKET = 'project-files'

async function fileFromStorage(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  filePath: string,
  fileName: string,
  fileType: string
): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath)

  if (error || !data) {
    throw new Error(error?.message || 'Could not read uploaded file from storage')
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  return new File([buffer], fileName, {
    type: fileType || 'application/octet-stream',
  })
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''
    let claimId: string | null = null
    let projectId: string | null = null
    let file: File | null = null
    let existingPath: string | null = null

    if (contentType.includes('application/json')) {
      const body = await req.json()
      claimId = body.claim_id ?? null
      projectId = body.project_id ?? null
      existingPath = body.file_path ?? null
      const fileName = body.file_name as string
      const fileType = (body.file_type as string) || ''

      if (!existingPath || !claimId || !projectId || !fileName) {
        return NextResponse.json(
          { error: 'file_path, file_name, claim_id, and project_id are required' },
          { status: 400 }
        )
      }

      file = await fileFromStorage(supabase, existingPath, fileName, fileType)
    } else {
      const formData = await req.formData()
      file = formData.get('file') as File | null
      claimId = formData.get('claim_id') as string | null
      projectId = formData.get('project_id') as string | null
    }

    if (!file || !claimId || !projectId) {
      return NextResponse.json(
        { error: 'file, claim_id, and project_id are required' },
        { status: 400 }
      )
    }

    const sizeError = validateUploadSize(file.size)
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 })
    }

    const filePath =
      existingPath ||
      (await uploadEvidenceFile(supabase, projectId, claimId, file)).filePath

    const extractedText = await extractTextFromFile(file)
    const { evidenceType, summary } = await analyzeEvidence(file, extractedText)

    const evidence = await saveEvidence(supabase, {
      id: newEvidenceId(),
      claim_id: claimId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      evidence_type: evidenceType,
      summary,
      extracted_text: extractedText || undefined,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ evidence })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    console.error('Upload error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
