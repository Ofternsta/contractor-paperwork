import { NextResponse } from 'next/server'
import { createProjectForUser } from '@/lib/create-project-server'
import { linkClientAccessByEmailServer } from '@/lib/link-client-access-server'
import { listClientProjectsServer } from '@/lib/list-client-projects-server'
import { loadUserAccessServer } from '@/lib/load-access-server'
import { requireAuth } from '@/lib/require-auth'

/** List projects visible to the signed-in user. */
export async function GET() {
  try {
    const { supabase, user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { access } = await loadUserAccessServer()
    if (!access) {
      return NextResponse.json({ error: 'Profile not set up' }, { status: 403 })
    }

    if (access.role === 'client') {
      if (!user.email) {
        return NextResponse.json({ projects: [] })
      }

      await linkClientAccessByEmailServer(user.email, user.id, {
        userSupabase: supabase,
      })
      const projects = await listClientProjectsServer(user.id, user.email)
      return NextResponse.json({ projects })
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, customer_name, project_address, notes, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load projects'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { access } = await loadUserAccessServer()
    if (!access?.canCreateProject || !access.organizationId) {
      return NextResponse.json(
        { error: 'You do not have permission to create projects.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const result = await createProjectForUser(user.id, access.organizationId, {
      customerName: String(body.customer_name || body.customerName || ''),
      projectAddress: String(
        body.project_address || body.projectAddress || ''
      ),
      jobDescription: String(
        body.job_description ||
          body.jobDescription ||
          body.notes ||
          ''
      ).trim(),
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ project: result.project })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create project failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
