import type { CapacitorConfig } from '@capacitor/cli'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(__dirname, '.env.local') })

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: 'com.contractor.paperwork',
  appName: 'Contractor Paperwork',
  webDir: 'public/capacitor',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith('http://'),
        androidScheme: 'https',
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#171717',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#171717',
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
}

export default config
