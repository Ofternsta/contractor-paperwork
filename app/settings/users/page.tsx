'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { AppNav } from '@/components/app-nav'
import { loadUserAccess } from '@/lib/load-access'
import type { UserAccess } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type PlatformUser = {
  id: string
  email: string
  role: string
  full_name: string | null
  created_at: string
  is_platform_owner: boolean
}

export default function PlatformUsersPage() {
  const router = useRouter()
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    loadUserAccess().then(({ access: a }) => setAccess(a))

    async function load() {
      const checkRes = await fetch('/api/platform/check')
      const check = await checkRes.json().catch(() => ({}))

      if (!check.owner) {
        setAllowed(false)
        router.replace('/projects')
        return
      }

      setAllowed(true)

      const listRes = await fetch('/api/platform/users')
      const list = await listRes.json().catch(() => ({}))

      if (!listRes.ok) {
        setError(list.error || 'Could not load accounts')
        return
      }

      setUsers(list.users || [])
    }

    load().catch(() => setError('Could not load accounts'))
  }, [router])

  async function removeUser(target: PlatformUser) {
    const label = target.email || target.id
    const ok = window.confirm(
      `Permanently delete account "${label}"?\n\nThis removes their login, profile, team membership, and (if admin) their company data. This cannot be undone.`
    )
    if (!ok) return

    setDeletingId(target.id)
    setError(null)

    const res = await fetch('/api/platform/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: target.id }),
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(payload.error || 'Delete failed')
      setDeletingId(null)
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== target.id))
    setDeletingId(null)
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setSigningOut(false)
  }

  if (!access || allowed === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (allowed === false) return null

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title="Account management"
        subtitle="Platform owner — delete signed-up users"
        backHref="/projects"
        backLabel="Projects"
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-lg mx-auto w-full pb-8 safe-bottom space-y-4">
        <AppNav access={access} />

        <p className="text-sm alert-warning leading-relaxed">
          Only the email set in <code className="text-xs">PLATFORM_OWNER_EMAIL</code>{' '}
          can use this page. Deletions are permanent.
        </p>

        {error && (
          <p className="text-sm alert-error">
            {error}
          </p>
        )}

        {users.length === 0 && !error && (
          <p className="text-muted-dim text-center py-6">No accounts found.</p>
        )}

        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="border border-border rounded-xl p-4 bg-surface-elevated space-y-2"
            >
              <p className="font-medium">{u.email}</p>
              <p className="text-sm text-muted">
                {u.full_name || 'No name'} ·{' '}
                <span className="capitalize">{u.role}</span>
                {u.is_platform_owner && (
                  <span className="text-amber-700"> · platform owner</span>
                )}
              </p>
              <p className="text-xs text-muted-dim">
                Joined {new Date(u.created_at).toLocaleString()}
              </p>
              {!u.is_platform_owner && (
                <button
                  type="button"
                  disabled={deletingId === u.id}
                  onClick={() => removeUser(u)}
                  className="w-full border border-red-200 text-red-400 py-3 rounded-xl text-sm font-semibold min-h-[48px] disabled:opacity-50 active:bg-red-50"
                >
                  {deletingId === u.id ? 'Deleting…' : 'Delete account'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
