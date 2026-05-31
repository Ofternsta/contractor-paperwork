'use client'

import type { ReactNode } from 'react'
import type { JobIntelligenceReport } from '@/lib/job-intelligence-types'
import { expandBodyToDisplayLines } from '@/lib/report-body-format'

type JobIntelligenceSummaryProps = {
  report: JobIntelligenceReport
}

function renderEntryLine(line: string, key: string) {
  const messageMatch = line.match(/^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:—|-)\s*(.+?):\s*(.+)$/i)
  if (messageMatch) {
    const [, when, sender, body] = messageMatch
    return (
      <div key={key} className="space-y-1">
        <p className="text-xs text-muted-dim">{when.trim()}</p>
        <p className="text-sm text-foreground">
          <span className="font-medium">{sender.trim()}</span>
          <span className="text-muted">: </span>
          {body.trim()}
        </p>
      </div>
    )
  }

  const datedMatch = line.match(/^(.+?\d{4}.*?\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*:\s*(.+)$/i)
  if (datedMatch) {
    const [, when, rest] = datedMatch
    return (
      <div key={key} className="space-y-1">
        <p className="text-xs text-muted-dim">{when.trim()}</p>
        <p className="text-sm text-foreground leading-relaxed">{rest.trim()}</p>
      </div>
    )
  }

  return (
    <p key={key} className="text-sm text-foreground leading-relaxed">
      {line}
    </p>
  )
}

function renderBody(body: string): ReactNode[] {
  const lines = expandBodyToDisplayLines(body)
  if (!lines.length) {
    return [
      <p key="empty" className="text-sm text-muted-dim">
        No entries.
      </p>,
    ]
  }

  return lines.map((line, index) => renderEntryLine(line, `entry-${index}`))
}

export function JobIntelligenceSummary({ report }: JobIntelligenceSummaryProps) {
  const generated = new Date(report.generatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted">
        Generated {generated} for {report.jobLabel}
      </p>

      <div className="space-y-5">
        {report.sections.map((section) => (
          <article
            key={section.id}
            className="border border-border rounded-xl p-4 bg-surface space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground border-l-4 border-brand pl-2">
              {section.title}
            </h3>
            <div className="space-y-4">{renderBody(section.body)}</div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/25 p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-bright">
          AI summary
        </h3>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
          {report.overview}
        </p>
      </div>
    </div>
  )
}
