import { describeFile } from '@/lib/extract-text'

export function summarizeFile(
  file: File,
  extractedText: string,
  evidenceType: string
): string {
  const label = evidenceType || 'Evidence'
  const text = extractedText.trim()
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (text.length > 0) {
    const words = text.split(/\s+/).filter(Boolean).length
    const preview = text.replace(/\s+/g, ' ').slice(0, 280)
    const suffix = text.length > 280 ? '…' : ''
    return `${label}: ${describeFile(file)} — ${words} words extracted. Summary: ${preview}${suffix}`
  }

  if (isPdf) {
    return `${label}: ${describeFile(file)} — PDF stored, but no readable text was found. This often happens with scanned or image-only PDFs (e.g. exports from Copilot or screenshots).`
  }

  if (file.type.startsWith('image/')) {
    return `${label}: Photo/image ${describeFile(file)} — stored for claim documentation.`
  }

  if (file.type.startsWith('video/')) {
    return `${label}: Video ${describeFile(file)} — stored for claim documentation.`
  }

  if (file.type.startsWith('audio/')) {
    return `${label}: Audio ${describeFile(file)} — stored for claim documentation.`
  }

  return `${label}: ${describeFile(file)} — file stored successfully.`
}

/** @deprecated Use summarizeFile; kept for /api/summarize compatibility */
export async function summarizeText(text: string): Promise<string> {
  if (!text.trim()) return 'No text provided'
  const preview = text.replace(/\s+/g, ' ').slice(0, 280)
  return preview.length < text.length ? `${preview}…` : preview
}
