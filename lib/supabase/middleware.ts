import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicSignupCheckoutPath } from '@/lib/auth-public-routes'

/** Skip Supabase round-trip when the browser has no session cookies. */
function hasSupabaseSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth')
  )
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicApi =
    pathname.startsWith('/api/billing/webhook') ||
    pathname.startsWith('/api/auth/register-admin') ||
    pathname.startsWith('/api/auth/email-verification-status') ||
    pathname.startsWith('/api/auth/resend-verification') ||
    pathname.startsWith('/api/auth/trial-eligibility') ||
    pathname.startsWith('/api/auth/finish-signup')
  const isPublicOnboarding =
    pathname.startsWith('/onboarding/subscription')
  const isPublicSignupCheckout = isPublicSignupCheckoutPath(pathname)
  const isPublicMarketing = pathname === '/'

  const isPublicRoute =
    isAuthRoute ||
    isPublicApi ||
    isPublicOnboarding ||
    isPublicSignupCheckout ||
    isPublicMarketing

  if (!hasSupabaseSessionCookies(request)) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const emailConfirmed = Boolean(user?.email_confirmed_at)

  if (
    user &&
    !emailConfirmed &&
    !isAuthRoute &&
    !isPublicApi &&
    !isPublicOnboarding &&
    !isPublicSignupCheckout
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('verify', '1')
    if (user.email) url.searchParams.set('email', user.email)
    return NextResponse.redirect(url)
  }

  if (
    user &&
    emailConfirmed &&
    pathname === '/login' &&
    !request.nextUrl.searchParams.has('reset')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/projects'
    return NextResponse.redirect(url)
  }

  if (user && emailConfirmed && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/projects'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
