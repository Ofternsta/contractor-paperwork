import 'server-only'

import {
  defaultFirstStatusKey,
  parseProjectStatusWorkflow,
} from '@/lib/project-status-workflow'
import { createServiceClient } from '@/lib/supabase/service'
import { touchProjectActivity } from '@/lib/touch-project-activity'

async function userMayCreateInOrg(userId: string, organizationId: string) {
  const service = createServiceClient()
  const { data: org } = await service
    .from('organizations')
    .select('admin_user_id')
    .eq('id', organizationId)
    .maybeSingle()
  return org?.admin_user_id === userId
}

export async function createJobForProject(
  userId: string,
  organizationId: string,
  projectId: string,
  jobDescription: string
) {
  const description = jobDescription.trim()
  if (!description) {
    return { error: 'Job description is required.' }
  }

  if (!(await userMayCreateInOrg(userId, organizationId))) {
    return {
      error:
        'Only organization admins can add jobs. Ask your admin to add a job to this project.',
    }
  }

  const service = createServiceClient()

  const { data: project, error: projectError } = await service
    .from('projects')
    .select('id, customer_name, project_address, organization_id, status_workflow')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    return { error: 'Project not found.' }
  }

  if (project.organization_id !== organizationId) {
    return { error: 'Forbidden' }
  }

  const workflow = parseProjectStatusWorkflow(project.status_workflow)
  const initialStatus = defaultFirstStatusKey(workflow)
  const customerName = String(project.customer_name || 'Customer').trim()
  const projectAddress = String(project.project_address || '').trim()

  const { data: claim, error: claimError } = await service
    .from('claims')
    .insert({
      project_id: projectId,
      client_name: customerName,
      property_address: projectAddress,
      loss_type: 'Property',
      insurance_company: 'Unknown',
      claim_number: `AUTO-${Date.now()}`,
      status: initialStatus,
      notes: description,
    })
    .select('id, client_name, property_address, status, notes')
    .single()

  if (claimError || !claim) {
    return { error: claimError?.message || 'Could not add job.' }
  }

  await touchProjectActivity(service, projectId)

  return { job: claim }
}
