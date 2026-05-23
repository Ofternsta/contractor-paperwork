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
import { supabase } from '@/lib/supabase'
import {
  finishAccountSetup,
  getAccountSetupStatus,
  resendVerificationEmail,
} from './actions'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
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
    router.push('/')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom">
      <main className="flex-1 flex flex-col justify-center safe-x px-4 py-8 max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <p className="text-4xl mb-3" aria-hidden>
            📋
          </p>
          <h1 className="text-2xl font-bold">LedgerStack</h1>
          <p className="text-gray-600 mt-2 text-sm">
            Sign in to manage projects and claim evidence
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4"
        >
          <div className="flex rounded-xl bg-white border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                mode === 'signin' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                mode === 'signup' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Sign up
            </button>
          </div>

          {mode === 'signup' && (
            <>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
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
                          ? 'border-black bg-white'
                          : 'border-gray-200 bg-white'
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
                        <span className="text-xs text-gray-600">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Your name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border border-gray-300 rounded-xl p-3 w-full bg-white"
                  placeholder="Jane Contractor"
                />
              </div>

              {role === 'admin' && (
                <div>
                  <label
                    htmlFor="orgName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company / organization name
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="border border-gray-300 rounded-xl p-3 w-full bg-white"
                    placeholder="Acme Restoration"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Next step: choose a subscription plan, then your account is
                    created.
                  </p>
                </div>
              )}

              {role === 'worker' && (
                <div className="space-y-2">
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
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
                    className="border border-gray-300 rounded-xl p-3 w-full bg-white uppercase tracking-[0.2em] font-mono text-center"
                    placeholder="8 characters"
                    autoComplete="off"
                  />
                  {inviteChecking && (
                    <p className="text-sm text-gray-500">Checking code…</p>
                  )}
                  {inviteValid && inviteCompany && (
                    <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg p-2">
                      Joining <strong>{inviteCompany}</strong>
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
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
              className="block text-sm font-medium text-gray-700 mb-1"
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
              className="border border-gray-300 rounded-xl p-3 w-full bg-white"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
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
              className="border border-gray-300 rounded-xl p-3 w-full bg-white"
              placeholder="At least 6 characters"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                className="border border-gray-300 rounded-xl p-3 w-full bg-white"
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
                message.includes('sent')
                  ? 'text-green-800 bg-green-50 border border-green-100 rounded-lg p-3'
                  : 'text-red-700 bg-red-50 border border-red-100 rounded-lg p-3'
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
              className="w-full border border-gray-300 text-gray-900 py-3 rounded-xl font-medium disabled:opacity-50 min-h-[48px]"
            >
              {resendingEmail ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              finishingAccount ||
              !email.trim() ||
              !password ||
              (mode === 'signup' && !confirmPassword) ||
              (mode === 'signup' && role === 'worker' && !inviteValid)
            }
            className="w-full bg-black text-white py-4 rounded-xl font-medium disabled:opacity-50 min-h-[52px]"
          >
            {loading
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}
