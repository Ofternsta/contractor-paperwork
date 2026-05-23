'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserAccess } from '@/lib/roles'

type AppNavProps = {
  access: UserAccess
}

export function AppNav({ access }: AppNavProps) {
  const pathname = usePathname()
  const [platformOwner, setPlatformOwner] = useState(false)

  useEffect(() => {
    fetch('/api/platform/check')
      .then((r) => r.json())
      .then((data) => setPlatformOwner(Boolean(data.owner)))
      .catch(() => setPlatformOwner(false))
  }, [])

  function pill(href: string, label: string) {
    const active = pathname === href || pathname.startsWith(`${href}/`)
    return (
      <Link
        href={href}
        className={`nav-pill${active ? ' nav-pill-active' : ''}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {pill('/projects', 'Projects')}
      {access.canManageSchedule && pill('/calendar', 'Calendar')}
      {access.canViewAnalytics && pill('/dashboard', 'Analytics')}
      {access.canManageBilling && pill('/settings/billing', 'Billing')}
      {platformOwner && (
        <Link
          href="/settings/users"
          className="nav-pill border-red-900/50 text-red-300 hover:border-red-500/50"
        >
          Accounts
        </Link>
      )}
    </nav>
  )
}
