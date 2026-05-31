'use client'

import type { ReactNode } from 'react'
import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'

type JobIntelligenceSummaryProps = {
  report: JobIntelligenceReport
}

function renderBody(body: string) {
  const lines = body.split('\n')
  const elements: ReactNode[] = []
  let listItems: string[] = []

  function flushList(key: string) {
    if (!listItems.length) return
    elements.push(
      <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-foreground">
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList(`list-${index}`)
      return
    }
    if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
      listItems.push(trimmed.replace(/^[•-]\s*/, ''))
      return
    }
    flushList(`list-${index}`)
    elements.push(
      <p key={`p-${index}`} className="text-sm text-foreground leading-relaxed">
        {trimmed}
      </p>
    )
  })
  flushList('list-end')

  return elements
}

export function JobIntelligenceSummary({ report }: JobIntelligenceSummaryProps) {
  const generated = new Date(report.generatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <section className="border border-brand-dim/40 rounded-xl p-4 bg-surface space-y-4">
      <div>
        <h2 className="font-bold text-lg text-foreground">AI project summary</h2>
        <p className="text-xs text-muted mt-1">
          Full project history for {report.jobLabel} · Generated {generated}
        </p>
      </div>

      <div className="space-y-4">
        {report.sections.map((section) => (
          <article
            key={section.id}
            className="border border-border rounded-xl p-4 bg-surface-elevated space-y-2"
          >
            <h3 className="text-sm font-semibold text-foreground border-l-4 border-brand pl-2">
              {section.title}
            </h3>
            <div className="space-y-2">{renderBody(section.body)}</div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/25 p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-bright">
          AI summary
        </h3>
        <p className="text-sm text-foreground leading-relaxed">{report.overview}</p>
      </div>
    </section>
  )
}
