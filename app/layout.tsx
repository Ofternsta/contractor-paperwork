import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/** Bump when replacing favicon art so browsers drop cached tab icons. */
const FAVICON_VERSION = '2'

export const metadata: Metadata = {
  title: 'LedgerStack',
  description: 'Manage restoration projects, claims, and evidence in the field',
  applicationName: 'LedgerStack',
  icons: {
    icon: [
      {
        url: `/icon.png?v=${FAVICON_VERSION}`,
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    apple: [
      {
        url: `/apple-icon.png?v=${FAVICON_VERSION}`,
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LedgerStack',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const iconHref = `/icon.png?v=${FAVICON_VERSION}`

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href={iconHref} type="image/png" sizes="512x512" />
        <link rel="shortcut icon" href={iconHref} type="image/png" />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
