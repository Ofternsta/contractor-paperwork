import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Skip /api — unauthenticated calls (signup, webhooks, finish-signup) must not
     * be redirected to /login HTML (breaks JSON and returns 405 on POST).
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
