'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminTeamPanel } from '@/components/admin-team-panel'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { AppNav } from '@/components/app-nav'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export default function TeamPage() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    loadUserAccess().then(({ access: a }) => {
      if (!a?.canManageTeam) {
        router.replace('/projects')
        return
      }
      setAccess(a)
      setLoading(false)
    })
  }, [router])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setSigningOut(false)
  }

  if (loading || !access) {
    return (
      <div className="min-h-dvh flex items-center justify-center safe-x">
        <p className="text-muted">Loading team…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title="Team"
        subtitle={access.organizationName || 'Manage workers and permissions'}
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-lg mx-auto w-full pb-8 safe-bottom space-y-4">
        <AppNav access={access} />
        <AdminTeamPanel />
      </main>

      <AppFooter />
    </div>
  )
}
