import Image from 'next/image'
import Link from 'next/link'

type BrandLogoProps = {
  href?: string
  size?: 'sm' | 'md' | 'lg' | 'hero'
  showWordmark?: boolean
  className?: string
}

const heights = { sm: 32, md: 40, lg: 56, hero: 120 } as const

export function BrandLogo({
  href = '/',
  size = 'md',
  showWordmark = false,
  className = '',
}: BrandLogoProps) {
  const h = heights[size]
  const img = (
    <Image
      src="/logo.png"
      alt="LedgerStack"
      width={Math.round(h * 1.1)}
      height={h}
      className={`object-contain ${className}`}
      priority={size === 'hero' || size === 'lg'}
    />
  )

  if (!href) {
    return showWordmark ? (
      <div className="flex flex-col items-center gap-2">{img}</div>
    ) : (
      img
    )
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 shrink-0 ${className}`}
    >
      {img}
      {showWordmark && (
        <span className="font-bold text-lg tracking-tight">
          <span className="text-white">Ledger</span>
          <span className="brand-gradient-text">Stack</span>
        </span>
      )}
    </Link>
  )
}
