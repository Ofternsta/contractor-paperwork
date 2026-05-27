# Supabase auth email — LedgerStack branding & rate limits

Verification emails are sent from the app when **`RESEND_API_KEY`** is set (recommended). They show as **LedgerStack auth** and use Resend’s limits instead of Supabase’s default **2 emails/hour** cap.

If Resend is not configured, the app falls back to Supabase `auth.resend()`, which uses whatever you configure in the Supabase Dashboard.

## Recommended: Resend (production)

1. [resend.com](https://resend.com) → add domain **ledgerstack.org** → verify DNS (DKIM/SPF in Vercel).
2. Create an API key.
3. On **Vercel** (and `.env.local`):

```env
RESEND_API_KEY=re_...
AUTH_EMAIL_FROM=noreply@ledgerstack.org
AUTH_EMAIL_SENDER_NAME=LedgerStack auth
AUTH_EMAIL_APP_NAME=LedgerStack
```

4. Redeploy. New verification emails are sent by Resend with sender **LedgerStack auth**.

Worker sign-up from the login page still uses Supabase’s built-in mail unless you also enable custom SMTP below.

## Supabase Dashboard (fallback or worker sign-up)

### Sender name “LedgerStack auth” (not “Supabase Auth”)

1. **Authentication → [SMTP Settings](https://supabase.com/dashboard/project/_/auth/smtp)**  
2. Enable **Custom SMTP** (e.g. Resend: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key).
3. Set:
   - **Sender email:** `noreply@ledgerstack.org` (or your verified address)
   - **Sender name:** `LedgerStack auth`
4. Save.

### Email templates

1. **Authentication → [Email Templates](https://supabase.com/dashboard/project/_/auth/templates)**  
2. Open **Confirm signup** (and **Magic link** if used).
3. Set **Subject** to something like: `Confirm your LedgerStack email`
4. Edit the body to mention LedgerStack instead of Supabase.

### Rate limits (more than 2 per hour)

Supabase’s default **email sent** limit is very low (often **2/hour** on hosted projects).

1. **Authentication → [Rate Limits](https://supabase.com/dashboard/project/_/auth/rate-limits)**  
2. Find **Email sent** (or **OTP** / **Sign up and sign-in** depending on UI version).
3. Increase for production, e.g. **30 per hour** (or per your traffic).
4. Save.

With **`RESEND_API_KEY`** set, most admin signup / resend flows bypass Supabase’s email sender and use Resend instead; you still should raise Supabase limits for worker `signUp()` on the login page.

## Redirect URLs

**Authentication → URL Configuration** must include:

- `https://ledgerstack.org/auth/callback`
- `http://localhost:3000/auth/callback` (local)

See `.env.example` for `NEXT_PUBLIC_APP_URL`.
