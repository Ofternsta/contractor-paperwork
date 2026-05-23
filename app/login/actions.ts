'use server'

import { finishPendingSignup, getSignupStatus } from '@/lib/finish-pending-signup'

export async function getAccountSetupStatus(email: string) {
  return getSignupStatus(email)
}

export async function finishAccountSetup(email: string) {
  return finishPendingSignup(email)
}
