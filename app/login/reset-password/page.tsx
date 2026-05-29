'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/brand-logo'
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
  validatePasswordPair,
} from '@/lib/password-policy'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(Boolean(session))
      setCheckingSession(false)
      if (!session) {
        setMessage(
          'This reset link is invalid or has expired. Request a new link from the sign-in page.'
        )
      }
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    const validationError = validatePasswordPair(password, confirmPassword)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await supabase.auth.signOut()
    router.push('/login?reset=1')
  }

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom bg-background">
      <main className="flex-1 flex flex-col justify-center safe-x px-4 py-8 max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <BrandLogo href="/" size="lg" className="mx-auto" />
          <h1 className="text-2xl font-bold mt-4 text-white">Set a new password</h1>
          <p className="text-muted mt-2 text-sm">
            Choose a password for your LedgerStack account.{' '}
            {PASSWORD_REQUIREMENTS_TEXT}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-5 space-y-4">
          {checkingSession ? (
            <p className="text-sm text-muted">Checking reset link…</p>
          ) : hasSession ? (
            <>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-muted mb-1">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder={PASSWORD_REQUIREMENTS_TEXT}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-muted mb-1"
                >
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Re-enter password"
                />
              </div>
            </>
          ) : null}

          {message && (
            <p
              className={`text-sm leading-relaxed ${
                message.includes('updated') || message.includes('success')
                  ? 'alert-success'
                  : 'alert-error'
              }`}
            >
              {message}
            </p>
          )}

          {hasSession && !checkingSession && (
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full btn-primary py-4 font-semibold disabled:opacity-50 min-h-[52px]"
            >
              {loading ? 'Saving…' : 'Update password'}
            </button>
          )}

          <Link
            href="/login"
            className="block text-center text-sm text-brand-bright underline min-h-[44px] leading-[44px]"
          >
            Back to sign in
          </Link>
        </form>
      </main>
    </div>
  )
}
