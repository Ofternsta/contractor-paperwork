import { NextResponse } from 'next/server'
import { analyzeEvidence } from '@/lib/analyze-evidence'
import { extractTextFromFile } from '@/lib/extract-text'
import { validateUploadSize } from '@/lib/upload-limits'
import {
  newEvidenceId,
  saveEvidence,
  uploadEvidenceFile,
} from '@/lib/evidence-storage'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const claimId = formData.get('claim_id') as string | null
    const projectId = formData.get('project_id') as string | null

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

    const { filePath } = await uploadEvidenceFile(projectId, claimId, file)
    const text = await extractTextFromFile(file)
    const { evidenceType, summary } = await analyzeEvidence(file, text)

    const evidence = await saveEvidence({
      id: newEvidenceId(),
      claim_id: claimId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      evidence_type: evidenceType,
      summary,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ evidence })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
