/**
 * Centralised, validated server configuration.
 *
 * Every credential is read from the environment (or a local `.env` file) —
 * nothing secret is hardcoded. See `.env.example` for the full list.
 */

function read(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() && !value.startsWith('MY_')) return value.trim();
  }
  return '';
}

function list(...names: string[]): string[] {
  return read(...names)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const BUNNY_REGION_HOSTS: Record<string, string> = {
  de: 'storage.bunnycdn.com',
  falkenstein: 'storage.bunnycdn.com',
  uk: 'uk.storage.bunnycdn.com',
  ny: 'ny.storage.bunnycdn.com',
  la: 'la.storage.bunnycdn.com',
  sg: 'sg.storage.bunnycdn.com',
  se: 'se.storage.bunnycdn.com',
  br: 'br.storage.bunnycdn.com',
  jh: 'jh.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com',
};

function bunnyEndpoint(): string {
  // Full base URL override (useful for tests or custom proxies), e.g. http://127.0.0.1:9199
  const explicit = read('BUNNY_STORAGE_ENDPOINT');
  if (explicit) return explicit.replace(/\/+$/, '');
  const host = read('BUNNY_STORAGE_HOST', 'BUNNY_HOST');
  if (host) return `https://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  const region = read('BUNNY_STORAGE_REGION').toLowerCase();
  return `https://${BUNNY_REGION_HOSTS[region] || BUNNY_REGION_HOSTS.de}`;
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProd: process.env.NODE_ENV === 'production',

  /** Public Firebase web config — safe to send to browsers. */
  firebase: {
    apiKey: read('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
    authDomain: read('FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: read('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT'),
    storageBucket: read('FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: read('FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: read('FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
    measurementId: read('FIREBASE_MEASUREMENT_ID', 'VITE_FIREBASE_MEASUREMENT_ID'),
  },

  /** Standard Firebase emulator variables (also read by firebase-admin). */
  emulators: {
    auth: read('FIREBASE_AUTH_EMULATOR_HOST'),
    firestore: read('FIRESTORE_EMULATOR_HOST'),
  },

  /** Service account JSON (raw or base64) for firebase-admin write operations such as custom claims. */
  serviceAccount: read('FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON'),

  /** Accounts that are promoted to CEO/admin on first verified sign-in. */
  ceoEmails: list('CEO_EMAILS').map((e) => e.toLowerCase()),
  ceoPhoneNumbers: list('CEO_PHONE_NUMBERS').map((p) => p.replace(/[^\d+]/g, '')),

  bunny: {
    storageZone: read('BUNNY_STORAGE_ZONE'),
    apiKey: read('BUNNY_STORAGE_API_KEY', 'BUNNY_ACCESS_KEY', 'BUNNY_STORAGE_PASSWORD'),
    endpoint: bunnyEndpoint(),
    /** Pull-zone base URL, e.g. https://bluechats.b-cdn.net — when set, media is served directly from the CDN. */
    cdnUrl: read('BUNNY_CDN_URL', 'BUNNY_PULL_ZONE_URL').replace(/\/+$/, ''),
    /** Optional account API key, used only to purge CDN cache when a file is deleted. */
    accountApiKey: read('BUNNY_ACCOUNT_API_KEY'),
  },

  webrtc: {
    stunUrls: list('STUN_URLS').length
      ? list('STUN_URLS')
      : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    turnUrls: list('TURN_URLS'),
    turnUsername: read('TURN_USERNAME'),
    turnCredential: read('TURN_CREDENTIAL', 'TURN_PASSWORD'),
    turnSharedSecret: read('TURN_SHARED_SECRET'),
    turnTtlSeconds: parseInt(process.env.TURN_TTL_SECONDS || '86400', 10),
    cloudflareKeyId: read('CLOUDFLARE_TURN_KEY_ID'),
    cloudflareApiToken: read('CLOUDFLARE_TURN_API_TOKEN'),
  },
};

export const bunnyConfigured = Boolean(env.bunny.storageZone && env.bunny.apiKey);

export const turnConfigured = Boolean(
  (env.webrtc.turnUrls.length && ((env.webrtc.turnUsername && env.webrtc.turnCredential) || env.webrtc.turnSharedSecret)) ||
    (env.webrtc.cloudflareKeyId && env.webrtc.cloudflareApiToken)
);

/** Firebase web config keys that must be present for the client to boot. */
export function missingFirebaseConfig(): string[] {
  const required: Array<[keyof typeof env.firebase, string]> = [
    ['apiKey', 'FIREBASE_API_KEY'],
    ['authDomain', 'FIREBASE_AUTH_DOMAIN'],
    ['projectId', 'FIREBASE_PROJECT_ID'],
    ['appId', 'FIREBASE_APP_ID'],
  ];
  return required.filter(([key]) => !env.firebase[key]).map(([, name]) => name);
}
