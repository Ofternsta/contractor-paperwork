import { NextResponse } from 'next/server'
import {
  generateJobIntelligenceReport,
  reportToPlainText,
} from '@/lib/job-intelligence-summary'
import { consumeAiSummary } from '@/lib/plan-enforcement'
import { getOrgPlanContext } from '@/lib/org-plan'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 90

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

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', project_id)
      .maybeSingle()

    if (!project?.organization_id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const planCtx = await getOrgPlanContext(supabase, project.organization_id)
    if (!planCtx) {
      return NextResponse.json(
        { error: 'Active subscription required for AI summaries.' },
        { status: 403 }
      )
    }

    const aiCheck = await consumeAiSummary(
      project.organization_id,
      planCtx.entitlements
    )
    if (!aiCheck.ok) {
      return NextResponse.json(
        { error: aiCheck.error, used: aiCheck.used, limit: aiCheck.limit },
        { status: 403 }
      )
    }

    const report = await generateJobIntelligenceReport(
      supabase,
      project_id,
      claim_id
    )

    if (!report) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      report,
      summary: reportToPlainText(report),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Summary failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
