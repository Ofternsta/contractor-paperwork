import { NextResponse } from 'next/server'
import { generateClaimTimeline } from '@/lib/claim-ai'
import { listEvidence } from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 60

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
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const { data: stored } = await supabase
      .from('claim_timeline_events')
      .select('event_date, title, description, source')
      .eq('claim_id', claimId)
      .order('event_date', { ascending: true })

    if (stored?.length) {
      return NextResponse.json({ events: stored })
    }

    const { data: claim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .maybeSingle()

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const evidence = await listEvidence(supabase, projectId, claimId)
    const events = await generateClaimTimeline(claim, evidence)

    return NextResponse.json({ events })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Timeline failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { claim_id, project_id, persist } = await req.json()

    if (!claim_id || !project_id) {
      return NextResponse.json(
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const { data: claim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .eq('project_id', project_id)
      .maybeSingle()

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const evidence = await listEvidence(supabase, project_id, claim_id)
    const events = await generateClaimTimeline(claim, evidence)

    if (persist && events.length) {
      await supabase
        .from('claim_timeline_events')
        .delete()
        .eq('claim_id', claim_id)

      await supabase.from('claim_timeline_events').insert(
        events.map((e) => ({
          claim_id,
          event_date: e.event_date,
          title: e.title,
          description: e.description,
          source: e.source,
        }))
      )
    }

    return NextResponse.json({ events })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Timeline failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
