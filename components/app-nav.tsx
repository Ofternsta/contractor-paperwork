'use client'

import Link from 'next/link'
import type { UserAccess } from '@/lib/roles'

type AppNavProps = {
  access: UserAccess
}

export function AppNav({ access }: AppNavProps) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      <Link
        href="/"
        className="px-3 py-2 rounded-lg bg-gray-100 font-medium min-h-[40px] inline-flex items-center"
      >
        Projects
      </Link>
      {access.canViewAnalytics && (
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded-lg bg-gray-100 font-medium min-h-[40px] inline-flex items-center"
        >
          Analytics
        </Link>
      )}
      {access.canManageBilling && (
        <Link
          href="/settings/billing"
          className="px-3 py-2 rounded-lg bg-gray-100 font-medium min-h-[40px] inline-flex items-center"
        >
          Billing
        </Link>
      )}
    </nav>
  )
}
