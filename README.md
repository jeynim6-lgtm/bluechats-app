# Blue Chats

Real-time messaging, voice & video calls, 24-hour status stories, a public Discover feed and wallet pre-registration — built with React 19, Firebase (Phone Auth + Firestore), Bunny.net storage and WebRTC.

## Features

| Area | What works |
| --- | --- |
| **Sign-in** | Firebase Phone Auth with real SMS codes (invisible reCAPTCHA, 6-digit code, resend cooldown). New users create a profile; returning users go straight in. |
| **Chats** | 1-to-1 and group chats in real time: read receipts, typing indicators, unread badges, replies, reactions, delete-for-everyone, search, offline cache. |
| **Media** | Photos (auto-compressed), videos, documents, voice notes, camera capture, location and contact cards. Files upload to **Bunny.net Storage** through an authenticated server proxy, with progress and cancel. |
| **Calls** | Live **WebRTC** voice & video between two devices. Firestore signalling, ringtone/ringback, accept/decline/busy/missed, mute, camera on/off, front/back camera switch, optional recording (the other side is notified), call history. |
| **Status** | Text, photo and video stories that expire after 24 h, with viewer lists and sponsored cards (tracked impressions/clicks). |
| **Discover** | Public photo/video feed with stars, live comments, follows and friend requests. |
| **Contacts** | Add people by phone number, import from the phone's address book (Android Chrome), invite people who aren't on the app, block/report. |
| **Wallet** | Pre-registration only (masked document number + hash — the full number never leaves the device); live progress towards the unlock goal. |
| **Admin** | CEO dashboard protected by a server-assigned Firebase custom claim: users, bug reports, user reports, wallet sign-ups, sponsored-card analytics, system health check. |
| **Customisation** | Branding, colours and sponsored cards in one file (`src/config/branding.ts`); in-app accent colours, dark mode and 8 languages (navigation & core actions). Installable as a PWA. |

## Architecture

```
Browser (React)  ──Firebase SDK──▶  Firebase Auth (SMS) + Firestore (data, call signalling, security rules)
       │
       └──HTTPS + ID token──▶  Express server (server.ts)
                                 ├─ /api/config              runtime Firebase web config
                                 ├─ /api/media/*             Bunny.net upload / stream / delete (credentials stay server-side)
                                 ├─ /api/webrtc/ice-servers  STUN + TURN credentials
                                 └─ /api/admin/*             CEO claim verification & health check
WebRTC media flows directly between the two devices (or via your TURN relay).
```

## Go-live checklist

1. **Firebase project**
   - Create a Web app (*Project settings → Your apps → Add app → Web*) and paste its `firebaseConfig` block into **`src/config/firebase.ts`** (these values are public and safe to commit). Alternatively set the `FIREBASE_*` or `FIREBASE_WEB_CONFIG` environment variables. Enabling Phone sign-in alone is not enough — the app needs this config to know which project to use.
   - *Authentication → Sign-in method →* enable **Phone**. The iOS/Android steps in Firebase's docs (APNs, SHA fingerprints) are for native apps and aren't needed for this web app. SMS sign-in requires the Blaze plan for production volumes; add test numbers under *Phone numbers for testing* for development.
   - *Authentication → Settings → Authorized domains →* add the domain the app is served from.
   - Deploy rules and indexes: set your project ID in `.firebaserc`, then run `npm run deploy:rules`.
   - Recommended: *Firestore → TTL policies →* collection `statuses`, field `expiresAt` (auto-deletes expired stories).
2. **Bunny.net** — create a Storage Zone (a Johannesburg region is close to South African users), then set `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY` (the zone *password*) and `BUNNY_STORAGE_REGION`. Connect a Pull Zone and set `BUNNY_CDN_URL` to serve media from the CDN.
3. **TURN relay** — set one of the `TURN_*` / `CLOUDFLARE_TURN_*` options. Without TURN, calls between some mobile, corporate or hotel networks can't connect.
4. **CEO access** — set `CEO_PHONE_NUMBERS` and `FIREBASE_SERVICE_ACCOUNT`, then open *Settings → CEO dashboard* while signed in with that number. You can also run `npm run grant-ceo-claims -- +27821234567` with a service account.
5. **Customise** — edit `src/config/branding.ts` (name, colours, sponsored cards, wallet goal).

The app shows a setup screen listing any missing Firebase variables, and *Settings → Storage & connectivity* has a live Bunny upload test.

## Development

```bash
npm install
cp .env.example .env        # fill in values
npm run dev                 # http://localhost:3000
```

Without a Firebase project you can run everything locally against the emulators (needs Java):

```bash
npm run emulators           # terminal 1 — Auth + Firestore emulators
npm run dev:emulators       # terminal 2 — SMS codes appear in the emulator log
```

## Tests

```bash
npm run lint                # TypeScript
npm run test:rules          # Firestore security rules (emulator)
npm run build && npm run test:e2e   # two-browser end-to-end test (emulators + mock Bunny + Chromium)
```

The E2E test signs two users up by SMS, then exercises messaging, receipts, typing, photo and voice uploads, a live video call with media in both directions, decline/busy handling, status, Discover, blocking, the CEO dashboard, theming and logout. It needs Chromium for Playwright (`npx playwright install chromium`).

## Production

```bash
npm run build               # builds the client (dist/) and bundles the server (server.js)
npm start                   # NODE_ENV=production node server.js
```

## Known limitations

- Calls and messages alert you while the app is open (including in a background tab). Push notifications when the app is fully closed need Firebase Cloud Messaging and a service worker, which aren't set up yet.
- Messages are protected by Firestore security rules and TLS but are not end-to-end encrypted. Call media *is* encrypted end-to-end (DTLS-SRTP).
- Media links are unguessable but not access-controlled: anyone holding a link can open that file.
- isiZulu and Sesotho translations cover navigation only and should be reviewed by a native speaker.
