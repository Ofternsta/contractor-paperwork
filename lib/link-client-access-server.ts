import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthUserIdByEmail } from '@/lib/auth-user-lookup'
import { createServiceClient } from '@/lib/supabase/service'

const GRANTS_SQL_HINT =
  'Run supabase/project-client-access-grants.sql in the Supabase SQL Editor, then try again.'

function isPermissionDenied(message: string) {
  return message.toLowerCase().includes('permission denied')
}

type AccessRowInput = {
  projectId: string
  clientEmail: string
  approvedBy: string
  userId: string | null
}

async function upsertClientAccessRow(
  db: SupabaseClient,
  input: AccessRowInput
) {
  return db
    .from('project_client_access')
    .upsert(
      {
        project_id: input.projectId,
        client_email: input.clientEmail,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: input.approvedBy,
        user_id: input.userId,
      },
      { onConflict: 'project_id,client_email' }
    )
    .select('id')
    .single()
}

/** Attach signed-in user id to approved client invites. */
export async function linkClientAccessByEmailServer(
  email: string,
  userId: string,
  options?: { userSupabase?: SupabaseClient }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return { ok: false, error: 'Email required' }
  }

  const patch = { user_id: userId }

  if (options?.userSupabase) {
    const { error } = await options.userSupabase
      .from('project_client_access')
      .update(patch)
      .eq('client_email', normalized)
      .eq('status', 'approved')

    if (!error) return { ok: true }
    if (!isPermissionDenied(error.message)) {
      return { ok: false, error: error.message }
    }
  }

  try {
    const service = createServiceClient()
    const { error } = await service
      .from('project_client_access')
      .update(patch)
      .eq('client_email', normalized)
      .eq('status', 'approved')

    if (error) {
      if (isPermissionDenied(error.message)) {
        return { ok: false, error: `${error.message} ${GRANTS_SQL_HINT}` }
      }
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Link failed'
    return { ok: false, error: message }
  }
}

/** Grant or re-approve client access (restores rows revoked as rejected). */
export async function grantClientProjectAccessServer(
  input: {
    projectId: string
    clientEmail: string
    approvedBy: string
  },
  options?: { adminSupabase?: SupabaseClient }
): Promise<
  | { ok: true; accessId: string }
  | { ok: false; error: string }
> {
  const clientEmail = input.clientEmail.trim().toLowerCase()

  let userId: string | null = null
  try {
    userId = await getAuthUserIdByEmail(clientEmail)
  } catch {
    userId = null
  }

  const rowInput: AccessRowInput = {
    projectId: input.projectId,
    clientEmail,
    approvedBy: input.approvedBy,
    userId,
  }

  let lastError: string | null = null

  if (options?.adminSupabase) {
    const { data: row, error } = await upsertClientAccessRow(
      options.adminSupabase,
      rowInput
    )
    if (!error && row) {
      return { ok: true, accessId: row.id as string }
    }
    lastError = error?.message ?? null
    if (lastError && !isPermissionDenied(lastError)) {
      return { ok: false, error: lastError }
    }
  }

  try {
    const service = createServiceClient()
    const { data: row, error } = await upsertClientAccessRow(service, rowInput)
    if (!error && row) {
      return { ok: true, accessId: row.id as string }
    }
    lastError = error?.message ?? lastError
  } catch (err: unknown) {
    lastError =
      err instanceof Error ? err.message : lastError ?? 'Service client unavailable'
  }

  if (lastError && isPermissionDenied(lastError)) {
    return {
      ok: false,
      error: `permission denied for table project_client_access. ${GRANTS_SQL_HINT}`,
    }
  }

  return { ok: false, error: lastError || 'Could not grant access' }
}
