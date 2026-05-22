'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { AppNav } from '@/components/app-nav'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type PlanInfo = {
  name: string
  price: number
  projects: number
}

type BillingData = {
  plans: Record<string, PlanInfo>
  subscription: { plan: string; status: string }
  projectCount: number
  stripeConfigured: boolean
}

function BillingContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing')
      .then((r) => r.json())
      .then(setData)

    if (searchParams.get('success')) {
      setMessage('Subscription updated successfully.')
    }
    if (searchParams.get('canceled')) {
      setMessage('Checkout canceled.')
    }
  }, [searchParams])

  async function selectPlan(plan: string) {
    setLoading(plan)
    setMessage(null)
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const payload = await res.json().catch(() => ({}))
    if (payload.checkoutUrl) {
      window.location.href = payload.checkoutUrl
      return
    }
    if (!res.ok) {
      setMessage(payload.error || 'Could not update plan')
    } else {
      setMessage(`Plan set to ${plan}.`)
      const refreshed = await fetch('/api/billing').then((r) => r.json())
      setData(refreshed)
    }
    setLoading(null)
  }

  if (!data) {
    return <p className="text-gray-600">Loading billing…</p>
  }

  return (
    <>
      {message && (
        <p className="text-sm bg-green-50 border border-green-200 text-green-900 p-3 rounded-xl">
          {message}
        </p>
      )}

      <p className="text-sm text-gray-600">
        Current: <strong className="capitalize">{data.subscription.plan}</strong>{' '}
        ({data.subscription.status}) · {data.projectCount} project(s)
      </p>

      {!data.stripeConfigured && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-xl">
          Stripe is not configured. Plans update locally. Set STRIPE_SECRET_KEY and
          price IDs in production.
        </p>
      )}

      <div className="space-y-3">
        {Object.entries(data.plans).map(([key, plan]) => (
          <div
            key={key}
            className={`border rounded-xl p-4 ${
              data.subscription.plan === key
                ? 'border-black bg-gray-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-bold">{plan.name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {plan.price === 0
                    ? 'Free trial'
                    : `$${plan.price}/month`}
                  {plan.projects > 0
                    ? ` · up to ${plan.projects} projects`
                    : ' · unlimited projects'}
                </p>
              </div>
              {data.subscription.plan !== key && (
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => selectPlan(key)}
                  className="shrink-0 bg-black text-white text-sm px-4 py-2 rounded-lg min-h-[40px] disabled:opacity-50"
                >
                  {loading === key ? '…' : 'Select'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function BillingPage() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    loadUserAccess().then(({ access: a }) => {
      setAccess(a)
      if (a && !a.canManageBilling) router.replace('/')
    })
  }, [router])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setSigningOut(false)
  }

  if (!access) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title="Billing"
        subtitle="Subscription plans for your organization"
        backHref="/"
        backLabel="Projects"
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-lg mx-auto w-full pb-8 safe-bottom space-y-6">
        <AppNav access={access} />
        <Suspense fallback={<p className="text-gray-600">Loading billing…</p>}>
          <BillingContent />
        </Suspense>
      </main>
    </div>
  )
}
