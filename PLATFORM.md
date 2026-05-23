# LedgerStack — Platform Guide

## Account types

| Role | Access |
|------|--------|
| **Admin** | All projects, team, billing, analytics, system settings, PDF export, AI tools |
| **Worker** | Assigned org projects after one-time approval; upload evidence, update claims, AI tools |
| **Client** | View-only on granted projects: progress, documents, claim updates, invoices, approvals |

## Supabase setup (run in order)

1. `supabase/roles-and-orgs.sql` — profiles, organizations, RLS on projects/claims
2. `supabase/platform-security.sql` — storage RLS, subscriptions, invoices, timelines, claim updates
3. `supabase/billing-pending-status.sql` — if subscriptions already exist, adds `pending` status for checkout
4. `supabase/account-role-fix.sql` — lets workers convert to admin (wrong signup)
5. `supabase/messaging.sql` — admin↔worker team chat and project messages with clients

### Worker signup (company invite code)

- Each **admin** company gets an **auto-generated 8-character** code (not chosen by hand).
- Workers must enter that code at signup; the app validates it against `organizations.invite_code`.
- Admin can **Generate new code** on the home page (Team panel).
- Run `account-role-fix.sql` so the database enforces the code format.

### Wrong role at signup

- Delete the account (platform **Accounts** page or Supabase → Authentication → Users) and sign up again with the correct type.
- **Transfer admin:** existing admin → Team → approved worker → **Make organization admin**.

Remove or do not apply `anon-app-permissions.sql` / wide-open storage policies in production.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=              # AI summaries, OCR (vision), categorization
NEXT_PUBLIC_APP_URL=       # Production: https://ledgerstack.org — local dev: http://localhost:3000
PLATFORM_OWNER_EMAIL=      # Your login email — only you can delete accounts at /settings/users
SUPABASE_SERVICE_ROLE_KEY= # Required for account deletion (Supabase → Settings → API → service_role)

# Stripe subscriptions (see STRIPE.md)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PROFESSIONAL=
STRIPE_PRICE_ENTERPRISE=
```

Full Stripe Dashboard steps: **`STRIPE.md`**

## Features

- **Uploads**: Drag-and-drop, multi-file, server `/api/upload` with PDF/DOCX text + image OCR (Groq vision)
- **Search**: Filename, summary, and extracted/OCR text on the project page
- **AI**: Claim summary, timeline (`/api/claim-summary`, `/api/claim-timeline`), evidence categorization
- **Export**: PDF via jsPDF (`npm install`), HTML fallback for print-to-PDF
- **Dashboard**: `/dashboard` (admin) — project/claim/evidence stats
- **Billing**: Admins **choose a plan at signup** (trial/starter/pro/enterprise); paid plans use Stripe Checkout + webhook; no automatic trial

## Install dependencies

```bash
npm install
```

Adds `jspdf` and `stripe` for PDF export and checkout (billing works locally without Stripe keys).

## Mobile

Capacitor 7 — see `MOBILE.md`. PWA safe-area styles in `app/globals.css`.
