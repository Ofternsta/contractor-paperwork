import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LedgerStack',
    short_name: 'LedgerStack',
    description: 'Manage restoration projects, claims, and evidence in the field',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050505',
    theme_color: '#050505',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon.png?v=2',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png?v=2',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
