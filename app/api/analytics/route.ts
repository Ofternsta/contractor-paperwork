import { NextResponse } from 'next/server'
import { listEvidence } from '@/lib/evidence-storage'
import { requireAuth } from '@/lib/require-auth'

export async function GET() {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('admin_user_id', user.id)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, customer_name, project_address, created_at')
      .eq('organization_id', org.id)

    const projectList = projects || []
    const projectIds = projectList.map((p) => p.id)

    const { data: claims } = projectIds.length
      ? await supabase
          .from('claims')
          .select('id, project_id, status, insurance_company')
          .in('project_id', projectIds)
      : { data: [] }

    const claimList = claims || []
    const claimsByStatus: Record<string, number> = {}
    for (const c of claimList) {
      const s = c.status || 'Unknown'
      claimsByStatus[s] = (claimsByStatus[s] || 0) + 1
    }

    let evidenceCount = 0
    const evidenceByType: Record<string, number> = {}

    for (const claim of claimList) {
      const evidence = await listEvidence(
        supabase,
        claim.project_id,
        claim.id
      )
      evidenceCount += evidence.length
      for (const e of evidence) {
        const t = e.evidence_type || 'Unknown'
        evidenceByType[t] = (evidenceByType[t] || 0) + 1
      }
    }

    const { count: workerCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'approved')

    const { count: pendingWorkers } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'pending')

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('organization_id', org.id)
      .maybeSingle()

    return NextResponse.json({
      organization: org.name,
      projectCount: projectList.length,
      claimCount: claimList.length,
      evidenceCount,
      claimsByStatus,
      evidenceByType,
      approvedWorkers: workerCount ?? 0,
      pendingWorkers: pendingWorkers ?? 0,
      subscription: subscription || { plan: 'trial', status: 'trialing' },
      recentProjects: projectList.slice(0, 5),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analytics failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
