import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { SupportLink } from '@/components/support-link'
import {
  PLAN_ENTITLEMENTS,
  PLAN_FEATURE_COPY,
  formatPlanLimit,
} from '@/lib/plan-entitlements'
import { BILLING_PLANS } from '@/lib/stripe-config'

const FEATURES = [
  {
    title: 'Job workflow',
    description:
      'Track each project through stages you define — from first visit through completion — so office and field stay on the same page.',
  },
  {
    title: 'Field documentation',
    description:
      'Capture photos, PDFs, and video on site. AI helps categorize and summarize uploads so nothing lives in random camera rolls.',
  },
  {
    title: 'Client alignment',
    description:
      'Share selected files with clients, keep job status visible, and export professional packets when it is time to close the loop.',
  },
  {
    title: 'Crew coordination',
    description:
      'Give workers project access, team chat, calendar events, and permissions — so you see what happened on the job when it happened.',
  },
]

const STEPS = [
  {
    step: '1',
    title: 'Create your company',
    body: 'Sign up as an admin, pick a plan, and verify your email.',
  },
  {
    step: '2',
    title: 'Open a project',
    body: 'Add the customer, job address, and job record — every upload and update ties to that work.',
  },
  {
    step: '3',
    title: 'Run it with your team',
    body: 'Workers document and update status in the field; share files with clients; export when the job is ready.',
  },
]

export function MarketingHome() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo href="/" size="sm" showWordmark />
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-brand-bright transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-brand-bright transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-brand-bright transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted px-3 py-2 min-h-[44px] inline-flex items-center hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/login?signup=admin"
              className="text-sm font-semibold btn-primary px-4 py-2.5 min-h-[44px]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -20%, var(--brand-glow), transparent), radial-gradient(ellipse 50% 40% at 80% 50%, rgba(34,197,94,0.08), transparent)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-28">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-12 xl:gap-16">
              <div className="flex-1 text-center lg:text-left">
                <p className="text-sm font-semibold text-brand-bright mb-4">
                  Built for contractors in the field
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl">
                  <span className="block text-2xl sm:text-3xl text-brand-bright mb-2">
                    LedgerStack
                  </span>
                  <span className="text-white">Your jobs, clients, and crew</span>
                  <span className="brand-gradient-text"> — in one stack.</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-muted leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Organize projects, capture work from the field, keep clients in the
                  loop on what you share, and give your workers a clear view of status
                  and documents as the job moves — without scattered folders or endless
                  text threads.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link
                    href="/login?signup=admin"
                    className="btn-primary px-8 py-4 text-lg min-h-[52px]"
                  >
                    Start free trial
                  </Link>
                  <Link
                    href="/login"
                    className="btn-secondary px-8 py-4 text-lg min-h-[52px]"
                  >
                    Sign in
                  </Link>
                </div>
                <p className="mt-6 text-sm text-muted-dim">
                  {BILLING_PLANS.trial.days}-day trial · Card required · Plans from $
                  {BILLING_PLANS.starter.price}/mo
                </p>
              </div>
              <div className="hidden lg:flex shrink-0 justify-center items-center order-2">
                <BrandLogo
                  href="/"
                  size="hero-xl"
                  priority
                  className="drop-shadow-[0_0_56px_var(--brand-glow)]"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20"
        >
          <h2 className="text-3xl font-bold tracking-tight">
            Everything on the job, organized
          </h2>
          <p className="mt-3 text-muted text-lg max-w-2xl">
            One system for the owner, the crew on site, and the clients you work
            with closely — usable on mobile where the work actually happens.
          </p>
          <ul className="mt-10 grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="card-elevated p-6 hover:border-brand-dim/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--info-surface)] border border-brand-dim/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
                </div>
                <h3 className="mt-4 font-bold text-lg text-white">{f.title}</h3>
                <p className="mt-2 text-muted leading-relaxed">{f.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="how-it-works"
          className="border-y border-border bg-surface scroll-mt-20"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <ol className="mt-10 grid md:grid-cols-3 gap-8">
              {STEPS.map((s) => (
                <li key={s.step}>
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-full btn-primary font-bold text-sm">
                    {s.step}
                  </span>
                  <h3 className="mt-4 font-bold text-lg">{s.title}</h3>
                  <p className="mt-2 text-muted leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="pricing"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20"
        >
          <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-3 text-muted text-lg max-w-2xl">
            Start with a 7-day trial (card required), then pick the plan that
            matches your crew size. Every tier keeps jobs, files, and team access
            in one place.
          </p>
          <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              [
                ['trial', BILLING_PLANS.trial],
                ['starter', BILLING_PLANS.starter],
                ['professional', BILLING_PLANS.professional],
                ['enterprise', BILLING_PLANS.enterprise],
              ] as const
            ).map(([id, plan]) => (
              <li
                key={id}
                className={`rounded-2xl p-5 flex flex-col border ${
                  id === 'professional'
                    ? 'border-brand ring-2 ring-brand/40 shadow-[0_0_24px_var(--brand-glow)] bg-surface-elevated'
                    : 'border-border bg-surface'
                }`}
              >
                {id === 'professional' && (
                  <span className="text-xs font-semibold text-[#052e16] bg-brand self-start px-2 py-0.5 rounded mb-2">
                    Popular
                  </span>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {plan.price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      ${plan.price}
                      <span className="text-base font-normal text-muted">/mo</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted mt-1">{PLAN_ENTITLEMENTS[id].tagline}</p>
                <p className="mt-3 text-sm text-muted">
                  {id === 'trial'
                    ? `${plan.days}-day trial · ${formatPlanLimit(PLAN_ENTITLEMENTS[id].maxActiveProjects, 'projects')}`
                    : formatPlanLimit(
                        PLAN_ENTITLEMENTS[id].maxActiveProjects,
                        'projects'
                      )}
                </p>
                <ul className="mt-3 text-xs text-muted space-y-1 flex-1">
                  {PLAN_FEATURE_COPY[id].includes
                    .slice(0, id === 'professional' ? 5 : 4)
                    .map((line) => (
                      <li key={line} className="text-brand-bright/90">
                        ✓ {line}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Link
              href="/login?signup=admin"
              className="btn-primary px-8 py-4 min-h-[52px] text-lg"
            >
              Create company account
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <BrandLogo
              href="/"
              variant="icon"
              size="cta"
              className="mx-auto mb-6"
              priority={false}
            />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to stack your paperwork?
            </h2>
            <p className="mt-4 text-muted text-lg max-w-xl mx-auto">
              Join contractors who keep jobs, photos, and status aligned with their
              crew and clients.
            </p>
            <Link
              href="/login?signup=admin"
              className="mt-8 inline-flex btn-primary px-8 py-4 min-h-[52px] text-lg"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <BrandLogo href="/" size="sm" showWordmark />
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6">
            <SupportLink className="hover:text-brand-bright" />
            <Link href="/how-to" className="hover:text-brand-bright">
              How-to
            </Link>
            <Link href="/privacy" className="hover:text-brand-bright">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-brand-bright">
              Terms
            </Link>
            <Link href="/login" className="hover:text-brand-bright">
              Sign in
            </Link>
            <Link href="/login?signup=admin" className="hover:text-brand-bright">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
