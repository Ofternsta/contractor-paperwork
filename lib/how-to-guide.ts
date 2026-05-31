/** Text content for /how-to */

export type GuideSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export type GuidePart = {
  id: string
  title: string
  intro?: string
  sections: GuideSection[]
}

export const GUIDE_PARTS: GuidePart[] = [
  {
    id: 'overview',
    title: 'What is LedgerStack?',
    intro:
      'LedgerStack helps field contractors organize projects, run jobs through a clear status workflow, capture photos and documents from the site, coordinate workers, and share selected files with clients — all in one place instead of scattered folders and text threads.',
    sections: [
      {
        id: 'concepts',
        title: 'Core concepts',
        bullets: [
          'Organization — your company; billing and settings apply to the whole org.',
          'Project — a customer job site (name, address, notes). Creating a project also creates one job.',
          'Job — the unit of work inside a project (name, current status, notes, timeline, files). The UI says “jobs”; the database still uses a legacy “claims” table.',
          'Documents — photos, PDFs, and videos stored in category folders (Site Photo, Estimate, etc.).',
          'Roles — Admin (owner), Worker (field crew), Client (view-only on what you share).',
        ],
      },
      {
        id: 'plans',
        title: 'Subscription plans',
        paragraphs: [
          'Every company picks a plan after admin signup. Limits on projects, staff, AI usage, and features depend on the tier.',
        ],
        bullets: [
          'Trial — 7 days, card required; 2 projects, 10 AI summaries/month, images/PDF only; no exports, workers, clients, calendar, or team chat.',
          'Starter ($20/mo) — solo contractor; 25 projects, standard PDF export, automatic backups (5 retained).',
          'Professional ($70/mo) — up to 15 workers, 100 projects, client portal, calendar, internal notes, project messages, DM/group chat, job packet exports, analytics, backups (15).',
          'Enterprise ($150/mo) — unlimited staff and projects, unlimited AI, advanced analytics, backups (30).',
        ],
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    sections: [
      {
        id: 'marketing',
        title: 'Marketing site',
        paragraphs: [
          'The public homepage explains the product, features, how it works in three steps, and pricing. Use Get started or Sign up to create a company account; Sign in returns existing users to the app.',
        ],
      },
      {
        id: 'signup-admin',
        title: 'Admin sign-up (company owner)',
        paragraphs: [
          'Choose Admin on the sign-up tab, enter your name and company, accept Terms and Privacy, then continue to the plan picker. You complete Stripe checkout (trial card or paid plan). Your Supabase auth user is created after payment via webhook or the finish-signup fallback on the login page.',
          'After checkout, sign in with the same email and password you chose at signup. If email confirmation is enabled, verify your inbox first.',
        ],
        bullets: [
          'Routes: /login?signup=admin → /onboarding/subscription → /checkout → /projects',
        ],
      },
      {
        id: 'signup-worker',
        title: 'Worker sign-up',
        paragraphs: [
          'Workers choose Worker, enter the 8-character company invite code from their admin (Team page), then sign up with email and password. They land on Projects in a pending state until an admin approves them on the Team page.',
          'After approval, workers only see projects they are assigned to, with permissions set org-wide and per project.',
        ],
      },
      {
        id: 'signup-client',
        title: 'Client sign-up',
        paragraphs: [
          'Clients choose Client and register with email. They do not use an invite code. An admin must grant access per project by client email in Organization settings. On login, the app links any matching grants automatically.',
          'Clients see a “Shared with you” project list and read-only job status plus only files the admin marked as shared for that client.',
        ],
      },
      {
        id: 'signin-security',
        title: 'Sign in, password reset & 2FA',
        bullets: [
          'Sign in — email and password on /login; optional MFA step if TOTP is enabled.',
          'Forgot password — request a reset email from the login page; set a new password at /login/reset-password from the link.',
          'Account settings (/settings/account) — update display name, request password reset, enroll or disable 2FA (authenticator app), choose dark/light/system theme, sign out everywhere.',
        ],
      },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation',
    sections: [
      {
        id: 'nav-items',
        title: 'Main menu (depends on role and plan)',
        bullets: [
          'Projects — everyone; default home after login.',
          'Team — admins on Professional+; invite code, approve workers, roster.',
          'Calendar — staff on Professional+; org-wide schedule (two-month view).',
          'Analytics — admins on Professional+; counts, charts, recent activity (Enterprise adds advanced analytics).',
          'Settings — profile and security for all roles.',
          'Organization — admins only; retention, defaults, per-project access and labels.',
          'Backups — admins on Starter+; automatic ZIP backups.',
          'Billing — admins; plan, Stripe customer portal.',
          'Accounts — platform owner only; delete user accounts.',
        ],
      },
      {
        id: 'messaging-fab',
        title: 'Team messaging (floating button)',
        paragraphs: [
          'On Professional+, approved staff see a message launcher (top right) on most app pages. It opens direct messages and group chats with your org roster, separate from job-scoped project messages on the project page.',
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    sections: [
      {
        id: 'projects-list',
        title: 'Projects list (/projects)',
        paragraphs: [
          'Admins see all organization projects, can create new ones (customer name, address, optional notes), and delete projects with confirmation. A plan banner appears when you hit the active project limit.',
          'Workers see only assigned projects. Clients see only shared projects.',
        ],
      },
      {
        id: 'retention',
        title: 'Data retention',
        bullets: [
          'When every job on a project reaches Completed, the project may be deleted after 7 days (shown in UI and legal notices).',
          'Projects with no activity for 12 months may also be removed.',
          'Automatic cloud backups (by plan) are separate from project deletion — download backups from Backups settings if you need long-term archives.',
        ],
      },
    ],
  },
  {
    id: 'project-detail',
    title: 'Inside a project',
    sections: [
      {
        id: 'jobs-sidebar',
        title: 'Jobs sidebar',
        paragraphs: [
          'The left column lists jobs for this project. Each row shows name, current status, and creation notes. Select a job to work on its timeline, files, and status controls.',
          'Admins advance jobs through customizable stages (default: Inspection → Documentation → Estimate Sent → Approved → In Progress → Completed). Completing a job triggers a confirmation that explains retention. Workers and clients see status but cannot change it.',
        ],
      },
      {
        id: 'ai-export',
        title: 'Job intelligence, AI & exports',
        paragraphs: [
          'The job intelligence panel (staff only, not clients) can generate an AI summary of the job, refresh an AI-built timeline, show status history, and export a PDF or HTML job packet. Exports start on Starter (PDF); full job packets and project archives are on Professional+.',
          'Monthly AI usage is capped by plan and shown on project pages. Uploads can be auto-categorized and summarized; admins can re-scan a file, edit its summary, or move it to another category from the expanded file detail view.',
        ],
      },
      {
        id: 'uploads',
        title: 'Uploading documents',
        bullets: [
          'Drag and drop, browse files, or use Take Photo (device camera on native mobile app).',
          'Files appear under category folders; search filters the list.',
          'Open files via short-lived signed URLs (private storage, not public links).',
          'Trial limits file types to images and PDF; Starter+ allows video within size limits per plan.',
        ],
      },
      {
        id: 'schedule',
        title: 'Schedule (Professional+)',
        paragraphs: [
          'Create calendar events on the project: inspections, deadlines, reminders, client follow-ups, assignments, and more. Assign a worker, set reminders, and mark events complete. The org Calendar page aggregates events across projects for the next two months.',
        ],
      },
      {
        id: 'messages-notes',
        title: 'Project messages & internal notes (Professional+)',
        paragraphs: [
          'Project messages are a job-scoped chat thread for the team on that project. Internal notes are staff-only: post updates or status notes, with @mentions for colleagues. Clients never see either.',
        ],
      },
      {
        id: 'archive',
        title: 'Archive & download',
        paragraphs: [
          'When jobs are finished, use the archive panel to download a ZIP of project materials or use browser “save to folder” where supported (Chrome/Edge).',
        ],
      },
    ],
  },
  {
    id: 'team',
    title: 'Team & workers',
    sections: [
      {
        id: 'team-page',
        title: 'Team page (/team)',
        paragraphs: [
          'Professional+ admins get an 8-character invite code to share with workers (copy or regenerate). Pending signups appear for approve/deny. The roster lists approved workers with job titles; you can promote a worker to organization admin.',
        ],
      },
      {
        id: 'worker-access',
        title: 'What workers can do',
        bullets: [
          'Cannot create or delete projects.',
          'See assigned projects only; permissions merge org defaults and per-project overrides.',
          'May upload, view, or delete files; add calendar events; send project messages; post internal notes — each optional per worker/project.',
          'Cannot change job status or open organization/billing settings.',
        ],
      },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    sections: [
      {
        id: 'client-access',
        title: 'Granting client access',
        paragraphs: [
          'In Organization settings, expand a project, add the client’s email under Client access, then expand that client and check which files (by category) they may view. Clients sign up with the Client account type; no separate portal URL.',
        ],
      },
      {
        id: 'client-experience',
        title: 'Client experience',
        bullets: [
          'Projects list shows only shared projects.',
          'Read-only job status on the project page.',
          'Document list filtered to admin-selected shared files; empty state if nothing shared yet.',
          'No upload, AI panel, internal notes, messages, calendar, or archive.',
        ],
      },
    ],
  },
  {
    id: 'organization',
    title: 'Organization settings',
    sections: [
      {
        id: 'org-global',
        title: 'Organization-wide',
        bullets: [
          'Data retention — explains 7-day completed and 12-month inactive deletion; backup retention by plan; how to request account deletion.',
          'Default worker access — org-wide toggles for upload, delete files, calendar events, and view files (starting point before per-project overrides).',
        ],
      },
      {
        id: 'org-project',
        title: 'Per-project (expand a project in the list)',
        bullets: [
          'Rename — customer name and job address.',
          'Job status stages — add, remove, or relabel workflow steps; Completed stays last.',
          'File categories — custom folder names used in the UI and for AI sorting.',
          'Client access — grant/revoke by email; pick shared files per client.',
          'Project workers — assign workers and set per-project permission checkboxes.',
        ],
      },
    ],
  },
  {
    id: 'backups-billing',
    title: 'Backups & billing',
    sections: [
      {
        id: 'backups',
        title: 'Cloud backups (/settings/backups)',
        paragraphs: [
          'Starter and above: enable automatic backups, choose daily or weekly schedule, optionally run a backup when a job hits Completed, run a backup now, and download or delete retained ZIPs (5, 15, or 30 kept by plan).',
        ],
      },
      {
        id: 'billing',
        title: 'Billing (/settings/billing)',
        paragraphs: [
          'View current plan and subscription status, change plan (through checkout), and open the Stripe customer portal to update payment method or cancel. Trial requires a card up front for the 7-day period.',
        ],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics dashboard',
    sections: [
      {
        id: 'dashboard',
        title: 'Dashboard (/dashboard)',
        paragraphs: [
          'Professional+ admins see project, job, document, and worker counts; subscription summary; pending worker approvals; charts for jobs by status and documents by type; and a recent projects list. Enterprise enables the advanced analytics entitlement for deeper insights where implemented.',
        ],
      },
    ],
  },
  {
    id: 'mobile-legal',
    title: 'Mobile & legal',
    sections: [
      {
        id: 'mobile',
        title: 'Mobile use',
        paragraphs: [
          'Use LedgerStack in the mobile browser or install as a PWA. Native Android/iOS builds (Capacitor) support Take Photo on upload for faster field capture. Layouts respect safe areas on phones.',
        ],
      },
      {
        id: 'legal',
        title: 'Legal & support',
        bullets: [
          'Privacy Policy — /privacy',
          'Terms of Service — /terms',
          'Support — support@ledgerstack.org (linked throughout the app)',
          'In-app legal notices cover AI limitations, file responsibility, client access, security, exports, and worker audit expectations.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Who can do what',
    sections: [
      {
        id: 'role-table',
        title: 'Quick reference',
        bullets: [
          'Create/delete projects — Admin only',
          'Team, organization, billing, backups — Admin only',
          'Change job status — Admin only; Worker and Client view only',
          'Upload/delete documents — Admin; Worker per permissions; Client never',
          'AI summary, timeline, export — Admin (plan limits); Worker if staff-capable; Client never',
          'Calendar, project messages, internal notes — Professional+ staff with permission',
          'DM / group messaging — Professional+ staff',
          'View files — Staff per permissions; Client sees admin-shared subset only',
          'Analytics — Admin on Professional+',
        ],
      },
    ],
  },
]
