import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Contractor Paperwork Assistant',
    short_name: 'Paperwork',
    description: 'Manage restoration projects, claims, and evidence in the field',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#171717',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
