/** Job description shown on the job list (per-job notes, else legacy project notes). */
export function displayJobDescription(
  claimNotes: string | null | undefined,
  legacyProjectNotes?: string | null | undefined
): string | null {
  const claim = claimNotes?.trim()
  if (claim && claim.toLowerCase() !== 'auto claim') return claim

  const project = legacyProjectNotes?.trim()
  return project || null
}

/** @deprecated Use displayJobDescription */
export function displayJobCreationNotes(
  claimNotes: string | null | undefined,
  projectNotes: string | null | undefined
): string | null {
  return displayJobDescription(claimNotes, projectNotes)
}
