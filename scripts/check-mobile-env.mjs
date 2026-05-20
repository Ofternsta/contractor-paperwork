import { readFileSync, existsSync } from 'fs'

const envPath = '.env.local'
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]
const mobileUrl = 'CAPACITOR_SERVER_URL'

let ok = true

if (!existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}

const env = readFileSync(envPath, 'utf8')
const values = {}

for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) values[m[1].trim()] = m[2].trim()
}

for (const key of required) {
  if (!values[key]) {
    console.error(`Missing ${key} in .env.local`)
    ok = false
  }
}

const serverUrl = values[mobileUrl]
if (!serverUrl) {
  console.error(`
CAPACITOR_SERVER_URL is not set in .env.local

Native apps load your DEPLOYED site (not your PC's local IP).
Deploy to Vercel first, then add:

  CAPACITOR_SERVER_URL=https://your-app.vercel.app

`)
  ok = false
} else if (!serverUrl.startsWith('https://')) {
  console.warn(`Warning: ${mobileUrl} should use HTTPS for App Store builds`)
} else {
  console.log(`Mobile app will load: ${serverUrl}`)
}

if (!ok) process.exit(1)
