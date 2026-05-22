# Contractor Paperwork — Platform Guide

## Account types

| Role | Access |
|------|--------|
| **Admin** | All projects, team, billing, analytics, system settings, PDF export, AI tools |
| **Worker** | Assigned org projects after one-time approval; upload evidence, update claims, AI tools |
| **Client** | View-only on granted projects: progress, documents, claim updates, invoices, approvals |

## Supabase setup (run in order)

1. `supabase/roles-and-orgs.sql` — profiles, organizations, RLS on projects/claims
2. `supabase/platform-security.sql` — storage RLS, subscriptions, invoices, timelines, claim updates

Remove or do not apply `anon-app-permissions.sql` / wide-open storage policies in production.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=              # AI summaries, OCR (vision), categorization
NEXT_PUBLIC_APP_URL=       # Billing redirects: localhost locally, Vercel URL in production

# Optional — Stripe subscriptions
STRIPE_SECRET_KEY=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PROFESSIONAL=
STRIPE_PRICE_ENTERPRISE=
```

## Features

- **Uploads**: Drag-and-drop, multi-file, server `/api/upload` with PDF/DOCX text + image OCR (Groq vision)
- **Search**: Filename, summary, and extracted/OCR text on the project page
- **AI**: Claim summary, timeline (`/api/claim-summary`, `/api/claim-timeline`), evidence categorization
- **Export**: PDF via jsPDF (`npm install`), HTML fallback for print-to-PDF
- **Dashboard**: `/dashboard` (admin) — project/claim/evidence stats
- **Billing**: `/settings/billing` (admin) — trial/starter/pro/enterprise plans

## Install dependencies

```bash
npm install
```

Adds `jspdf` and `stripe` for PDF export and checkout (billing works locally without Stripe keys).

## Mobile

Capacitor 7 — see `MOBILE.md`. PWA safe-area styles in `app/globals.css`.
