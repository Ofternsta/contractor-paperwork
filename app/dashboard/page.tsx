'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { AppNav } from '@/components/app-nav'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type Analytics = {
  organization: string
  projectCount: number
  claimCount: number
  evidenceCount: number
  claimsByStatus: Record<string, number>
  evidenceByType: Record<string, number>
  approvedWorkers: number
  pendingWorkers: number
  subscription: { plan: string; status: string }
  recentProjects: Array<{
    id: string
    customer_name: string
    project_address: string
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [stats, setStats] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    loadUserAccess().then(({ access: a }) => {
      setAccess(a)
      if (a && !a.canViewAnalytics) {
        router.replace('/')
      }
    })
  }, [router])

  useEffect(() => {
    if (!access?.canViewAnalytics) return
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setStats(data)
      })
  }, [access])

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
        title="Dashboard"
        subtitle={`${access.organizationName || 'Organization'} — analytics`}
        backHref="/"
        backLabel="Projects"
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-3xl mx-auto w-full pb-8 safe-bottom space-y-6">
        <AppNav access={access} />

        {error && (
          <p className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-xl">
            {error}
            {error.includes('relation') && (
              <span className="block mt-2">
                Run <code className="text-xs">supabase/platform-security.sql</code> in
                Supabase SQL Editor.
              </span>
            )}
          </p>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Projects', value: stats.projectCount },
                { label: 'Claims', value: stats.claimCount },
                { label: 'Evidence', value: stats.evidenceCount },
                { label: 'Workers', value: stats.approvedWorkers },
              ].map((card) => (
                <div
                  key={card.label}
                  className="border rounded-xl p-4 bg-white shadow-sm text-center"
                >
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            <section className="border rounded-xl p-4 bg-gray-50">
              <h2 className="font-bold mb-2">Subscription</h2>
              <p className="text-sm capitalize">
                {stats.subscription.plan} — {stats.subscription.status}
              </p>
              {stats.pendingWorkers > 0 && (
                <p className="text-sm text-amber-800 mt-2">
                  {stats.pendingWorkers} worker(s) awaiting approval
                </p>
              )}
              <Link
                href="/settings/billing"
                className="inline-block mt-3 text-sm text-blue-700 font-medium"
              >
                Manage billing →
              </Link>
            </section>

            <section className="border rounded-xl p-4">
              <h2 className="font-bold mb-3">Claims by status</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(stats.claimsByStatus).map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span>{status}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border rounded-xl p-4">
              <h2 className="font-bold mb-3">Evidence by type</h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(stats.evidenceByType).map(([type, count]) => (
                  <li key={type} className="flex justify-between">
                    <span>{type}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-bold mb-3">Recent projects</h2>
              <ul className="space-y-2">
                {stats.recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/project/${p.id}`}
                      className="block border rounded-xl p-3 active:bg-gray-50"
                    >
                      <p className="font-medium">{p.customer_name}</p>
                      <p className="text-sm text-gray-600">{p.project_address}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
