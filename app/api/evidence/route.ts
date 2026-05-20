import { NextResponse } from 'next/server'
import { deleteEvidence, listEvidence } from '@/lib/evidence-storage'

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    const claimId = params.get('claim_id')
    const projectId = params.get('project_id')

    if (!claimId || !projectId) {
      return NextResponse.json(
        { error: 'claim_id and project_id are required' },
        { status: 400 }
      )
    }

    const evidence = await listEvidence(projectId, claimId)
    return NextResponse.json({ evidence })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to load evidence' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const filePath = new URL(req.url).searchParams.get('file_path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'file_path is required' },
        { status: 400 }
      )
    }

    await deleteEvidence(filePath)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete evidence' },
      { status: 500 }
    )
  }
}
