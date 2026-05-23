'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { linkClientAccessByEmail } from '@/lib/auth-signup'
import {
  INVITE_CODE_LENGTH,
  isProceduralInviteFormat,
  normalizeInviteCode,
} from '@/lib/invite-code'
import type { AppRole } from '@/lib/roles'
import { BILLING_PLANS, type BillingPlanId } from '@/lib/stripe-config'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [role, setRole] = useState<AppRole>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [billingPlan, setBillingPlan] = useState<BillingPlanId | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteCompany, setInviteCompany] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState(false)
  const [inviteChecking, setInviteChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

      if (role === 'admin' && !billingPlan) {
        setMessage('Select a subscription plan for your company.')
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

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role,
            full_name: fullName.trim() || null,
            organization_name:
              role === 'admin' ? organizationName.trim() || null : null,
            billing_plan: role === 'admin' ? billingPlan : null,
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
        setMessage(
          `Account created as ${role}. Confirm your email if required, then sign in — your ${role} profile will be set up automatically.`
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
          billing_plan: role === 'admin' ? billingPlan : undefined,
          invite_code: normalizeInviteCode(inviteCode),
        }),
      })
      const setupPayload = await setupRes.json().catch(() => ({}))

      if (!setupRes.ok) {
        setMessage(setupPayload.error || 'Account created but setup failed.')
        setLoading(false)
        return
      }

      if (setupPayload.checkoutUrl) {
        window.location.href = setupPayload.checkoutUrl as string
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
      } else if (role === 'admin') {
        await linkClientAccessByEmail()
        router.push('/')
        router.refresh()
        setLoading(false)
        return
      }

      setMode('signin')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(error.message)
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

    if (setupPayload.checkoutUrl) {
      window.location.href = setupPayload.checkoutUrl as string
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
                        onChange={() => {
                          setRole(value)
                          if (value !== 'admin') setBillingPlan(null)
                        }}
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
                <>
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
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">
                      Subscription plan (required)
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        Object.entries(BILLING_PLANS) as [
                          BillingPlanId,
                          (typeof BILLING_PLANS)[BillingPlanId],
                        ][]
                      ).map(([key, plan]) => (
                        <label
                          key={key}
                          className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${
                            billingPlan === key
                              ? 'border-black bg-white'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="billingPlan"
                            value={key}
                            checked={billingPlan === key}
                            onChange={() => setBillingPlan(key)}
                            className="mt-1"
                          />
                          <span>
                            <span className="font-medium block">{plan.name}</span>
                            <span className="text-xs text-gray-600">
                              {plan.price === 0
                                ? `Free · up to ${plan.projects} projects`
                                : `$${plan.price}/month${
                                    plan.projects > 0
                                      ? ` · up to ${plan.projects} projects`
                                      : ' · unlimited projects'
                                  }`}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Paid plans open Stripe Checkout after signup. Trial starts
                      immediately with no card.
                    </p>
                  </div>
                </>
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
                message.includes('created') || message.includes('approval')
                  ? 'text-green-800'
                  : 'text-red-700'
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !email.trim() ||
              !password ||
              (mode === 'signup' && !confirmPassword) ||
              (mode === 'signup' && role === 'worker' && !inviteValid) ||
              (mode === 'signup' && role === 'admin' && !billingPlan)
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
