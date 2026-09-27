import { FIREBASE_CONFIG_SNIPPET, parseFirebaseConfig, type FirebaseWebConfig } from '../src/config/firebase.ts';

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

// Firebase web config sources, highest priority first:
//   1. individual FIREBASE_* variables
//   2. FIREBASE_WEB_CONFIG — the whole console snippet (or JSON) in one variable
//   3. src/config/firebase.ts — snippet pasted into the repo
const firebaseFromEnvSnippet = parseFirebaseConfig(read('FIREBASE_WEB_CONFIG'));
const firebaseFromFile = parseFirebaseConfig(FIREBASE_CONFIG_SNIPPET);

function firebaseValue(key: keyof FirebaseWebConfig, ...envNames: string[]): string {
  return read(...envNames) || firebaseFromEnvSnippet[key] || firebaseFromFile[key] || '';
}

function firebaseSource(): string | null {
  if (read('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY')) return 'environment variables';
  if (firebaseFromEnvSnippet.apiKey) return 'FIREBASE_WEB_CONFIG variable';
  if (firebaseFromFile.apiKey) return 'src/config/firebase.ts';
  return null;
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
    apiKey: firebaseValue('apiKey', 'FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
    authDomain: firebaseValue('authDomain', 'FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: firebaseValue('projectId', 'FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT'),
    storageBucket: firebaseValue('storageBucket', 'FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: firebaseValue('messagingSenderId', 'FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: firebaseValue('appId', 'FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
    measurementId: firebaseValue('measurementId', 'FIREBASE_MEASUREMENT_ID', 'VITE_FIREBASE_MEASUREMENT_ID'),
  },
  firebaseSource: firebaseSource(),

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

// Values from the app's original generated code. Google rejects this API key, and the app ID is not a real one.
const KNOWN_BAD_API_KEYS = ['AIzaSyBwAgQfJzsuLWg073kD3NJ71UVBRizEs0Y'];
const KNOWN_BAD_APP_IDS = ['1:64519650154:web:bluechats'];

/** Human-readable problems with a Firebase config that is present but obviously wrong. */
export function firebaseConfigProblems(): string[] {
  const { apiKey, appId, authDomain, projectId } = env.firebase;
  if (env.emulators.auth) return []; // emulator mode accepts placeholder values
  const problems: string[] = [];
  if (KNOWN_BAD_API_KEYS.includes(apiKey)) {
    problems.push('The API key is the placeholder from the original app code, which Google rejects. Copy the apiKey from your own Firebase web app.');
  } else if (apiKey && !/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) {
    problems.push('The apiKey does not look like a Firebase web API key (it should start with "AIza" and be 39 characters).');
  }
  if (KNOWN_BAD_APP_IDS.includes(appId)) {
    problems.push('The appId is the placeholder from the original app code. Copy the appId from your own Firebase web app (it looks like 1:1234567890:web:abc123def456).');
  } else if (appId && !/^1:\d+:web:[0-9a-f]+$/i.test(appId)) {
    problems.push('The appId does not look right — it should look like 1:1234567890:web:abc123def456.');
  }
  if (authDomain && projectId && !authDomain.includes('.')) {
    problems.push('The authDomain should be a domain such as your-project.firebaseapp.com.');
  }
  return problems;
}
