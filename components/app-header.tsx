import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'

type AppHeaderProps = {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  onSignOut?: () => void
  signingOut?: boolean
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  onSignOut,
  signingOut,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border safe-top">
      <div className="px-4 py-3 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center text-sm text-brand-bright font-medium mb-2 min-h-[44px]"
              >
                ← {backLabel}
              </Link>
            ) : (
              <div className="mb-2">
                <BrandLogo href="/projects" size="sm" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold leading-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted mt-1 leading-snug">{subtitle}</p>
            )}
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="shrink-0 text-sm text-muted font-medium min-h-[44px] px-2 hover:text-foreground disabled:opacity-50"
            >
              {signingOut ? '…' : 'Sign out'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
