/** Supabase free tier allows up to 50 MB per file */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateUploadSize(bytes: number): string | null {
  if (bytes > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(bytes)}). Maximum size is ${formatBytes(MAX_UPLOAD_BYTES)} on the free plan.`
  }
  return null
}
