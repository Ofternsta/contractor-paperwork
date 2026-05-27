'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { SubscriptionPlanPicker } from '@/components/subscription-plan-picker'
import {
  clearAdminSignupDraft,
  loadAdminSignupDraft,
  saveAdminSignupDraftPlan,
  type AdminSignupDraft,
} from '@/lib/signup-draft'
import { loadUserAccess } from '@/lib/load-access'
import type { BillingPlanId } from '@/lib/stripe-config'
import { supabase } from '@/lib/supabase'

function SubscriptionOnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRegister = searchParams.get('register') === '1'
  const isRenew = searchParams.get('renew') === '1'

  const [draft, setDraft] = useState<AdminSignupDraft | null>(null)
  const [selected, setSelected] = useState<BillingPlanId | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [stripeConfigured, setStripeConfigured] = useState(true)
  const [trialAvailable, setTrialAvailable] = useState(true)
  const [renewMode, setRenewMode] = useState(false)

  useEffect(() => {
    async function init() {
      if (searchParams.get('canceled')) {
        setMessage('Checkout canceled. Choose a plan to continue.')
      }

      if (isRegister) {
        const signupDraft = loadAdminSignupDraft()
        if (!signupDraft) {
          router.replace('/login?signup=admin')
          return
        }
        setDraft(signupDraft)
        setOrgName(signupDraft.organizationName)

        const trialRes = await fetch(
          `/api/auth/trial-eligibility?email=${encodeURIComponent(signupDraft.email)}`
        )
        const trialData = await trialRes.json().catch(() => ({}))
        setTrialAvailable(Boolean(trialData.trialAvailable))

        setChecking(false)
        return
      }

      const { access } = await loadUserAccess()
      if (!access || access.role !== 'admin') {
        router.replace('/login')
        return
      }

      setRenewMode(isRenew)
      setOrgName(access.organizationName)

      const res = await fetch('/api/billing')
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMessage(data.error || 'Could not load billing.')
        setChecking(false)
        return
      }

      setStripeConfigured(Boolean(data.stripeConfigured))
      setTrialAvailable(Boolean(data.trialAvailable))

      if (!data.needsPlanSelection && data.subscription?.status === 'active') {
        router.replace('/projects')
        return
      }

      if (data.subscription?.plan) {
        setSelected(data.subscription.plan as BillingPlanId)
      }

      if (!data.trialAvailable) {
        setSelected((current) => (current === 'trial' ? null : current))
      }

      setChecking(false)
    }

    init()
  }, [router, searchParams, isRegister, isRenew])

  async function continueWithPlan() {
    if (!selected) {
      setMessage('Select a subscription plan to continue.')
      return
    }

    if (selected === 'trial' && !trialAvailable) {
      setMessage('Free trial is not available for this email. Choose a paid plan.')
      return
    }

    if (!stripeConfigured) {
      setMessage(
        'Stripe must be configured to start a trial (card verification) or paid plan.'
      )
      return
    }

    if (!stripeConfigured) {
      setMessage(
        'Stripe must be configured to start a trial or paid plan.'
      )
      return
    }

    setLoading(true)
    setMessage(null)

    if (isRegister && draft) {
      const accountRes = await fetch('/api/auth/register-admin-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email,
          password: draft.password,
          full_name: draft.fullName,
          organization_name: draft.organizationName,
          plan: selected,
        }),
      })
      const accountPayload = await accountRes.json().catch(() => ({}))

      if (!accountRes.ok) {
        setMessage(accountPayload.error || 'Could not prepare account')
        setLoading(false)
        return
      }

      if (!accountPayload.emailVerified) {
        setMessage(
          accountPayload.message ||
            'Check your email and verify your address before payment.'
        )
      }

      saveAdminSignupDraftPlan(selected)
    }

    const checkoutUrl = `/checkout?plan=${encodeURIComponent(selected)}${isRegister ? '&register=1' : ''}`
    router.push(checkoutUrl)
    setLoading(false)
  }

  async function signOut() {
    clearAdminSignupDraft()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-900/40">
        <p className="text-white text-sm">Loading…</p>
      </div>
    )
  }

  const title = isRegister
    ? 'Choose your subscription'
    : renewMode
      ? 'Renew your subscription'
      : 'Choose your subscription'

  const subtitle = isRegister
    ? `Create your account for ${orgName || 'your company'} after you select a plan.`
    : renewMode
      ? 'Your trial ended or subscription is inactive. Pick a paid plan to continue.'
      : orgName
        ? `${orgName} needs an active plan.`
        : 'Select a plan to continue.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center safe-x safe-y p-4 bg-gray-900/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-title"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-surface-elevated rounded-2xl shadow-2xl border border-border"
      >
        <div className="p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <p className="text-3xl mb-2" aria-hidden>
              📋
            </p>
            <h1 id="subscription-title" className="text-xl font-bold">
              {title}
            </h1>
            <p className="text-sm text-muted mt-2">{subtitle}</p>
            {isRegister && draft && (
              <p className="text-xs text-muted-dim mt-1">{draft.email}</p>
            )}
          </div>

          {message && (
            <p className="text-sm p-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-100">
              {message}
            </p>
          )}

          {!trialAvailable && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-xl">
              The 7-day free trial was already used for this email or payment method.
              Choose a paid plan.
            </p>
          )}

          {!stripeConfigured && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-xl">
              Stripe is required for all plans (trial verifies your card; paid plans
              charge immediately).
            </p>
          )}

          <SubscriptionPlanPicker
            selected={selected}
            onSelect={setSelected}
            disabled={loading}
            hideTrial={!trialAvailable}
          />

          <button
            type="button"
            onClick={continueWithPlan}
            disabled={loading || !selected}
            className="w-full btn-primary text-[#052e16] py-4 rounded-xl font-medium disabled:opacity-50 min-h-[52px]"
          >
            {loading
              ? 'Please wait…'
              : isRegister
                ? 'Verify email & continue to payment'
                : selected === 'trial'
                  ? 'Verify card to continue'
                  : 'Continue to payment'}
          </button>

          <p className="text-xs text-center text-muted-dim">
            {isRegister
              ? 'We email you a confirmation link first. After you verify, you enter card details on the next screen.'
              : 'Paid plans use secure Stripe Checkout. You must verify your email before checkout.'}
          </p>

          {isRegister ? (
            <Link
              href="/login"
              className="block w-full text-center text-sm text-muted-dim py-2 min-h-[44px]"
            >
              Back to sign up
            </Link>
          ) : (
            <button
              type="button"
              onClick={signOut}
              className="w-full text-sm text-muted-dim py-2 min-h-[44px]"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-gray-900/40">
          <p className="text-white text-sm">Loading…</p>
        </div>
      }
    >
      <SubscriptionOnboardingContent />
    </Suspense>
  )
}
