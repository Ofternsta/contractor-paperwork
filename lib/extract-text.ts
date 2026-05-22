import 'server-only'
import { ocrImageFromBuffer } from '@/lib/ocr'

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.log',
  '.rtf',
  '.eml',
  '.msg',
])

const MAX_EXTRACT_CHARS = 50_000

function extension(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function isTextLike(file: File) {
  if (file.type.startsWith('text/')) return true
  return TEXT_EXTENSIONS.has(extension(file.name))
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text?.trim() || ''
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extension(file.name)

  if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(file.name)) {
    const ocr = await ocrImageFromBuffer(buffer, file.type || 'image/jpeg', file.name)
    if (ocr) return truncate(ocr)
    return ''
  }

  if (ext === '.docx' || file.type.includes('wordprocessingml')) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return truncate(result.value || '')
    } catch {
      return ''
    }
  }

  if (ext === '.pdf' || file.type === 'application/pdf') {
    try {
      const text = await extractPdfText(buffer)
      if (text) return truncate(text)
    } catch (err) {
      console.error('PDF text extraction failed:', err)
    }
    return ''
  }

  if (isTextLike(file)) {
    try {
      return truncate(buffer.toString('utf8'))
    } catch {
      return ''
    }
  }

  return ''
}

function truncate(text: string) {
  const trimmed = text.replace(/\0/g, '').trim()
  if (trimmed.length <= MAX_EXTRACT_CHARS) return trimmed
  return trimmed.slice(0, MAX_EXTRACT_CHARS)
}

export { describeFile } from '@/lib/file-meta'
