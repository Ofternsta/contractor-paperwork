export const JOB_INTELLIGENCE_SECTION_IDS = [
  'project_overview',
  'job_status',
  'timeline',
  'internal_notes',
  'messages',
  'schedule',
  'documents',
] as const

export type JobIntelligenceSectionId =
  (typeof JOB_INTELLIGENCE_SECTION_IDS)[number]

export const JOB_INTELLIGENCE_SECTION_TITLES: Record<
  JobIntelligenceSectionId,
  string
> = {
  project_overview: 'Project overview',
  job_status: 'Job status & workflow',
  timeline: 'Timeline & activity history',
  internal_notes: 'Internal notes',
  messages: 'Project messages',
  schedule: 'Schedule & calendar',
  documents: 'Documents & evidence',
}

export type JobIntelligenceSection = {
  id: JobIntelligenceSectionId
  title: string
  body: string
}

export type JobIntelligenceReport = {
  generatedAt: string
  overview: string
  sections: JobIntelligenceSection[]
  claimId: string
  projectId: string
  projectName: string
  jobLabel: string
}

export type JobIntelligenceContext = {
  project: Record<string, unknown>
  claim: Record<string, unknown>
  allClaims: Array<Record<string, unknown>>
  timelineEvents: Array<{
    id?: string
    claim_id?: string
    event_date: string
    title: string
    description: string
    source?: string
    created_at?: string
    client_name?: string
  }>
  internalNotes: Array<{
    id: string
    body: string
    note_kind: string
    claim_id: string | null
    created_at: string
    author_name: string
  }>
  projectMessages: Array<{
    id: string
    body: string
    created_at: string
    sender_label: string
  }>
  scheduleEvents: Array<Record<string, unknown>>
  evidence: Array<{
    claim_id: string
    client_name: string
    evidence_type: string
    file_name: string
    summary: string
    created_at: string
    uploaded_by_label?: string
  }>
}
