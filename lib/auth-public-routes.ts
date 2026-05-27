/** Routes reachable without a Supabase session (admin signup → verify → pay). */
export function isPublicSignupCheckoutPath(pathname: string): boolean {
  return (
    pathname === '/checkout' ||
    pathname.startsWith('/onboarding/subscription')
  )
}
