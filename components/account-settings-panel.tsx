'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { passwordResetRedirectUrl } from '@/lib/auth-redirect'
import {
  PASSWORD_REQUIREMENTS_TEXT,
} from '@/lib/password-policy'
import type { ThemePreference } from '@/lib/theme'
import { supabase } from '@/lib/supabase'

type MfaFactor = {
  id: string
  friendly_name?: string
  factor_type: string
  status: string
}

export function AccountSettingsPanel() {
  const router = useRouter()
  const { preference, setPreference } = useTheme()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [nameMessage, setNameMessage] = useState<string | null>(null)

  const [sendingResetEmail, setSendingResetEmail] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState<string | null>(null)
  const [mfaBusy, setMfaBusy] = useState(false)

  const [signingOutAll, setSigningOutAll] = useState(false)

  const verifiedTotp = mfaFactors.filter(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  )
  const hasMfa = verifiedTotp.length > 0

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setEmail(user.email || '')
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    setFullName(profile?.full_name || '')
    setLoadingProfile(false)
  }, [router])

  const loadMfa = useCallback(async () => {
    setMfaLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setMfaMessage(error.message)
      setMfaFactors([])
    } else {
      const all = [
        ...(data.totp || []),
        ...(data.phone || []),
        ...((data as { all?: MfaFactor[] }).all || []),
      ]
      const byId = new Map<string, MfaFactor>()
      for (const f of all) byId.set(f.id, f as MfaFactor)
      setMfaFactors([...byId.values()])
    }
    setMfaLoading(false)
  }, [])

  useEffect(() => {
    void loadProfile()
    void loadMfa()
  }, [loadProfile, loadMfa])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    setNameMessage(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setNameMessage('Not signed in.')
      setSavingName(false)
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', user.id)
    setSavingName(false)
    if (error) setNameMessage(error.message)
    else setNameMessage('Name updated.')
  }

  async function sendPasswordResetEmail() {
    setPasswordMessage(null)
    const target = email.trim().toLowerCase()
    if (!target) {
      setPasswordMessage('No email on file for this account.')
      return
    }
    setSendingResetEmail(true)
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: passwordResetRedirectUrl(),
    })
    setSendingResetEmail(false)
    if (error) {
      setPasswordMessage(error.message)
      return
    }
    setPasswordMessage(
      `We sent a password reset link to ${target}. Check your inbox and spam folder. The link expires after a short time.`
    )
  }

  async function startMfaEnroll() {
    setMfaMessage(null)
    setEnrolling(true)
    setMfaBusy(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    })
    setMfaBusy(false)
    if (error || !data) {
      setMfaMessage(
        error?.message ||
          'Could not start 2FA setup. Enable MFA in your Supabase project settings.'
      )
      setEnrolling(false)
      return
    }
    setEnrollFactorId(data.id)
    setQrCode(data.totp?.qr_code || null)
  }

  async function confirmMfaEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollFactorId || !mfaCode.trim()) return
    setMfaBusy(true)
    setMfaMessage(null)
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrollFactorId })
    if (challengeError || !challenge) {
      setMfaMessage(challengeError?.message || 'Could not verify code.')
      setMfaBusy(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    })
    setMfaBusy(false)
    if (verifyError) {
      setMfaMessage(verifyError.message)
      return
    }
    setEnrolling(false)
    setEnrollFactorId(null)
    setQrCode(null)
    setMfaCode('')
    setMfaMessage('Two-factor authentication is enabled.')
    await loadMfa()
  }

  async function cancelMfaEnroll() {
    if (enrollFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollFactorId })
    }
    setEnrolling(false)
    setEnrollFactorId(null)
    setQrCode(null)
    setMfaCode('')
    setMfaMessage(null)
    await loadMfa()
  }

  async function disableMfa(factorId: string) {
    if (
      !window.confirm(
        'Remove two-factor authentication from your account? You can set it up again later.'
      )
    ) {
      return
    }
    setMfaBusy(true)
    setMfaMessage(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setMfaBusy(false)
    if (error) {
      setMfaMessage(error.message)
      return
    }
    setMfaMessage('Two-factor authentication removed.')
    await loadMfa()
  }

  async function logoutEverywhere() {
    if (
      !window.confirm(
        'Sign out on all devices? You will need to sign in again on this device too.'
      )
    ) {
      return
    }
    setSigningOutAll(true)
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/login')
    router.refresh()
  }

  function themeButton(value: ThemePreference, label: string) {
    const active = preference === value
    return (
      <button
        type="button"
        onClick={() => setPreference(value)}
        className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
          active
            ? 'border-brand text-brand-bright bg-[var(--info-surface)]'
            : 'border-border text-muted hover:border-brand-dim'
        }`}
      >
        {label}
      </button>
    )
  }

  if (loadingProfile) {
    return <p className="text-sm text-muted-dim">Loading settings…</p>
  }

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
        <h2 className="font-bold text-lg text-[var(--header-title)]">Profile</h2>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="input-field opacity-70 cursor-not-allowed"
            />
            <p className="text-xs text-muted-dim mt-1">
              Contact support to change your login email.
            </p>
          </div>
          <div>
            <label
              htmlFor="settings-full-name"
              className="block text-sm font-medium text-muted mb-1"
            >
              Display name
            </label>
            <input
              id="settings-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          {nameMessage && (
            <p
              className={`text-sm ${
                nameMessage.includes('updated')
                  ? 'text-green-700'
                  : 'text-red-600'
              }`}
            >
              {nameMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={savingName}
            className="btn-primary px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-50"
          >
            {savingName ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
        <h2 className="font-bold text-lg text-[var(--header-title)]">
          Change password
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          For security, we email you a link to set a new password. You cannot
          change it directly on this page.
        </p>
        <p className="text-sm text-muted-dim">
          Password requirements: {PASSWORD_REQUIREMENTS_TEXT}
        </p>
        <p className="text-sm text-muted">
          Reset link will be sent to <strong className="text-foreground">{email}</strong>.
        </p>
        {passwordMessage && (
          <p
            className={`text-sm leading-relaxed ${
              passwordMessage.includes('sent a password reset')
                ? 'alert-success'
                : 'alert-error'
            }`}
          >
            {passwordMessage}
          </p>
        )}
        <button
          type="button"
          disabled={sendingResetEmail || !email}
          onClick={sendPasswordResetEmail}
          className="btn-primary px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-50"
        >
          {sendingResetEmail ? 'Sending…' : 'Email password reset link'}
        </button>
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
        <h2 className="font-bold text-lg text-[var(--header-title)]">
          Two-factor authentication
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Add an authenticator app (Google Authenticator, 1Password, etc.) for an
          extra sign-in step.
        </p>

        {mfaLoading && (
          <p className="text-sm text-muted-dim">Checking 2FA status…</p>
        )}

        {!mfaLoading && hasMfa && !enrolling && (
          <div className="space-y-3">
            <p className="text-sm text-green-700 font-medium">
              Enabled on {verifiedTotp.length} device
              {verifiedTotp.length === 1 ? '' : 's'}
            </p>
            {verifiedTotp.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg p-3"
              >
                <span className="text-sm">
                  {f.friendly_name || 'Authenticator app'}
                </span>
                <button
                  type="button"
                  disabled={mfaBusy}
                  onClick={() => disableMfa(f.id)}
                  className="text-sm text-red-600 font-medium min-h-[40px] px-2 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {!mfaLoading && !hasMfa && !enrolling && (
          <button
            type="button"
            disabled={mfaBusy}
            onClick={startMfaEnroll}
            className="btn-primary px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-50"
          >
            Set up authenticator app
          </button>
        )}

        {enrolling && (
          <form onSubmit={confirmMfaEnroll} className="space-y-4">
            {qrCode && (
              <div className="flex flex-col items-center gap-2 p-4 bg-surface rounded-xl border border-border">
                <p className="text-xs text-muted text-center">
                  Scan with your authenticator app
                </p>
                <div
                  className="bg-white p-2 rounded-lg [&_svg]:max-w-[200px] [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: qrCode }}
                />
              </div>
            )}
            <div>
              <label
                htmlFor="mfa-code"
                className="block text-sm font-medium text-muted mb-1"
              >
                6-digit code
              </label>
              <input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="input-field tracking-widest text-center text-lg"
                placeholder="000000"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={mfaBusy || mfaCode.length < 6}
                className="btn-primary px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-50"
              >
                {mfaBusy ? 'Verifying…' : 'Enable 2FA'}
              </button>
              <button
                type="button"
                onClick={cancelMfaEnroll}
                className="btn-secondary px-4 py-3 rounded-xl text-sm min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {mfaMessage && (
          <p
            className={`text-sm ${
              mfaMessage.toLowerCase().includes('enabled') ||
              mfaMessage.toLowerCase().includes('removed')
                ? 'text-green-700'
                : 'text-red-600'
            }`}
          >
            {mfaMessage}
          </p>
        )}
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-4">
        <h2 className="font-bold text-lg text-[var(--header-title)]">
          Appearance
        </h2>
        <p className="text-sm text-muted">
          Choose how LedgerStack looks on this device.
        </p>
        <div className="flex gap-2">
          {themeButton('dark', 'Dark')}
          {themeButton('light', 'Light')}
          {themeButton('system', 'System')}
        </div>
      </section>

      <section className="border border-border rounded-xl p-4 bg-surface-elevated space-y-3">
        <h2 className="font-bold text-lg text-[var(--header-title)]">Sessions</h2>
        <p className="text-sm text-muted leading-relaxed">
          Sign out of every device where you are logged into LedgerStack,
          including this one.
        </p>
        <button
          type="button"
          disabled={signingOutAll}
          onClick={logoutEverywhere}
          className="w-full border border-red-300 text-red-600 py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {signingOutAll ? 'Signing out…' : 'Log out everywhere'}
        </button>
      </section>
    </div>
  )
}
