import Link from 'next/link'
import { LegalDocumentLayout } from '@/components/legal-document-layout'
import {
  HOW_TO_PARTS,
  allHowToScreenshots,
  type HowToScreenshot,
  type HowToSection,
} from '@/lib/how-to-guide'

const HOW_TO_DIR = '/how-to'

function ScreenshotPlaceholder({ shot }: { shot: HowToScreenshot }) {
  return (
    <figure className="my-5">
      <div
        className="relative flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface/60 px-6 py-10 text-center"
        role="img"
        aria-label={`Screenshot placeholder: ${shot.caption}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Screenshot placeholder
        </span>
        <p className="text-sm font-medium text-foreground">{shot.caption}</p>
        <p className="font-mono text-xs text-brand-bright break-all">{shot.filename}</p>
        {shot.route ? (
          <p className="text-xs text-muted">
            Go to{' '}
            <code className="rounded bg-background px-1.5 py-0.5 text-foreground">
              {shot.route}
            </code>
          </p>
        ) : null}
        <p className="max-w-md text-xs text-muted leading-relaxed">{shot.capture}</p>
        <p className="text-[11px] text-muted">
          Save PNG to{' '}
          <code className="text-foreground">public/how-to/{shot.filename}</code>
        </p>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        File: <code className="text-foreground">{HOW_TO_DIR}/{shot.filename}</code>
      </figcaption>
    </figure>
  )
}

function HowToSectionBlock({ section }: { section: HowToSection }) {
  return (
    <section id={section.id} className="scroll-mt-24 space-y-3">
      <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
      {section.intro ? <p>{section.intro}</p> : null}
      {section.planNote ? (
        <p className="text-xs rounded-md border border-border bg-surface px-3 py-2 text-muted">
          <span className="font-medium text-foreground">Plan: </span>
          {section.planNote}
        </p>
      ) : null}
      {section.bullets?.length ? (
        <ul className="list-disc list-inside space-y-1 text-sm">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.screenshots.map((shot) => (
        <ScreenshotPlaceholder key={shot.filename} shot={shot} />
      ))}
    </section>
  )
}

export function HowToContent() {
  const shots = allHowToScreenshots()

  return (
    <LegalDocumentLayout title="LedgerStack product guide">
      <p className="text-foreground">
        Complete feature guide with <strong>screenshot placeholders</strong>. Capture each
        image, save it under <code className="text-sm">public/how-to/</code> using the exact
        filename shown, then reload this page (wire up{' '}
        <code className="text-sm">next/image</code> or an{' '}
        <code className="text-sm">&lt;img&gt;</code> when ready to display them).
      </p>

      <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm">
        <p className="font-medium text-foreground mb-1">Quick start</p>
        <ol className="list-decimal list-inside space-y-1 text-muted">
          <li>Run the app locally or use production.</li>
          <li>Sign in with the role needed for each section (admin, worker, client).</li>
          <li>Replace <code>[id]</code> in routes with a real project UUID.</li>
          <li>
            Hide browser dev overlays before capturing (or use production).
          </li>
        </ol>
      </div>

      <nav
        aria-label="Guide parts"
        className="rounded-lg border border-border bg-surface p-4 space-y-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Table of contents ({shots.length} screenshots)
        </p>
        {HOW_TO_PARTS.map((part) => (
          <div key={part.id}>
            <a
              href={`#part-${part.id}`}
              className="text-sm font-semibold text-brand-bright hover:underline"
            >
              {part.title}
            </a>
            {part.audience ? (
              <span className="text-xs text-muted ml-2">({part.audience})</span>
            ) : null}
            <ul className="mt-1 ml-3 space-y-0.5 text-sm border-l border-border pl-3">
              {part.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-muted hover:text-brand-bright">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <details className="rounded-lg border border-border bg-surface text-sm">
        <summary className="cursor-pointer px-4 py-3 font-medium text-foreground">
          Screenshot filename checklist ({shots.length})
        </summary>
        <ol className="px-4 pb-4 space-y-1 font-mono text-xs text-muted list-decimal list-inside">
          {shots.map((shot) => (
            <li key={shot.filename} className="text-foreground">
              {shot.filename}
              <span className="font-sans text-muted"> — {shot.caption}</span>
            </li>
          ))}
        </ol>
      </details>

      {HOW_TO_PARTS.map((part) => (
        <div key={part.id} id={`part-${part.id}`} className="scroll-mt-24 pt-6 border-t border-border">
          <h2 className="text-xl font-bold text-foreground mb-1">{part.title}</h2>
          {part.audience ? (
            <p className="text-xs text-muted mb-6">Audience: {part.audience}</p>
          ) : (
            <div className="mb-6" />
          )}
          <div className="space-y-10">
            {part.sections.map((section) => (
              <HowToSectionBlock key={section.id} section={section} />
            ))}
          </div>
        </div>
      ))}

      <section className="scroll-mt-24 pt-6 border-t border-border space-y-3">
        <h2 className="text-xl font-bold text-foreground">Role summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-border rounded-lg">
            <thead>
              <tr className="bg-surface text-left">
                <th className="p-2 font-semibold text-foreground">Feature</th>
                <th className="p-2 font-semibold text-foreground">Admin</th>
                <th className="p-2 font-semibold text-foreground">Worker</th>
                <th className="p-2 font-semibold text-foreground">Client</th>
              </tr>
            </thead>
            <tbody className="text-muted divide-y divide-border">
              {[
                ['Create / delete projects', 'Yes', '—', '—'],
                ['Team, org settings, billing, backups', 'Yes', '—', '—'],
                ['Change job status', 'Yes', '—', 'View only'],
                ['Upload / delete documents', 'Yes', 'Per project', '—'],
                ['AI summary, timeline, export', 'Yes (plan limits)', 'If permitted', '—'],
                ['Calendar, project messages, internal notes', 'Pro+', 'Pro+ if permitted', '—'],
                ['DM / group messaging launcher', 'Pro+', 'Pro+ if permitted', '—'],
                ['View shared files', 'All staff', 'If permitted', 'Admin-selected only'],
                ['Analytics dashboard', 'Pro+', '—', '—'],
              ].map(([feature, admin, worker, client]) => (
                <tr key={feature}>
                  <td className="p-2 text-foreground">{feature}</td>
                  <td className="p-2">{admin}</td>
                  <td className="p-2">{worker}</td>
                  <td className="p-2">{client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          New to LedgerStack?{' '}
          <Link href="/login?signup=admin" className="text-brand-bright hover:underline">
            Create a company account
          </Link>{' '}
          or{' '}
          <Link href="/" className="text-brand-bright hover:underline">
            view pricing
          </Link>
          .
        </p>
      </section>
    </LegalDocumentLayout>
  )
}
