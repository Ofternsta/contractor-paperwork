'use server'

import { sendSignupConfirmationEmail } from '@/lib/auth-email'
import { finishPendingSignup, getSignupStatus } from '@/lib/finish-pending-signup'

export async function getAccountSetupStatus(email: string) {
  return getSignupStatus(email)
}

export async function finishAccountSetup(email: string) {
  return finishPendingSignup(email)
}

export async function resendVerificationEmail(email: string) {
  return sendSignupConfirmationEmail(email)
}
