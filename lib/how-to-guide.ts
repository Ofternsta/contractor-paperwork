/** Content model for /how-to — drop PNGs into `public/how-to/` using each `filename`. */

export type HowToScreenshot = {
  /** Save as `public/how-to/{filename}` */
  filename: string
  /** Short label under the placeholder */
  caption: string
  /** Where to go before capturing */
  route?: string
  /** What to include in the frame */
  capture: string
}

export type HowToSection = {
  id: string
  title: string
  intro?: string
  /** e.g. "Professional plan or higher" */
  planNote?: string
  bullets?: string[]
  screenshots: HowToScreenshot[]
}

export type HowToPart = {
  id: string
  title: string
  /** admin | worker | client | all */
  audience?: string
  sections: HowToSection[]
}

export const HOW_TO_PARTS: HowToPart[] = [
  {
    id: 'public',
    title: 'Marketing & sign-up',
    audience: 'Public',
    sections: [
      {
        id: 'marketing-home',
        title: 'Marketing homepage',
        intro: 'Public landing page at ledgerstack.org.',
        screenshots: [
          {
            filename: '01-marketing-hero.png',
            caption: 'Hero — value proposition and primary CTAs',
            route: '/',
            capture: 'Top of homepage: logo, Sign in, Get started, hero headline.',
          },
          {
            filename: '02-marketing-features.png',
            caption: 'Features — job workflow, field docs, clients, crew',
            route: '/#features',
            capture: 'Scroll to “Everything on the job, organized” and feature cards.',
          },
          {
            filename: '03-marketing-how-it-works.png',
            caption: 'How it works — three steps',
            route: '/#how-it-works',
            capture: 'Numbered steps: company, project, team.',
          },
          {
            filename: '04-marketing-pricing.png',
            caption: 'Pricing — Trial, Starter, Professional, Enterprise',
            route: '/#pricing',
            capture: 'All four plan cards visible.',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Sign in & account types',
        intro: 'Same page for all roles; tab switches between Sign in and Sign up.',
        screenshots: [
          {
            filename: '05-login-sign-in.png',
            caption: 'Sign in — email and password',
            route: '/login',
            capture: 'Sign in tab active, empty or filled form.',
          },
          {
            filename: '06-signup-admin.png',
            caption: 'Sign up — Admin (company owner)',
            route: '/login?signup=admin',
            capture: 'Sign up tab, Admin selected, name/company fields visible.',
          },
          {
            filename: '07-signup-worker.png',
            caption: 'Sign up — Worker (company code)',
            route: '/login',
            capture: 'Sign up tab, Worker selected, 8-character invite code field.',
          },
          {
            filename: '08-signup-client.png',
            caption: 'Sign up — Client (view-only)',
            route: '/login',
            capture: 'Sign up tab, Client selected, explanation about admin-granted access.',
          },
          {
            filename: '09-login-forgot-password.png',
            caption: 'Forgot password',
            route: '/login',
            capture: 'Forgot password link or reset-email sent state.',
          },
          {
            filename: '10-login-mfa.png',
            caption: 'Two-factor authentication (optional)',
            route: '/login?mfa=1',
            capture: 'MFA code entry step if 2FA is enabled on a test account.',
          },
        ],
        bullets: [
          'After admin signup: plan picker → Stripe checkout → email verification as configured.',
          'Workers stay pending until an admin approves them on the Team page.',
          'Clients only see projects after an admin grants access by email.',
        ],
      },
      {
        id: 'onboarding-billing',
        title: 'Onboarding & checkout',
        audience: 'Admin',
        screenshots: [
          {
            filename: '11-onboarding-plans.png',
            caption: 'Choose subscription plan',
            route: '/onboarding/subscription',
            capture: 'Plan picker during signup or renewal.',
          },
          {
            filename: '12-checkout-stripe.png',
            caption: 'Stripe checkout (trial or paid)',
            route: '/checkout',
            capture: 'Embedded Stripe checkout or trial card verification.',
          },
          {
            filename: '13-email-verified.png',
            caption: 'Email verified — continue to checkout',
            route: '/onboarding/email-verified',
            capture: 'Post-verification continue screen if email confirmation is on.',
          },
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & security',
    audience: 'All signed-in users',
    sections: [
      {
        id: 'account-settings',
        title: 'Account settings',
        screenshots: [
          {
            filename: '14-settings-account-profile.png',
            caption: 'Profile — display name and email',
            route: '/settings/account',
            capture: 'Profile section at top of account settings.',
          },
          {
            filename: '15-settings-account-security.png',
            caption: 'Security — password reset email',
            route: '/settings/account',
            capture: 'Password / security section.',
          },
          {
            filename: '16-settings-account-2fa.png',
            caption: 'Two-factor authentication (TOTP)',
            route: '/settings/account',
            capture: '2FA enroll QR or “enabled” state.',
          },
          {
            filename: '17-settings-account-appearance.png',
            caption: 'Appearance — dark, light, system',
            route: '/settings/account',
            capture: 'Theme selector.',
          },
          {
            filename: '18-settings-account-data.png',
            caption: 'Data & account — retention notice, sign out everywhere',
            route: '/settings/account',
            capture: 'Data retention summary and logout-all control.',
          },
        ],
      },
      {
        id: 'nav',
        title: 'Main navigation',
        intro: 'Nav items depend on role and plan (Team, Calendar, Analytics require Professional+).',
        screenshots: [
          {
            filename: '19-nav-admin.png',
            caption: 'Admin navigation — full menu',
            route: '/projects',
            capture: 'Top nav: Projects, Team, Calendar, Analytics, Settings, Organization, Backups, Billing.',
          },
          {
            filename: '20-nav-worker.png',
            caption: 'Worker navigation',
            route: '/projects',
            capture: 'Signed in as approved worker — limited nav pills.',
          },
          {
            filename: '21-nav-client.png',
            caption: 'Client navigation',
            route: '/projects',
            capture: 'Signed in as client — Projects and Settings only.',
          },
          {
            filename: '22-messaging-launcher.png',
            caption: 'Team messaging launcher (FAB)',
            route: '/projects',
            capture: 'Floating message button and open conversation list (Professional+).',
          },
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    audience: 'Admin (create/delete); all roles view assigned/shared',
    sections: [
      {
        id: 'projects-list',
        title: 'Projects list',
        screenshots: [
          {
            filename: '23-projects-list-admin.png',
            caption: 'All organization projects',
            route: '/projects',
            capture: 'Project cards, create form, sign out.',
          },
          {
            filename: '24-projects-create.png',
            caption: 'Create project',
            route: '/projects',
            capture: 'New project form: customer name, address, notes.',
          },
          {
            filename: '25-projects-plan-limit.png',
            caption: 'Plan limit / upgrade banner',
            route: '/projects',
            capture: 'Upgrade banner when at max active projects (if testable).',
          },
          {
            filename: '26-projects-client-shared.png',
            caption: 'Client view — Shared with you',
            route: '/projects',
            capture: 'Client account: only projects they were granted.',
          },
          {
            filename: '27-projects-worker-pending.png',
            caption: 'Worker — awaiting approval',
            route: '/projects',
            capture: 'New worker before admin approves on Team page.',
          },
        ],
        bullets: [
          'Creating a project auto-creates one job with your default workflow stages.',
          'Completed and inactive projects are subject to organization retention (7 days / 12 months).',
        ],
      },
    ],
  },
  {
    id: 'project-detail',
    title: 'Project detail',
    audience: 'Admin, worker (permissions), client (read-only shared files)',
    sections: [
      {
        id: 'jobs',
        title: 'Jobs sidebar & status workflow',
        screenshots: [
          {
            filename: '28-project-jobs-sidebar.png',
            caption: 'Jobs list — name, status, notes',
            route: '/project/[id]',
            capture: 'Left sidebar with multiple jobs; one selected.',
          },
          {
            filename: '29-project-job-status.png',
            caption: 'Job status workflow stages',
            route: '/project/[id]',
            capture: 'Status strip or controls (Inspection → … → Completed).',
          },
          {
            filename: '30-project-job-completed-confirm.png',
            caption: 'Mark job Completed — retention warning',
            route: '/project/[id]',
            capture: 'Confirmation dialog before final stage.',
          },
        ],
        bullets: [
          'Default stages: Inspection, Documentation, Estimate Sent, Approved, In Progress, Completed.',
          'Stages are customizable per project under Organization → Projects.',
          'Only admins can advance job status; workers and clients see read-only status.',
        ],
      },
      {
        id: 'ai-export',
        title: 'Job intelligence, AI & exports',
        planNote: 'AI quotas vary by plan; watermarked exports on Trial.',
        screenshots: [
          {
            filename: '31-project-ai-summary.png',
            caption: 'AI job summary',
            route: '/project/[id]',
            capture: 'Job intelligence panel with generated summary.',
          },
          {
            filename: '32-project-ai-timeline.png',
            caption: 'AI timeline & status history',
            route: '/project/[id]',
            capture: 'Timeline view or refresh/regenerate controls.',
          },
          {
            filename: '33-project-export.png',
            caption: 'Export job packet (PDF or HTML)',
            route: '/project/[id]',
            capture: 'Export button and format options.',
          },
          {
            filename: '34-project-ai-usage.png',
            caption: 'AI usage indicator on project',
            route: '/project/[id]',
            capture: 'Monthly AI summaries used vs limit.',
          },
        ],
        bullets: [
          'Uploads can be auto-categorized and summarized by AI.',
          'Evidence detail: manual re-scan, edit summary, move category (admin).',
        ],
      },
      {
        id: 'documents',
        title: 'Documents & uploads',
        screenshots: [
          {
            filename: '35-project-upload.png',
            caption: 'Upload — drag-drop, browse, camera',
            route: '/project/[id]',
            capture: 'Upload area and file picker.',
          },
          {
            filename: '36-project-evidence-folders.png',
            caption: 'Files by category folder',
            route: '/project/[id]',
            capture: 'Category folders with file cards and search.',
          },
          {
            filename: '37-project-evidence-detail.png',
            caption: 'File expanded — summary, category, share flags',
            route: '/project/[id]',
            capture: 'Expanded evidence card; category dropdown in detail view (admin).',
          },
          {
            filename: '38-project-evidence-client-view.png',
            caption: 'Client view — shared files only',
            route: '/project/[id]',
            capture: 'Client sees subset admin selected; no upload/AI.',
          },
        ],
        bullets: [
          'Trial: images and PDF only, smaller size cap. Starter+: video allowed.',
          'Files open via signed URLs (private storage).',
        ],
      },
      {
        id: 'schedule-notes-messages',
        title: 'Schedule, notes & messages',
        planNote: 'Professional plan or higher',
        screenshots: [
          {
            filename: '39-project-schedule.png',
            caption: 'Project schedule — events & assignments',
            route: '/project/[id]',
            capture: 'Schedule panel with create/edit event.',
          },
          {
            filename: '40-project-messages.png',
            caption: 'Project messages (job-scoped chat)',
            route: '/project/[id]',
            capture: 'Message thread on project page.',
          },
          {
            filename: '41-project-internal-notes.png',
            caption: 'Internal notes — staff only, @mentions',
            route: '/project/[id]',
            capture: 'Notes list and compose area.',
          },
          {
            filename: '42-messaging-dm-thread.png',
            caption: 'Direct / group message thread',
            route: '/projects',
            capture: 'Launcher open with active DM or group chat.',
          },
        ],
      },
      {
        id: 'archive',
        title: 'Project archive & download',
        screenshots: [
          {
            filename: '43-project-archive.png',
            caption: 'Archive panel — ZIP download, save to folder',
            route: '/project/[id]',
            capture: 'Archive/download UI when jobs are complete or ready to export.',
          },
        ],
      },
    ],
  },
  {
    id: 'team',
    title: 'Team & workers',
    audience: 'Admin',
    planNote: 'Professional plan or higher',
    sections: [
      {
        id: 'team-page',
        title: 'Team page',
        screenshots: [
          {
            filename: '44-team-invite-code.png',
            caption: 'Worker invite code — copy / regenerate',
            route: '/team',
            capture: '8-character company code visible.',
          },
          {
            filename: '45-team-pending-approvals.png',
            caption: 'Pending worker requests',
            route: '/team',
            capture: 'Approve / deny list.',
          },
          {
            filename: '46-team-roster.png',
            caption: 'Approved workers — titles & promote to admin',
            route: '/team',
            capture: 'Worker roster with role controls.',
          },
        ],
      },
    ],
  },
  {
    id: 'calendar-analytics',
    title: 'Calendar & analytics',
    planNote: 'Professional+ (Enterprise adds advanced analytics)',
    sections: [
      {
        id: 'calendar',
        title: 'Organization calendar',
        audience: 'Admin & workers (if permitted)',
        screenshots: [
          {
            filename: '47-calendar.png',
            caption: 'Calendar — next two months of events',
            route: '/calendar',
            capture: 'Month grid with events linking to projects.',
          },
        ],
      },
      {
        id: 'dashboard',
        title: 'Analytics dashboard',
        audience: 'Admin',
        screenshots: [
          {
            filename: '48-dashboard-overview.png',
            caption: 'Dashboard — counts and subscription summary',
            route: '/dashboard',
            capture: 'Projects, jobs, documents, workers metrics.',
          },
          {
            filename: '49-dashboard-charts.png',
            caption: 'Jobs by status & documents by type',
            route: '/dashboard',
            capture: 'Charts and recent projects list.',
          },
        ],
      },
    ],
  },
  {
    id: 'organization',
    title: 'Organization settings',
    audience: 'Admin',
    sections: [
      {
        id: 'org-global',
        title: 'Organization-wide',
        screenshots: [
          {
            filename: '50-org-retention.png',
            caption: 'Data retention & legal notices',
            route: '/settings/organization',
            capture: '7-day completed / 12-month inactive policy, backup limits.',
          },
          {
            filename: '51-org-worker-defaults.png',
            caption: 'Default worker permissions',
            route: '/settings/organization',
            capture: 'Org-wide defaults: upload, delete, calendar, view files.',
          },
        ],
      },
      {
        id: 'org-per-project',
        title: 'Per-project settings (expand a project)',
        screenshots: [
          {
            filename: '52-org-project-rename.png',
            caption: 'Rename project — name & address',
            route: '/settings/organization',
            capture: 'Expanded project header edit fields.',
          },
          {
            filename: '53-org-job-stages.png',
            caption: 'Custom job status stages',
            route: '/settings/organization',
            capture: 'Stage editor; Completed locked last.',
          },
          {
            filename: '54-org-file-categories.png',
            caption: 'File category labels',
            route: '/settings/organization',
            capture: 'Category list used for folders and AI sorting.',
          },
          {
            filename: '55-org-client-access.png',
            caption: 'Client access — grant by email',
            route: '/settings/organization',
            capture: 'Client list with grant/revoke.',
          },
          {
            filename: '56-org-client-shared-files.png',
            caption: 'Per-client shared files by category',
            route: '/settings/organization',
            capture: 'Expanded client — checkboxes for visible files.',
          },
          {
            filename: '57-org-project-workers.png',
            caption: 'Project workers & permissions',
            route: '/settings/organization',
            capture: 'Assign workers; per-project permission checkboxes.',
          },
        ],
      },
    ],
  },
  {
    id: 'backups-billing',
    title: 'Backups & billing',
    audience: 'Admin',
    sections: [
      {
        id: 'backups',
        title: 'Cloud backups',
        planNote: 'Starter+ (retention count varies by plan)',
        screenshots: [
          {
            filename: '58-backups-settings.png',
            caption: 'Backup schedule & run now',
            route: '/settings/backups',
            capture: 'Enable, daily/weekly, backup on job completed.',
          },
          {
            filename: '59-backups-list.png',
            caption: 'Backup history — download / delete',
            route: '/settings/backups',
            capture: 'List of ZIP backups within plan retention.',
          },
        ],
      },
      {
        id: 'billing',
        title: 'Billing & plans',
        screenshots: [
          {
            filename: '60-billing-current-plan.png',
            caption: 'Current plan & Stripe customer portal',
            route: '/settings/billing',
            capture: 'Active subscription and manage billing button.',
          },
          {
            filename: '61-billing-change-plan.png',
            caption: 'Change plan flow',
            route: '/settings/billing',
            capture: 'Upgrade/downgrade entry to checkout if available.',
          },
        ],
      },
    ],
  },
  {
    id: 'plans-mobile-legal',
    title: 'Plans, mobile & legal',
    sections: [
      {
        id: 'plans-matrix',
        title: 'Plan capabilities (reference)',
        intro: 'Use marketing pricing screenshot or this table when documenting tiers.',
        bullets: [
          'Trial: 2 projects, 10 AI/mo, watermarked export preview, no workers/clients/calendar/chat.',
          'Starter ($20): 25 projects, standard PDF export, backups (5), solo user.',
          'Professional ($70): workers, client portal, calendar, notes, messages, branded exports, analytics, backups (15).',
          'Enterprise ($150): unlimited staff/projects/AI, advanced analytics, backups (30), white-label exports.',
        ],
        screenshots: [
          {
            filename: '62-plans-comparison.png',
            caption: 'Optional — side-by-side plan comparison',
            route: '/#pricing',
            capture: 'Or a spreadsheet-style graphic you create for the guide.',
          },
        ],
      },
      {
        id: 'mobile',
        title: 'Mobile app',
        bullets: [
          'Install as PWA or native Capacitor build (Android/iOS).',
          'On native: Take Photo uses device camera for field uploads.',
        ],
        screenshots: [
          {
            filename: '63-mobile-upload-camera.png',
            caption: 'Mobile — camera capture on upload (optional)',
            route: '/project/[id]',
            capture: 'Phone screenshot of upload with Take Photo.',
          },
        ],
      },
      {
        id: 'legal',
        title: 'Legal & policies',
        screenshots: [
          {
            filename: '64-legal-privacy.png',
            caption: 'Privacy Policy page',
            route: '/privacy',
            capture: 'Top of privacy document.',
          },
          {
            filename: '65-legal-terms.png',
            caption: 'Terms of Service page',
            route: '/terms',
            capture: 'Top of terms document.',
          },
        ],
      },
    ],
  },
]

/** Flat list for the screenshot checklist */
export function allHowToScreenshots(): HowToScreenshot[] {
  return HOW_TO_PARTS.flatMap((part) =>
    part.sections.flatMap((section) => section.screenshots)
  )
}
