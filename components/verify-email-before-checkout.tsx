'use client'

import { useCallback, useEffect, useState } from 'react'

type VerifyEmailBeforeCheckoutProps = {
  email: string
  onVerified: () => void
}

export function VerifyEmailBeforeCheckout({
  email,
  onVerified,
}: VerifyEmailBeforeCheckoutProps) {
  const [message, setMessage] = useState<string | null>(
    'Verify your email before entering card details. Check your inbox for the confirmation link.'
  )
  const [resending, setResending] = useState(false)

  const check = useCallback(async () => {
    const res = await fetch(
      `/api/auth/email-verification-status?email=${encodeURIComponent(email)}`
    )
    const payload = await res.json().catch(() => ({}))
    if (res.ok && payload.verified) {
      onVerified()
    }
  }, [email, onVerified])

  useEffect(() => {
    void check()
    const interval = setInterval(check, 4000)
    return () => clearInterval(interval)
  }, [check])

  async function resend() {
    setResending(true)
    setMessage(null)
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const payload = await res.json().catch(() => ({}))
    setResending(false)
    if (!res.ok) {
      setMessage(payload.error || 'Could not resend email')
      return
    }
    setMessage('Verification email sent. Open the link, then this page will continue.')
  }

  return (
    <section className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
      <h2 className="font-bold text-amber-950">Verify your email first</h2>
      <p className="text-sm text-amber-900 leading-relaxed">
        For security, you must confirm <strong>{email}</strong> before card
        checkout. We sent a link to that inbox (check spam). After you click
        it, you will return here to enter payment details.
      </p>
      <p className="text-xs text-amber-800/90">
        Your login is created now; your company workspace is set up after payment
        completes.
      </p>
      {message && (
        <p className="text-sm text-amber-900 border border-amber-100 rounded-lg p-2 bg-white/60">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={resending}
          onClick={resend}
          className="text-sm btn-primary text-[#052e16] px-4 py-2 rounded-lg min-h-[44px] disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend verification email'}
        </button>
        <button
          type="button"
          onClick={check}
          className="text-sm border border-amber-300 px-4 py-2 rounded-lg min-h-[44px] text-amber-950"
        >
          I verified — check again
        </button>
      </div>
    </section>
  )
}
