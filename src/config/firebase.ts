/**
 * ─────────────────────────────────────────────────────────────
 *  YOUR FIREBASE WEB APP CONFIG — paste it between the backticks
 * ─────────────────────────────────────────────────────────────
 * Where to find it: Firebase console → ⚙ Project settings → General →
 * "Your apps" → your Web app (</>) → "SDK setup and configuration" → Config.
 *
 * Paste the snippet exactly as shown (the whole `const firebaseConfig = { … };`
 * block is fine). These values are public by design — every browser that opens
 * the app receives them — so it is safe to commit this file. Your service
 * account and Bunny password are secrets and must NOT go here.
 *
 * FIREBASE_* environment variables, if set, take priority over this file.
 */
export const FIREBASE_CONFIG_SNIPPET = `

`;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

/**
 * Leniently reads `key: "value"` pairs from a pasted Firebase snippet or JSON,
 * so both `apiKey: "…"` (JavaScript) and `"apiKey": "…"` (JSON) work.
 */
export function parseFirebaseConfig(text: string): Partial<FirebaseWebConfig> {
  const out: Record<string, string> = {};
  const pattern = /["']?(\w+)["']?\s*:\s*["'`]([^"'`]*)["'`]/g;
  for (const match of (text || '').matchAll(pattern)) {
    const value = match[2].trim();
    if (value) out[match[1]] = value;
  }
  return out as Partial<FirebaseWebConfig>;
}
