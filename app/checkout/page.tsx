'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { StripeEmbeddedCheckout } from '@/components/stripe-embedded-checkout'
import { VerifyEmailBeforeCheckout } from '@/components/verify-email-before-checkout'
import { BrandLogo } from '@/components/brand-logo'
import { BILLING_PLANS, type BillingPlanId } from '@/lib/stripe-config'
import { loadAdminSignupDraft } from '@/lib/signup-draft'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan') as BillingPlanId | null
  const isRegister = searchParams.get('register') === '1'

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false)
  const [checkoutEmail, setCheckoutEmail] = useState<string | null>(null)

  const signupDraft = isRegister ? loadAdminSignupDraft() : null
  const draftPlan = signupDraft?.selectedPlan ?? null
  const resolvedPlan =
    planParam && planParam in BILLING_PLANS
      ? planParam
      : draftPlan && draftPlan in BILLING_PLANS
        ? draftPlan
        : null

  const plan = resolvedPlan
  const planInfo = plan ? BILLING_PLANS[plan] : null

  useEffect(() => {
    if (!isRegister || !draftPlan || planParam) return
    if (draftPlan in BILLING_PLANS) {
      router.replace(`/checkout?plan=${encodeURIComponent(draftPlan)}&register=1`)
    }
  }, [isRegister, draftPlan, planParam, router])

  const startStripeCheckout = useCallback(async () => {
    if (!plan) return

    const configRes = await fetch('/api/billing/config')
    const config = await configRes.json().catch(() => ({}))

    if (!config.stripeConfigured || !config.publishableKey) {
      setError(
        'Card payments are not configured yet. Ask your administrator to set up Stripe (STRIPE.md).'
      )
      setLoading(false)
      return
    }

    setPublishableKey(config.publishableKey)

    const body: Record<string, unknown> = {
      plan,
      embedded: true,
    }

    if (isRegister) {
      const draft = loadAdminSignupDraft()
      if (!draft) {
        router.replace('/login?signup=admin')
        return
      }
      body.register = {
        email: draft.email,
        password: draft.password,
        full_name: draft.fullName,
        organization_name: draft.organizationName,
        plan,
      }
    }

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => ({}))

    if (res.status === 403 && payload.needsEmailVerification) {
      setEmailVerified(false)
      const registerEmail =
        typeof body.register === 'object' &&
        body.register &&
        'email' in body.register
          ? String((body.register as { email?: string }).email || '')
          : ''
      setCheckoutEmail(String(payload.email || registerEmail))
      setError(null)
      setLoading(false)
      return
    }

    if (!res.ok) {
      setError(payload.error || 'Could not start checkout')
      setLoading(false)
      return
    }

    if (payload.checkoutUrl && !payload.clientSecret) {
      window.location.href = payload.checkoutUrl as string
      return
    }

    if (!payload.clientSecret) {
      setError('Checkout session missing. Try again or contact support.')
      setLoading(false)
      return
    }

    setClientSecret(payload.clientSecret)
    setLoading(false)
  }, [plan, isRegister, router])

  useEffect(() => {
    if (!plan) {
      setError('Select a plan first.')
      setLoading(false)
      return
    }

    async function init() {
      if (isRegister) {
        const draft = loadAdminSignupDraft()
        if (!draft) {
          router.replace('/login?signup=admin')
          return
        }

        setCheckoutEmail(draft.email.trim().toLowerCase())

        const accountRes = await fetch('/api/auth/register-admin-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: draft.email,
            password: draft.password,
            full_name: draft.fullName,
            organization_name: draft.organizationName,
            plan,
          }),
        })
        const accountPayload = await accountRes.json().catch(() => ({}))

        if (!accountRes.ok) {
          setError(accountPayload.error || 'Could not prepare account')
          setLoading(false)
          return
        }

        if (!accountPayload.emailVerified) {
          setEmailVerified(false)
          setLoading(false)
          return
        }

        setEmailVerified(true)
        await startStripeCheckout()
        return
      }

      const statusRes = await fetch('/api/auth/email-verification-status')
      const statusPayload = await statusRes.json().catch(() => ({}))

      if (!statusRes.ok) {
        setError(statusPayload.error || 'Sign in to continue to checkout')
        setLoading(false)
        return
      }

      if (!statusPayload.verified) {
        setCheckoutEmail(statusPayload.email || null)
        setEmailVerified(false)
        setLoading(false)
        return
      }

      setEmailVerified(true)
      await startStripeCheckout()
    }

    void init()
  }, [plan, isRegister, router, startStripeCheckout])

  const cancelHref = isRegister
    ? '/onboarding/subscription?register=1'
    : '/settings/billing?canceled=1'

  const showVerifyGate = checkoutEmail && !emailVerified && !clientSecret

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="border-b border-border safe-top px-4 py-4 max-w-lg mx-auto w-full">
        <BrandLogo href="/" size="sm" />
        <h1 className="text-xl font-bold text-white mt-4">Card payment</h1>
        {planInfo && (
          <p className="text-sm text-muted mt-1">
            {planInfo.name}
            {planInfo.price > 0
              ? ` — $${planInfo.price}/month`
              : ' — 7-day trial (card required, no charge today)'}
          </p>
        )}
      </header>

      <main className="flex-1 safe-x px-4 py-6 max-w-lg mx-auto w-full pb-8 space-y-4">
        {loading && !showVerifyGate && (
          <p className="text-sm text-muted-dim text-center py-12">
            Preparing secure checkout…
          </p>
        )}

        {showVerifyGate && (
          <VerifyEmailBeforeCheckout
            email={checkoutEmail}
            onVerified={() => {
              setEmailVerified(true)
              setLoading(true)
              void startStripeCheckout()
            }}
          />
        )}

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
              {error}
            </p>
            <Link
              href={cancelHref}
              className="block text-center text-sm text-brand-bright font-medium min-h-[44px]"
            >
              Go back
            </Link>
          </div>
        )}

        {clientSecret && publishableKey && (
          <StripeEmbeddedCheckout
            clientSecret={clientSecret}
            publishableKey={publishableKey}
          />
        )}

        {!loading && !error && !showVerifyGate && clientSecret && (
          <Link
            href={cancelHref}
            className="block text-center text-sm text-muted-dim py-2 min-h-[44px]"
          >
            Cancel
          </Link>
        )}
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <p className="text-muted">Loading checkout…</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
