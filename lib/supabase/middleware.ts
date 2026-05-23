import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicApi =
    pathname.startsWith('/api/billing/webhook') ||
    pathname.startsWith('/api/auth/register-admin') ||
    pathname.startsWith('/api/auth/trial-eligibility') ||
    pathname.startsWith('/api/auth/finish-signup')
  const isPublicOnboarding =
    pathname.startsWith('/onboarding/subscription')

  if (!user && !isAuthRoute && !isPublicApi && !isPublicOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const emailConfirmed = Boolean(user?.email_confirmed_at)

  if (user && !emailConfirmed && !isAuthRoute && !isPublicApi && !isPublicOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('verify', '1')
    if (user.email) url.searchParams.set('email', user.email)
    return NextResponse.redirect(url)
  }

  if (user && emailConfirmed && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
