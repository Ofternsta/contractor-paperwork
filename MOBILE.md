# Mobile & App Store guide

Your phone cannot reach `localhost` or `192.168.x.x` when your PC is on Ethernet and your phone is on cellular or another network. **Native apps load your deployed HTTPS URL instead** — works anywhere.

## Overview

| Option | App Store? | Works off Wi‑Fi? |
|--------|------------|------------------|
| **Capacitor (iOS/Android)** | Yes | Yes — loads deployed URL |
| PWA (Add to Home Screen) | No | Yes — after deploy |

This project uses **Capacitor** for an App Store–like native shell (camera, splash screen, full screen).

---

## Step 1: Deploy to Vercel (free)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Add environment variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY` (optional)
4. Deploy. Copy your URL, e.g. `https://contractor-paperwork.vercel.app`.

---

## Step 2: Point the native app at your deployment

Add to `.env.local`:

```env
CAPACITOR_SERVER_URL=https://your-app.vercel.app
```

Verify:

```bash
npm run mobile:check
```

---

## Step 3: Build native projects

```bash
npm install
npm run cap:sync
```

### Android (Windows supported)

1. Install [Android Studio](https://developer.android.com/studio).
2. Run:

```bash
npm run cap:android
```

3. In Android Studio: **Run** on a device or emulator.
4. For Play Store: **Build → Generate Signed Bundle / APK**.

### iOS (requires a Mac)

1. Install Xcode from the Mac App Store.
2. Run:

```bash
npm run cap:ios
```

3. In Xcode: select your team, set bundle ID `com.contractor.paperwork`, run on device.
4. For App Store: **Product → Archive** → upload to App Store Connect.

---

## App Store requirements

- **Apple Developer Program** — $99/year ([developer.apple.com](https://developer.apple.com))
- **Google Play Console** — one-time $25 ([play.google.com/console](https://play.google.com/console))
- App icons & screenshots (generated from the running app)
- Privacy policy URL (required by Apple — host a simple page on your site)

---

## Native features included

- Full-screen app (no browser chrome)
- Native camera via Capacitor on iOS/Android
- Splash screen & status bar styling
- Same AI upload, categorization, and Supabase storage as the web app

---

## PWA (no App Store, still works everywhere)

After deploying, open your Vercel URL on your phone:

- **iPhone:** Safari → Share → **Add to Home Screen**
- **Android:** Chrome → **Install app**

No Mac or Android Studio required.

---

## Troubleshooting

**Blank white screen in the native app**  
→ `CAPACITOR_SERVER_URL` is missing or wrong. Run `npm run mobile:check` and `npm run cap:sync`.

**Camera permission denied**  
→ Enable Camera in iOS Settings / Android app permissions for Contractor Paperwork.

**Upload fails in the app**  
→ Confirm the Vercel deployment has the same Supabase env vars and that the site works in mobile Safari first.
