'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { deleteProject } from '@/lib/delete-project'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  customer_name: string
  project_address: string
  notes?: string
}

export default function Home() {
  const router = useRouter()
  const [customerName, setCustomerName] = useState('')
  const [projectAddress, setProjectAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*')
    if (error) {
      console.error(error)
      setProjects([])
      return
    }
    setProjects((data || []) as Project[])
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
    setSigningOut(false)
  }

  async function createProject() {
    if (!customerName.trim() || !projectAddress.trim()) return

    setCreating(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      setCreating(false)
      return
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          customer_name: customerName,
          project_address: projectAddress,
          notes,
          user_id: user.id,
        },
      ])
      .select()

    if (error) {
      alert(error.message)
      setCreating(false)
      return
    }

    const project = data?.[0]

    if (project?.id) {
      const { data: claimRows, error: claimError } = await supabase
        .from('claims')
        .insert([
          {
            project_id: project.id,
            client_name: customerName,
            property_address: projectAddress,
            loss_type: 'Inspection',
            insurance_company: 'Unknown',
            claim_number: `AUTO-${Date.now()}`,
            status: 'Inspection',
            notes: 'Auto claim',
          },
        ])
        .select('id')

      if (claimError || !claimRows?.length) {
        await supabase.from('projects').delete().eq('id', project.id)
        alert(
          claimError?.message?.includes('permission denied')
            ? 'Could not create project: run supabase/auth-setup.sql in the Supabase SQL Editor, then try again.'
            : `Could not create project: ${claimError?.message || 'claim was not saved'}`
        )
        setCreating(false)
        return
      }
    }

    setCustomerName('')
    setProjectAddress('')
    setNotes('')
    await fetchProjects()
    setCreating(false)
  }

  async function removeProject(project: Project) {
    const ok = window.confirm(
      `Delete "${project.customer_name}" and all claims and uploaded files? This cannot be undone.`
    )
    if (!ok) return

    setDeletingId(project.id)
    const err = await deleteProject(project.id)
    if (err) {
      alert(err)
    } else {
      await fetchProjects()
    }
    setDeletingId(null)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title="Contractor Paperwork"
        subtitle="Projects & claim evidence in the field"
        onSignOut={signOut}
        signingOut={signingOut}
      />

      <main className="flex-1 safe-x px-4 py-4 max-w-lg mx-auto w-full pb-8 safe-bottom space-y-6">
        <section className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <h2 className="font-bold text-lg">New project</h2>

          <input
            className="border border-gray-300 rounded-xl p-3 w-full"
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          <input
            className="border border-gray-300 rounded-xl p-3 w-full"
            placeholder="Project address"
            value={projectAddress}
            onChange={(e) => setProjectAddress(e.target.value)}
          />

          <textarea
            className="border border-gray-300 rounded-xl p-3 w-full min-h-[88px]"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button
            type="button"
            onClick={createProject}
            disabled={creating || !customerName.trim() || !projectAddress.trim()}
            className="w-full bg-black text-white py-4 rounded-xl font-medium disabled:opacity-50 min-h-[52px] active:scale-[0.98] transition-transform"
          >
            {creating ? 'Creating…' : 'Create Project'}
          </button>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3">Your projects</h2>

          {projects.length === 0 && (
            <p className="text-gray-500 text-center py-6">
              No projects yet. Create one above.
            </p>
          )}

          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
              >
                <Link
                  href={`/project/${p.id}`}
                  className="block p-4 active:bg-gray-50 min-h-[64px]"
                >
                  <p className="font-bold text-lg">{p.customer_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{p.project_address}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => removeProject(p)}
                  disabled={deletingId === p.id}
                  className="w-full border-t border-red-100 py-3 text-red-700 text-sm font-semibold disabled:opacity-50 min-h-[48px] active:bg-red-50"
                  aria-label={`Delete ${p.customer_name}`}
                >
                  {deletingId === p.id ? 'Deleting…' : 'Delete project'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-gray-500 text-center leading-relaxed px-2">
          Native App Store build: deploy to Vercel, set CAPACITOR_SERVER_URL, then
          run npm run cap:android or cap:ios. See MOBILE.md.
        </p>
      </main>
    </div>
  )
}
