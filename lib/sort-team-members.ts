export function compareByWorkerName(
  a: { full_name?: string | null },
  b: { full_name?: string | null }
) {
  return (a.full_name || '').localeCompare(b.full_name || '', undefined, {
    sensitivity: 'base',
  })
}

export function formatWorkerListLabel(
  fullName: string | null | undefined,
  jobTitle: string | null | undefined
) {
  const name = fullName?.trim() || 'Worker'
  const title = jobTitle?.trim()
  return title ? `${name} — ${title}` : name
}
