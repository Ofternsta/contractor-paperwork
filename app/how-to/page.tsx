import type { Metadata } from 'next'
import { HowToContent } from '@/components/how-to-content'
import { absoluteUrl, SITE_NAME } from '@/lib/site-seo'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: `Product guide — ${SITE_NAME}`,
  description: `Complete ${SITE_NAME} feature guide with screenshot placeholders for every area: projects, jobs, team, AI, billing, and more.`,
  alternates: { canonical: absoluteUrl('/how-to') },
  robots: { index: true, follow: true },
}

export default function HowToPage() {
  return <HowToContent />
}
