import { NextResponse } from 'next/server'
import { extractTextFromFile } from '@/lib/extract-text'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ text: '' })
    }

    const text = await extractTextFromFile(file)
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: 'Extraction failed' }, { status: 200 })
  }
}
