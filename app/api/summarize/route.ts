import { NextResponse } from 'next/server'
import { summarizeText } from '@/lib/summarize-text'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    const summary = await summarizeText(text || '')
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ summary: 'Could not summarize text' }, { status: 200 })
  }
}
