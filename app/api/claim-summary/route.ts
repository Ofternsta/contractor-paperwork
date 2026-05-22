import { NextResponse } from 'next/server'
import { generateClaimSummary } from '@/lib/claim-ai'
import { listEvidence } from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { claim_id, project_id } = await req.json()

    if (!claim_id || !project_id) {
      return NextResponse.json(
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const { data: claim, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .eq('project_id', project_id)
      .maybeSingle()

    if (error || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const evidence = await listEvidence(supabase, project_id, claim_id)
    const summary = await generateClaimSummary(claim, evidence)

    return NextResponse.json({ summary })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Summary failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
