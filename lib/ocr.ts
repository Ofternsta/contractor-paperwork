import 'server-only'

const MAX_OCR_CHARS = 12_000

/** Extract text from images via Groq vision (OCR). */
export async function ocrImageFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return ''

  const base64 = buffer.toString('base64')
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64}`

  try {
    const { default: Groq } = await import('groq-sdk')
    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      temperature: 0,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all readable text from this image (${fileName}). Return plain text only — labels, amounts, dates, addresses, claim numbers. If no text is visible, reply with an empty string.`,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    })

    const text = completion.choices?.[0]?.message?.content?.trim() || ''
    if (text.length <= MAX_OCR_CHARS) return text
    return text.slice(0, MAX_OCR_CHARS)
  } catch (err) {
    console.error('OCR failed:', err)
    return ''
  }
}
