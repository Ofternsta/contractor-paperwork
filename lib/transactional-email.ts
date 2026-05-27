import 'server-only'

import {
  authEmailAppName,
  authEmailFromHeader,
  resendApiKey,
} from '@/lib/auth-email-config'

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string; reason?: 'no_provider' | 'api_error' }

export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const apiKey = resendApiKey()
  if (!apiKey) {
    return { ok: false, error: 'Email provider not configured', reason: 'no_provider' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: authEmailFromHeader(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : `Email send failed (${res.status})`
    return { ok: false, error: message, reason: 'api_error' }
  }

  return { ok: true }
}

export function buildVerificationEmailHtml(input: {
  confirmUrl: string
  appName?: string
}) {
  const appName = input.appName || authEmailAppName()
  const confirmUrl = input.confirmUrl

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1419;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1419;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1a2332;border:1px solid #2d3a4d;border-radius:16px;padding:32px 28px;">
        <tr><td style="color:#4ade80;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${appName}</td></tr>
        <tr><td style="padding-top:12px;color:#f8fafc;font-size:22px;font-weight:700;line-height:1.3;">Confirm your email</td></tr>
        <tr><td style="padding-top:12px;color:#94a3b8;font-size:15px;line-height:1.5;">Tap the button below to verify your address and continue with ${appName}. This link expires after a short time.</td></tr>
        <tr><td style="padding-top:24px;">
          <a href="${confirmUrl}" style="display:inline-block;background:#22c55e;color:#052e16;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:10px;">Verify email</a>
        </td></tr>
        <tr><td style="padding-top:20px;color:#64748b;font-size:12px;line-height:1.5;">If the button does not work, copy this link into your browser:<br><a href="${confirmUrl}" style="color:#4ade80;word-break:break-all;">${confirmUrl}</a></td></tr>
        <tr><td style="padding-top:24px;color:#64748b;font-size:12px;">If you did not create an account, you can ignore this message.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildVerificationEmailText(input: {
  confirmUrl: string
  appName?: string
}) {
  const appName = input.appName || authEmailAppName()
  return `Confirm your ${appName} email\n\nOpen this link to verify your address:\n${input.confirmUrl}\n\nIf you did not sign up, ignore this email.`
}
