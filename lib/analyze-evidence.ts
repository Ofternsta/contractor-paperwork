import 'server-only'
import {
  EVIDENCE_TYPES,
  type EvidenceType,
  guessEvidenceTypeFromFile,
  normalizeEvidenceType,
} from '@/lib/evidence-types'
import { summarizeFile } from '@/lib/summarize-text'

export type EvidenceAnalysis = {
  evidenceType: EvidenceType
  summary: string
}

export async function analyzeEvidence(
  file: File,
  extractedText: string
): Promise<EvidenceAnalysis> {
  const fallbackType = guessEvidenceTypeFromFile(file)
  const fallbackSummary = summarizeFile(file, extractedText, fallbackType)

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { evidenceType: fallbackType, summary: fallbackSummary }
  }

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You analyze restoration/insurance claim evidence files.

Return JSON only:
{
  "category": "<one of: ${EVIDENCE_TYPES.join(', ')}>",
  "summary": "<1-2 factual sentences about the file using ONLY provided information>"
}

Category rules:
- Damage Photo: property damage photos, mold, water/fire damage, job site images
- Invoice: bills, receipts, paid invoices
- Estimate: repair estimates, scopes, quotes, Xactimate
- Moisture Reading: moisture logs, hygrometer readings, drying charts
- Insurance Email: insurer/adjuster emails or letters
- Report: inspection/engineering/lab reports, claim summaries, Copilot/PDF reports
- Other: does not fit above

Never invent facts not in the file content or filename.`,
        },
        {
          role: 'user',
          content: `File name: ${file.name}
MIME type: ${file.type || 'unknown'}

Content:
${extractedText.trim() || '(No text could be extracted — classify from filename and file type.)'}`,
        },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      return { evidenceType: fallbackType, summary: fallbackSummary }
    }

    const parsed = JSON.parse(raw) as {
      category?: string
      summary?: string
    }

    const evidenceType = normalizeEvidenceType(parsed.category || fallbackType)
    const summary =
      parsed.summary?.trim() ||
      summarizeFile(file, extractedText, evidenceType)

    return {
      evidenceType,
      summary: `${evidenceType}: ${file.name} — ${summary}`,
    }
  } catch (err) {
    console.error('Evidence analysis failed:', err)
    return { evidenceType: fallbackType, summary: fallbackSummary }
  }
}
