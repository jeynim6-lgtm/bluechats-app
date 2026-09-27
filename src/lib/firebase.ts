import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

export interface RuntimeConfig {
  firebase: FirebaseOptions | null;
  missing: string[];
  /** Config present but obviously wrong (e.g. placeholder API key). */
  problems?: string[];
  firebaseSource?: string | null;
  emulators: { auth: string | null; firestore: string | null } | null;
  features: { media: boolean; mediaCdn: boolean; turn: boolean };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let runtimeConfig: RuntimeConfig | null = null;

function supportsIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/** Loads config from the server and initialises Firebase. Safe to call more than once. */
export async function initFirebase(): Promise<RuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;

  const res = await fetch('/api/config', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load app configuration (HTTP ${res.status}).`);
  const config = (await res.json()) as RuntimeConfig;

  if (config.firebase) {
    app = initializeApp(config.firebase);
    auth = getAuth(app);
    auth.useDeviceLanguage();
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: supportsIndexedDb()
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });

    if (config.emulators?.auth) {
      connectAuthEmulator(auth, `http://${config.emulators.auth}`, { disableWarnings: true });
    }
    if (config.emulators?.firestore) {
      const [host, port] = config.emulators.firestore.split(':');
      connectFirestoreEmulator(db, host, Number(port));
    }
  }

  runtimeConfig = config;
  return config;
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return runtimeConfig;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase Auth is not initialised.');
  return auth;
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firestore is not initialised.');
  return db;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
