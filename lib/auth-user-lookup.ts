import 'server-only'

import { normalizeSignupEmail } from '@/lib/trial-eligibility'
import { createServiceClient } from '@/lib/supabase/service'

export async function getAuthUserIdByEmail(
  email: string
): Promise<string | null> {
  const service = createServiceClient()
  const normalized = normalizeSignupEmail(email)

  const { data: rpcId, error: rpcError } = await service.rpc(
    'get_auth_user_id_by_email',
    { user_email: normalized }
  )

  if (!rpcError && rpcId) {
    return rpcId as string
  }

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      console.error('listUsers error:', error.message)
      break
    }

    const match = data.users.find(
      (u) => u.email?.toLowerCase() === normalized
    )
    if (match) return match.id

    if (data.users.length < 200) break
  }

  return null
}

export async function authUserExistsByEmail(email: string): Promise<boolean> {
  return Boolean(await getAuthUserIdByEmail(email))
}
