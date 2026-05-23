/**
 * Book-only logo → PNG + app icons + favicon.ico (replaces default Vercel triangle).
 * Usage: node scripts/optimize-logo-icon.mjs [input]
 */
import sharp from 'sharp'
import { existsSync, renameSync, unlinkSync, copyFileSync } from 'fs'

const input =
  process.argv[2] ||
  'public/logo-icon.png'

if (!existsSync(input)) {
  console.error(`Missing ${input}`)
  process.exit(1)
}

const meta = await sharp(input).metadata()
const srcW = meta.width ?? 1024
const srcH = meta.height ?? 769

const publicIcon = 'public/logo-icon.png'
await sharp(input).png({ compressionLevel: 9 }).toFile('public/logo-icon.tmp.png')
try {
  unlinkSync(publicIcon)
} catch {
  /* missing */
}
renameSync('public/logo-icon.tmp.png', publicIcon)

async function squareIcon(size, outPath) {
  const inner = Math.round(size * 0.9)
  const resized = await sharp(input)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(outPath)
}

await squareIcon(512, 'app/icon.png')
await squareIcon(180, 'app/apple-icon.png')
copyFileSync('app/icon.png', 'public/icon.png')
copyFileSync('app/apple-icon.png', 'public/apple-icon.png')

console.log(
  `logo-icon ${srcW}×${srcH} → public/logo-icon.png, app/icon.png, public/icon.png, app/apple-icon.png`
)
