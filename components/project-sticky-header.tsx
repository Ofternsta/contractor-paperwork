import Link from 'next/link'

type ProjectStickyHeaderProps = {
  title: string
  location: string
  backHref?: string
  backLabel?: string
}

export function ProjectStickyHeader({
  title,
  location,
  backHref = '/projects',
  backLabel = 'Projects',
}: ProjectStickyHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border safe-top">
      <div className="px-4 py-3 max-w-5xl mx-auto w-full">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-brand-bright font-medium mb-2 min-h-[40px]"
          >
            ← {backLabel}
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-bold leading-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted mt-1 leading-snug">{location}</p>
      </div>
    </header>
  )
}
