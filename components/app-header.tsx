import Link from 'next/link'

type AppHeaderProps = {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 safe-top">
      <div className="px-4 py-3 max-w-5xl mx-auto">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-blue-700 font-medium mb-2 min-h-[44px]"
          >
            ← {backLabel}
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
    </header>
  )
}
