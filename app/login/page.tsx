'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      setMessage(
        'Account created. If email confirmation is enabled, check your inbox, then sign in.'
      )
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

          {message && (
            <p
              className={`text-sm leading-relaxed ${
                message.includes('created') ? 'text-green-800' : 'text-red-700'
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
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
