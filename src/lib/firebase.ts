import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCrQW-1oX2JPVssP6qh-ivB7ibH_8Psouk',
  authDomain: 'bluechats-bb3e9.firebaseapp.com',
  projectId: 'bluechats-bb3e9',
  storageBucket: 'bluechats-bb3e9.firebasestorage.app',
  messagingSenderId: '629315738250',
  appId: '1:629315738250:web:cc16bb1c646f5efa5a2b73',
  measurementId: 'G-QXNVN8X81Y',
};

export interface RuntimeConfig {
  firebase: FirebaseOptions | null;
  missing: string[];
  emulators: { auth: string | null; firestore: string | null } | null;
  features: { media: boolean; mediaCdn: boolean; turn: boolean };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;
let runtimeConfig: RuntimeConfig | null = null;
let initPromise: Promise<RuntimeConfig> | null = null;

function supportsIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/** Loads config from the server (or falls back to default) and initialises Firebase. Safe to call concurrently or more than once. */
export function initFirebase(): Promise<RuntimeConfig> {
  if (runtimeConfig) return Promise.resolve(runtimeConfig);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let config: RuntimeConfig;
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        config = (await res.json()) as RuntimeConfig;
      } catch {
        config = {
          firebase: firebaseConfig,
          missing: [],
          emulators: null,
          features: { media: false, mediaCdn: false, turn: false },
        };
      }

      if (!config.firebase && firebaseConfig.apiKey) {
        config.firebase = firebaseConfig;
        config.missing = [];
      }

      if (config.firebase) {
        const apps = getApps();
        app = apps.length > 0 ? apps[0] : initializeApp(config.firebase);
        auth = getAuth(app);
        auth.useDeviceLanguage();

        try {
          db = initializeFirestore(app, {
            ignoreUndefinedProperties: true,
            localCache: supportsIndexedDb()
              ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
              : memoryLocalCache(),
          });
        } catch {
          // If already initialized (e.g. StrictMode or HMR), reuse the existing instance
          db = getFirestore(app);
        }

        if (config.firebase.measurementId && typeof window !== 'undefined') {
          isAnalyticsSupported()
            .then((supported) => {
              if (supported && app) {
                analytics = getAnalytics(app);
              }
            })
            .catch(() => {
              /* Analytics not supported in this environment */
            });
        }

        if (config.emulators?.auth) {
          try {
            connectAuthEmulator(auth, `http://${config.emulators.auth}`, { disableWarnings: true });
          } catch {
            /* already connected */
          }
        }
        if (config.emulators?.firestore) {
          try {
            const [host, port] = config.emulators.firestore.split(':');
            connectFirestoreEmulator(db, host, Number(port));
          } catch {
            /* already connected */
          }
        }
      }

      runtimeConfig = config;
      return config;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
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

export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}
