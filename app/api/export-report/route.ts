import { NextResponse } from 'next/server'
import {
  buildHtmlJobReport,
  buildPdfJobReport,
} from '@/lib/export-report-builders'
import { generateJobIntelligenceReport } from '@/lib/job-intelligence-summary'
import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'
import { consumeAiSummary } from '@/lib/plan-enforcement'
import { getOrgPlanContext } from '@/lib/org-plan'
import { requireAuth } from '@/lib/require-auth'

export const maxDuration = 90

function safeReportFilename(jobLabel: string) {
  return `project-report-${jobLabel}`.replace(/[^a-zA-Z0-9.-]/g, '_')
}

function exportFileResponse(
  report: JobIntelligenceReport,
  format: string
): Promise<NextResponse> | NextResponse {
  const safeName = safeReportFilename(report.jobLabel)

  if (format === 'html') {
    const html = buildHtmlJobReport(report)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeName}.html"`,
      },
    })
  }

  return buildPdfJobReport(report).then((pdfBytes) => {
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
  })
}

async function authorizeExport(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  projectId: string,
  claimId: string,
  options?: { skipAiQuota?: boolean }
) {
  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.organization_id) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  }

  const planCtx = await getOrgPlanContext(supabase, project.organization_id)
  if (!planCtx) {
    return {
      error: NextResponse.json(
        { error: 'Active subscription required to export.' },
        { status: 403 }
      ),
    }
  }

  const canExport =
    planCtx.entitlements.standardPdfExport ||
    planCtx.entitlements.claimPacketExport

  if (!canExport) {
    return {
      error: NextResponse.json(
        {
          error:
            'Exports are not included on your plan. Upgrade to Starter or higher.',
        },
        { status: 403 }
      ),
    }
  }

  if (!options?.skipAiQuota) {
    const aiCheck = await consumeAiSummary(
      project.organization_id,
      planCtx.entitlements
    )
    if (!aiCheck.ok) {
      return {
        error: NextResponse.json(
          { error: aiCheck.error, used: aiCheck.used, limit: aiCheck.limit },
          { status: 403 }
        ),
      }
    }
  }

  return { organizationId: project.organization_id }
}

function isValidReport(
  report: unknown,
  claimId: string,
  projectId: string
): report is JobIntelligenceReport {
  if (!report || typeof report !== 'object') return false
  const r = report as JobIntelligenceReport
  return (
    r.claimId === claimId &&
    r.projectId === projectId &&
    typeof r.overview === 'string' &&
    Array.isArray(r.sections) &&
    r.sections.length > 0
  )
}

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

    const auth = await authorizeExport(supabase, projectId, claimId)
    if ('error' in auth && auth.error) return auth.error

    const report = await generateJobIntelligenceReport(
      supabase,
      projectId,
      claimId
    )

    if (!report) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return exportFileResponse(report, format)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Export the on-screen report so PDF matches Generate AI summary. */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const claimId = body.claim_id as string | undefined
    const projectId = body.project_id as string | undefined
    const format = (body.format as string | undefined) || 'pdf'
    const report = body.report as unknown

    if (!claimId || !projectId) {
      return NextResponse.json(
        { error: 'claim_id and project_id required' },
        { status: 400 }
      )
    }

    const auth = await authorizeExport(supabase, projectId, claimId, {
      skipAiQuota: isValidReport(report, claimId, projectId),
    })
    if ('error' in auth && auth.error) return auth.error

    let exportReport: JobIntelligenceReport | null = isValidReport(
      report,
      claimId,
      projectId
    )
      ? report
      : null

    if (!exportReport) {
      exportReport = await generateJobIntelligenceReport(
        supabase,
        projectId,
        claimId
      )
    }

    if (!exportReport) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return exportFileResponse(exportReport, format)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
