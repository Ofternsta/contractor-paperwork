import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { SupportLink } from '@/components/support-link'
import {
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR_NAME,
  LEGAL_PRODUCT_NAME,
} from '@/lib/legal-meta'

export function LegalDocumentLayout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="border-b border-border safe-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo href="/" size="sm" showWordmark />
          <Link
            href="/login"
            className="text-sm font-medium text-brand-bright hover:underline min-h-[44px] inline-flex items-center"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 safe-bottom">
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-muted mb-8">
          {LEGAL_PRODUCT_NAME} · Operated by {LEGAL_OPERATOR_NAME} · Last updated{' '}
          {LEGAL_LAST_UPDATED}
        </p>

        <article className="legal-prose space-y-6 text-sm text-muted leading-relaxed">
          {children}
        </article>

        <p className="mt-10 text-sm text-muted">
          Questions? <SupportLink className="text-brand-bright hover:underline" />
        </p>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        <Link href="/how-to" className="hover:text-brand-bright px-2">
          How-to guide
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-brand-bright px-2">
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-brand-bright px-2">
          Terms of Service
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="hover:text-brand-bright px-2">
          Home
        </Link>
      </footer>
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
