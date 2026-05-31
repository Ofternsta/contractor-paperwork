import { NextResponse } from 'next/server'
import {
  buildHtmlJobReport,
  buildPdfJobReport,
} from '@/lib/export-report-builders'
import { generateJobIntelligenceReport } from '@/lib/job-intelligence-summary'
import { consumeAiSummary } from '@/lib/plan-enforcement'
import { getOrgPlanContext } from '@/lib/org-plan'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 90

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

    const report = await generateJobIntelligenceReport(
      supabase,
      projectId,
      claimId
    )

    if (!report) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const safeName = `project-report-${report.jobLabel}`.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )

    if (format === 'html') {
      const html = buildHtmlJobReport(report)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${safeName}.html"`,
        },
      })
    }

    const pdfBytes = await buildPdfJobReport(report)

    if (pdfBytes) {
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    const html = buildHtmlJobReport(report)
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
