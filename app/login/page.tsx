'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeSignupProfile, linkClientAccessByEmail } from '@/lib/auth-signup'
import type { AppRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [role, setRole] = useState<AppRole>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setMessage('Password must be at least 6 characters.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      const userId = data.user?.id
      if (!userId) {
        setMessage(
          'Account created. If email confirmation is enabled, confirm your email, then sign in.'
        )
        setMode('signin')
        setLoading(false)
        return
      }

      const profileError = await completeSignupProfile({
        userId,
        role,
        fullName,
        organizationName,
        inviteCode,
      })

      if (profileError) {
        setMessage(profileError)
        setLoading(false)
        return
      }

      if (role === 'worker') {
        setMessage(
          'Worker account created. Your admin must approve you once before you can view projects.'
        )
        setMode('signin')
        setLoading(false)
        return
      }

      if (role === 'client') {
        setMessage(
          'Client account created. Your contractor admin must grant you access to each project (by your email).'
        )
        setMode('signin')
        setLoading(false)
        return
      }

      setMessage('Admin account created. You can sign in now.')
      setMode('signin')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    await linkClientAccessByEmail()
    router.push('/')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom">
      <main className="flex-1 flex flex-col justify-center safe-x px-4 py-8 max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <p className="text-4xl mb-3" aria-hidden>
            📋
          </p>
          <h1 className="text-2xl font-bold">Contractor Paperwork</h1>
          <p className="text-gray-600 mt-2 text-sm">
            Sign in to manage projects and claim evidence
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4"
        >
          <div className="flex rounded-xl bg-white border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                mode === 'signin' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                mode === 'signup' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Sign up
            </button>
          </div>

          {mode === 'signup' && (
            <>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  Account type
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      ['admin', 'Admin', 'Full control — create/delete projects, edit summaries, approve team'],
                      ['worker', 'Worker', 'Needs one-time admin approval, then can view & add to projects'],
                      ['client', 'Client', 'View-only — admin grants access per project (by email)'],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label
                      key={value}
                      className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${
                        role === value
                          ? 'border-black bg-white'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={role === value}
                        onChange={() => setRole(value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium block">{label}</span>
                        <span className="text-xs text-gray-600">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Your name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border border-gray-300 rounded-xl p-3 w-full bg-white"
                  placeholder="Jane Contractor"
                />
              </div>

              {role === 'admin' && (
                <div>
                  <label
                    htmlFor="orgName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company / organization name
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="border border-gray-300 rounded-xl p-3 w-full bg-white"
                    placeholder="Acme Restoration"
                  />
                </div>
              )}

              {role === 'worker' && (
                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Organization invite code
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(e.target.value.toUpperCase())
                    }
                    className="border border-gray-300 rounded-xl p-3 w-full bg-white uppercase tracking-widest"
                    placeholder="From your admin"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-xl p-3 w-full bg-white"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-xl p-3 w-full bg-white"
              placeholder="At least 6 characters"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border border-gray-300 rounded-xl p-3 w-full bg-white"
                placeholder="Re-enter password"
              />
            </div>
          )}

          {message && (
            <p
              className={`text-sm leading-relaxed ${
                message.includes('created') || message.includes('approval')
                  ? 'text-green-800'
                  : 'text-red-700'
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !email.trim() ||
              !password ||
              (mode === 'signup' && !confirmPassword)
            }
            className="w-full bg-black text-white py-4 rounded-xl font-medium disabled:opacity-50 min-h-[52px]"
          >
            {loading
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}
