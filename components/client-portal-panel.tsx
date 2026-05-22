'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Invoice = {
  id: string
  title: string
  amount_cents: number
  status: string
  created_at: string
}

type ClientPortalPanelProps = {
  projectId: string
  canApprove: boolean
}

export function ClientPortalPanel({
  projectId,
  canApprove,
}: ClientPortalPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('project_invoices')
        .select('id, title, amount_cents, status, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (!error) setInvoices((data || []) as Invoice[])
      setLoading(false)
    }
    load()
  }, [projectId])

  async function updateStatus(id: string, status: string) {
    if (!canApprove) return
    const { error } = await supabase
      .from('project_invoices')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status } : inv))
      )
    }
  }

  function formatAmount(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <section className="border border-blue-100 rounded-xl p-4 bg-blue-50/50 space-y-3">
      <h2 className="font-bold text-lg">Client portal</h2>
      <p className="text-sm text-gray-600">
        View project progress, documents above, and invoices or approvals below.
      </p>

      {loading && <p className="text-sm text-gray-500">Loading invoices…</p>}

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-gray-500">No invoices shared yet.</p>
      )}

      <ul className="space-y-2">
        {invoices.map((inv) => (
          <li
            key={inv.id}
            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <div>
              <p className="font-medium">{inv.title}</p>
              <p className="text-sm text-gray-600">
                {formatAmount(inv.amount_cents)} ·{' '}
                <span className="capitalize">{inv.status}</span>
              </p>
            </div>
            {canApprove && inv.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(inv.id, 'approved')}
                  className="text-sm bg-green-700 text-white px-3 py-2 rounded-lg min-h-[40px]"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(inv.id, 'rejected')}
                  className="text-sm border border-red-300 text-red-700 px-3 py-2 rounded-lg min-h-[40px]"
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
