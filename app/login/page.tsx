'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { linkClientAccessByEmail } from '@/lib/auth-signup'
import { saveAdminSignupDraft } from '@/lib/signup-draft'
import {
  INVITE_CODE_LENGTH,
  isProceduralInviteFormat,
  normalizeInviteCode,
} from '@/lib/invite-code'
import type { AppRole } from '@/lib/roles'
import { passwordResetRedirectUrl } from '@/lib/auth-redirect'
import { supabase } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'
import {
  finishAccountSetup,
  getAccountSetupStatus,
  resendVerificationEmail,
} from './actions'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [role, setRole] = useState<AppRole>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteCompany, setInviteCompany] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState(false)
  const [inviteChecking, setInviteChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [finishingAccount, setFinishingAccount] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)

  const runFinishSignup = useCallback(async (targetEmail: string) => {
    const normalized = targetEmail.trim().toLowerCase()
    if (!normalized) return

    setFinishingAccount(true)
    setEmail(normalized)
    setMessage('Creating your account from Stripe payment…')

    try {
      const status = await getAccountSetupStatus(normalized)

      if (status.accountReady) {
        setNeedsVerification(false)
        setMessage(
          `Email verified. Sign in as ${normalized} with your signup password.`
        )
        setFinishingAccount(false)
        return
      }

      if ('needsEmailVerification' in status && status.needsEmailVerification) {
        setNeedsVerification(true)
        setMessage(status.message)
        setFinishingAccount(false)
        return
      }

      const finish = await finishAccountSetup(normalized)

      if (finish.accountReady) {
        setNeedsVerification(false)
        setMessage(
          `Email verified. Sign in as ${normalized} with your signup password.`
        )
        setFinishingAccount(false)
        return
      }

      if ('needsEmailVerification' in finish && finish.needsEmailVerification) {
        setNeedsVerification(true)
        setMessage(finish.message)
        setFinishingAccount(false)
        return
      }

      if ('error' in finish && finish.error) {
        setMessage(finish.error)
        setFinishingAccount(false)
        return
      }

      if ('message' in status && status.message) {
        setMessage(status.message)
      } else {
        setMessage(
          'Could not finish setup. Confirm payment in Stripe completed, then refresh this page.'
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed'
      setMessage(msg)
    }
    setFinishingAccount(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const registeredEmail = params.get('email')?.trim().toLowerCase()

    if (params.get('registered') === '1') {
      if (registeredEmail) setEmail(registeredEmail)
      setMessage(
        params.get('trial') === '1'
          ? 'Card verified. Finishing your account…'
          : 'Payment received. Finishing your account…'
      )
      setMode('signin')
      if (registeredEmail) {
        void runFinishSignup(registeredEmail)
      } else {
        setMessage(
          'Add your email to the URL: /login?registered=1&email=you@company.com'
        )
      }
    }

    if (params.get('signup') === 'admin') {
      setMessage('Enter your details on sign up, then choose a subscription plan.')
      setMode('signup')
      setRole('admin')
    }

    if (params.get('verify') === '1') {
      const verifyEmail = params.get('email')?.trim().toLowerCase()
      if (verifyEmail) setEmail(verifyEmail)
      setNeedsVerification(true)
      setMode('signin')
      setMessage(
        params.get('verified') === '1'
          ? 'Email verified. You can sign in now.'
          : 'Verify your email before signing in. Check your inbox for the confirmation link.'
      )
    }

    if (params.get('reset') === '1') {
      setMode('signin')
      setMessage('Password updated. Sign in with your new password.')
    }
  }, [runFinishSignup])

  async function handleResendVerification() {
    const target = email.trim().toLowerCase()
    if (!target) {
      setMessage('Enter your email address first.')
      return
    }
    setResendingEmail(true)
    setMessage(null)
    const result = await resendVerificationEmail(target)
    setResendingEmail(false)
    if (!result.ok) {
      setMessage(result.error || 'Could not send verification email')
      return
    }
    setNeedsVerification(true)
    setMessage('Verification email sent. Open the link in your inbox, then sign in.')
  }

  const verifyInvite = useCallback(async (raw: string) => {
    const code = normalizeInviteCode(raw)
    setInviteCode(code)
    setInviteCompany(null)
    setInviteValid(false)

    if (code.length < INVITE_CODE_LENGTH) return

    if (!isProceduralInviteFormat(code)) {
      setMessage(
        'Invite code must be 8 characters (letters and numbers) from your company admin.'
      )
      return
    }

    setInviteChecking(true)
    setMessage(null)
    const res = await fetch(`/api/invite/validate?code=${encodeURIComponent(code)}`)
    const payload = await res.json().catch(() => ({}))
    setInviteChecking(false)

    if (!res.ok || !payload.valid) {
      setMessage(payload.error || 'Invalid company invite code.')
      return
    }

    setInviteCompany(payload.organization_name)
    setInviteValid(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'forgot') {
      const target = email.trim().toLowerCase()
      if (!target) {
        setMessage('Enter your email address.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: passwordResetRedirectUrl(),
      })

      setLoading(false)
      if (error) {
        setMessage(error.message)
        return
      }

      setMessage(
        'If an account exists for that email, we sent a password reset link. Check your inbox (and spam).'
      )
      return
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setMessage('Password must be at least 6 characters.')
        setLoading(false)
        return
      }

      if (role === 'worker') {
        const code = normalizeInviteCode(inviteCode)
        if (!isProceduralInviteFormat(code)) {
          setMessage(
            'Enter the 8-character company invite code from your admin.'
          )
          setLoading(false)
          return
        }

        const res = await fetch(
          `/api/invite/validate?code=${encodeURIComponent(code)}`
        )
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !payload.valid) {
          setMessage(
            payload.error ||
              'Invalid company invite code. Workers must join with an admin-issued code.'
          )
          setLoading(false)
          return
        }
      }

      if (role === 'admin') {
        saveAdminSignupDraft({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          organizationName: organizationName.trim() || 'My Company',
        })
        router.push('/onboarding/subscription?register=1')
        setLoading(false)
        return
      }

      const appOrigin =
        typeof window !== 'undefined' ? window.location.origin : ''
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${appOrigin}/auth/callback?next=${encodeURIComponent('/login?verified=1')}`,
          data: {
            role,
            full_name: fullName.trim() || null,
            organization_name: null,
            invite_code:
              role === 'worker' ? normalizeInviteCode(inviteCode) : null,
          },
        },
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      const session = data.session

      if (!session) {
        setNeedsVerification(true)
        setMessage(
          `Account created. Check your email and verify your address before signing in — your ${role} profile will be set up after verification.`
        )
        setMode('signin')
        setLoading(false)
        return
      }

      const setupRes = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          full_name: fullName,
          organization_name: organizationName,
          invite_code: normalizeInviteCode(inviteCode),
        }),
      })
      const setupPayload = await setupRes.json().catch(() => ({}))

      if (!setupRes.ok) {
        setMessage(setupPayload.error || 'Account created but setup failed.')
        setLoading(false)
        return
      }

      if (role === 'worker') {
        setMessage(
          'Worker account created. Your admin must approve you once before you can view projects.'
        )
      } else if (role === 'client') {
        setMessage(
          'Client account created. Your contractor admin must grant you access to each project (by your email).'
        )
      }

      setMode('signin')
      setLoading(false)
      return
    }

    const loginEmail = email.trim().toLowerCase()

    let { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error?.message?.toLowerCase().includes('invalid login')) {
      const finish = await finishAccountSetup(loginEmail)
      if (finish.accountReady) {
        const retry = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        })
        error = retry.error
      } else if (finish.error) {
        setMessage(
          `${finish.error} Use the exact password from signup (before Stripe checkout).`
        )
        setLoading(false)
        return
      }
    }

    if (error) {
      const lower = error.message.toLowerCase()
      if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
        setNeedsVerification(true)
        setMessage(
          'Verify your email before signing in. Check your inbox for the confirmation link.'
        )
        setLoading(false)
        return
      }
      setMessage(
        error.message.includes('Invalid login')
          ? `${error.message} If you just paid, finish setup above, verify your email, then sign in.`
          : error.message
      )
      setLoading(false)
      return
    }

    const {
      data: { user: signedInUser },
    } = await supabase.auth.getUser()

    if (signedInUser && !signedInUser.email_confirmed_at) {
      await supabase.auth.signOut()
      setNeedsVerification(true)
      setMessage(
        'Verify your email before signing in. Check your inbox for the confirmation link.'
      )
      setLoading(false)
      return
    }

    const setupRes = await fetch('/api/auth/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const setupPayload = await setupRes.json().catch(() => ({}))

    if (!setupRes.ok) {
      setMessage(
        setupPayload.error ||
          'Signed in but profile setup failed. Try signing up again or contact support.'
      )
      setLoading(false)
      return
    }

    if (setupPayload.needsSubscription) {
      router.push('/onboarding/subscription?renew=1')
      router.refresh()
      setLoading(false)
      return
    }

    await linkClientAccessByEmail()
    router.push('/projects')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom">
      <main className="flex-1 flex flex-col justify-center safe-x px-4 py-8 max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <BrandLogo href="/" size="lg" className="mx-auto" />
          <p className="text-muted mt-4 text-sm">
            Sign in to manage projects and claim evidence
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card-elevated p-5 space-y-4"
        >
          {mode === 'forgot' ? (
            <p className="text-sm text-muted">
              Enter your account email. We&apos;ll send a link to reset your password.
            </p>
          ) : (
            <div className="flex rounded-xl bg-surface border border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setMessage(null)
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                  mode === 'signin' ? 'btn-primary' : 'text-muted'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setMessage(null)
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                  mode === 'signup' ? 'btn-primary' : 'text-muted'
                }`}
              >
                Sign up
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <>
              <div>
                <span className="block text-sm font-medium text-muted mb-2">
                  Account type
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      ['admin', 'Admin', 'Company owner — billing, team, all projects (choose if you run the business)'],
                      ['worker', 'Worker', 'Join your employer — you need their 8-character company code'],
                      ['client', 'Client', 'View-only — admin grants access per project (by email)'],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label
                      key={value}
                      className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${
                        role === value
                          ? 'border-brand bg-surface-elevated ring-1 ring-brand/40'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={role === value}
                        onChange={() => setRole(value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium block">{label}</span>
                        <span className="text-xs text-muted">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-muted mb-1"
                >
                  Your name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Jane Contractor"
                />
              </div>

              {role === 'admin' && (
                <div>
                  <label
                    htmlFor="orgName"
                    className="block text-sm font-medium text-muted mb-1"
                  >
                    Company / organization name
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="input-field"
                    placeholder="Acme Restoration"
                  />
                  <p className="text-xs text-muted-dim mt-2">
                    Next step: choose a subscription plan, then your account is
                    created.
                  </p>
                </div>
              )}

              {role === 'worker' && (
                <div className="space-y-2">
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-muted mb-1"
                  >
                    Company invite code (from your admin)
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    required
                    minLength={INVITE_CODE_LENGTH}
                    maxLength={INVITE_CODE_LENGTH}
                    value={inviteCode}
                    onChange={(e) => {
                      const code = normalizeInviteCode(e.target.value)
                      setInviteCode(code)
                      setInviteValid(false)
                      setInviteCompany(null)
                    }}
                    onBlur={() => verifyInvite(inviteCode)}
                    className="input-field uppercase tracking-[0.2em] font-mono text-center"
                    placeholder="8 characters"
                    autoComplete="off"
                  />
                  {inviteChecking && (
                    <p className="text-sm text-muted-dim">Checking code…</p>
                  )}
                  {inviteValid && inviteCompany && (
                    <p className="text-sm alert-success">
                      Joining <strong>{inviteCompany}</strong>
                    </p>
                  )}
                  <p className="text-xs text-muted-dim">
                    Codes are auto-generated when a company signs up as admin. You
                    cannot join without a valid code.
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-muted mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@company.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-muted"
                >
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setMessage(null)
                      setPassword('')
                    }}
                    className="text-sm text-muted underline min-h-[44px]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="At least 6 characters"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-muted mb-1"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Re-enter password"
              />
            </div>
          )}

          {message && (
            <p
              className={`text-sm leading-relaxed ${
                message.includes('ready') ||
                message.includes('verified') ||
                message.includes('created') ||
                message.includes('approval') ||
                message.includes('sent') ||
                message.includes('inbox') ||
                message.includes('updated')
                  ? 'alert-success'
                  : 'alert-error'
              }`}
            >
              {message}
            </p>
          )}

          {needsVerification && mode === 'signin' && (
            <button
              type="button"
              disabled={resendingEmail || !email.trim()}
              onClick={handleResendVerification}
              className="w-full btn-secondary py-3 font-medium disabled:opacity-50 min-h-[48px]"
            >
              {resendingEmail ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setMessage(null)
              }}
              className="w-full btn-secondary py-3 font-medium min-h-[48px]"
            >
              Back to sign in
            </button>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              finishingAccount ||
              !email.trim() ||
              (mode !== 'forgot' && !password) ||
              (mode === 'signup' && !confirmPassword) ||
              (mode === 'signup' && role === 'worker' && !inviteValid)
            }
            className="w-full btn-primary py-4 font-semibold disabled:opacity-50 min-h-[52px]"
          >
            {loading
              ? 'Please wait…'
              : mode === 'forgot'
                ? 'Send reset link'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}
