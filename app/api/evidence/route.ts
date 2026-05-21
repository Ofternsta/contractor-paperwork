import { NextResponse } from 'next/server'
import { deleteEvidence, listEvidence } from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = new URL(req.url).searchParams
    const claimId = params.get('claim_id')
    const projectId = params.get('project_id')

    if (!claimId || !projectId) {
      return NextResponse.json(
        { error: 'claim_id and project_id are required' },
        { status: 400 }
      )
    }

    const evidence = await listEvidence(supabase, projectId, claimId)
    return NextResponse.json({ evidence })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to load evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filePath = new URL(req.url).searchParams.get('file_path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'file_path is required' },
        { status: 400 }
      )
    }

    await deleteEvidence(supabase, filePath)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
