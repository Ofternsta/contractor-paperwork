import { NextResponse } from 'next/server'
import { generateClaimSummary } from '@/lib/claim-ai'
import {
  buildHtmlReport,
  buildPdfReport,
} from '@/lib/export-report-builders'
import { listEvidence } from '@/lib/evidence-storage'
import { consumeAiSummary } from '@/lib/plan-enforcement'
import { getOrgPlanContext } from '@/lib/org-plan'
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
    const format = params.get('format') || 'pdf'

    if (!claimId || !projectId) {
      return NextResponse.json(
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const { data: claim, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error || !claim) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle()

    if (!project?.organization_id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const planCtx = await getOrgPlanContext(supabase, project.organization_id)
    if (!planCtx) {
      return NextResponse.json(
        { error: 'Active subscription required to export.' },
        { status: 403 }
      )
    }

    const canExport =
      planCtx.entitlements.standardPdfExport ||
      planCtx.entitlements.claimPacketExport

    const wantsPdf = format === 'pdf'
    if (!canExport) {
      return NextResponse.json(
        {
          error:
            'Exports are not included on your plan. Upgrade to Starter or higher.',
        },
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

    const evidence = await listEvidence(supabase, projectId, claimId)
    const summary = await generateClaimSummary(claim, evidence)
    const safeName = `job-${claim.claim_number || claimId}`.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )

    if (format === 'html') {
      const html = buildHtmlReport(claim, summary, evidence)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${safeName}.html"`,
        },
      })
    }

    const pdfBytes = await buildPdfReport(claim, summary, evidence)

    if (pdfBytes) {
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    const html = buildHtmlReport(claim, summary, evidence)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeName}.html"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
