'use client'

import Link from 'next/link'

type PlanUpgradeBannerProps = {
  message: string
  showBillingLink?: boolean
}

export function PlanUpgradeBanner({
  message,
  showBillingLink = true,
}: PlanUpgradeBannerProps) {
  return (
    <div className="alert-warning text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <p className="leading-relaxed">{message}</p>
      {showBillingLink && (
        <Link
          href="/settings/billing"
          className="shrink-0 font-medium text-brand-bright underline min-h-[44px] inline-flex items-center"
        >
          View plans
        </Link>
      )}
    </div>
  )
}
