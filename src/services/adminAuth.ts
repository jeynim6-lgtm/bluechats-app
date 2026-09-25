/**
 * Admin Authentication & Firebase Custom Claims Client Service
 *
 * Enforces server-authoritative role verification with session caching.
 * Admin/CEO privileges are NEVER verified via client-side hardcoded lists
 * or readable database fields.
 */

import { auth } from './firebaseClient';

export interface VerifyCeoClaimsResponse {
  authorized: boolean;
  role?: 'ceo';
  claims?: {
    role: string;
    admin: boolean;
    ceo: boolean;
  };
  claimToken?: string;
  error?: string;
}

interface SessionCacheEntry {
  email: string;
  authorized: boolean;
  role?: 'ceo';
  claims?: {
    role: string;
    admin: boolean;
    ceo: boolean;
  };
  claimToken?: string;
  timestamp: number;
}

const SESSION_CACHE_KEY = 'bluechats_ceo_session_cache_v2';
const CLAIM_TOKEN_STORAGE_KEY = 'bluechats_ceo_claim_token';

// In-memory singletons for the active session
let memoryCache: SessionCacheEntry | null = null;
let cachedClaimToken: string | null = null;
let cachedRole: string | null = null;
let inFlightVerification: Promise<VerifyCeoClaimsResponse> | null = null;

// Initialize from sessionStorage if available
try {
  cachedClaimToken = sessionStorage.getItem(CLAIM_TOKEN_STORAGE_KEY);
  const rawCache = sessionStorage.getItem(SESSION_CACHE_KEY);
  if (rawCache) {
    memoryCache = JSON.parse(rawCache);
    if (memoryCache?.claimToken) {
      cachedClaimToken = memoryCache.claimToken;
      cachedRole = memoryCache.role || null;
    }
  }
} catch {}

/**
 * Validates whether a token string has standard 3-segment JWT format (header.payload.signature).
 */
export function isValidJwtFormat(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Requirement (1): Waits until the user's auth token is fully loaded before calling verification.
 * Resolves to the string JWT token once Firebase Auth has initialized, or null if unauthenticated.
 */
export async function getLoadedAuthToken(): Promise<string | null> {
  if (!auth) return null;

  try {
    // 1. Wait for Firebase Auth state to be ready
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }

    // 2. If currentUser is not yet populated, wait briefly for onAuthStateChanged
    if (!auth.currentUser) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const unsubscribe = auth!.onAuthStateChanged(() => {
          if (!settled) {
            settled = true;
            try { unsubscribe(); } catch {}
            resolve();
          }
        });
        // Short timeout (1.5s) to avoid blocking when no user is signed in
        setTimeout(() => {
          if (!settled) {
            settled = true;
            try { unsubscribe(); } catch {}
            resolve();
          }
        }, 1500);
      });
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const token = await currentUser.getIdToken(false);
    return isValidJwtFormat(token) ? token : null;
  } catch (err) {
    console.warn('[Auth] Notice waiting for auth token:', err);
    return null;
  }
}

/**
 * Requirement (2): Checks once per session and caches the result.
 * Synchronously checks if the session has already verified the given email.
 */
export function getCachedCeoStatus(userEmail?: string): VerifyCeoClaimsResponse | null {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  if (memoryCache && memoryCache.email === cleanEmail) {
    return {
      authorized: memoryCache.authorized,
      role: memoryCache.role,
      claims: memoryCache.claims,
      claimToken: memoryCache.claimToken,
    };
  }

  // Fallback to sessionStorage check
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const parsed: SessionCacheEntry = JSON.parse(raw);
      if (parsed.email === cleanEmail) {
        memoryCache = parsed;
        if (parsed.claimToken) {
          cachedClaimToken = parsed.claimToken;
          cachedRole = parsed.role || null;
        }
        return {
          authorized: parsed.authorized,
          role: parsed.role,
          claims: parsed.claims,
          claimToken: parsed.claimToken,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Internal helper to save result to session cache.
 */
function saveSessionResult(email: string, res: VerifyCeoClaimsResponse) {
  const entry: SessionCacheEntry = {
    email,
    authorized: res.authorized,
    role: res.role,
    claims: res.claims,
    claimToken: res.claimToken,
    timestamp: Date.now(),
  };

  memoryCache = entry;

  if (res.claimToken) {
    cachedClaimToken = res.claimToken;
    cachedRole = res.role || null;
    try {
      sessionStorage.setItem(CLAIM_TOKEN_STORAGE_KEY, res.claimToken);
    } catch {}
  }

  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

/**
 * Primary verified role checker meeting all 3 criteria:
 * (1) Waits until user's auth token is fully loaded.
 * (2) Only checks once per session or caches result instead of re-checking on every screen change.
 * (3) Doesn't fire the check at all if there's no valid token yet.
 */
export async function verifyCeoClaimsOncePerSession(
  userEmail?: string,
  explicitIdToken?: string
): Promise<VerifyCeoClaimsResponse> {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { authorized: false, error: 'No user email provided.' };
  }

  // Requirement (2): Return cached result if already checked this session (0 network calls)
  const cached = getCachedCeoStatus(cleanEmail);
  if (cached) {
    return cached;
  }

  // Deduplicate in-flight requests (prevents React StrictMode double invocation)
  if (inFlightVerification) {
    return inFlightVerification;
  }

  inFlightVerification = (async () => {
    try {
      // Requirement (1): Wait until the auth token is fully loaded
      let idTokenToUse = explicitIdToken;
      if (!idTokenToUse) {
        idTokenToUse = (await getLoadedAuthToken()) || undefined;
      }

      // Check if we have an existing verified session claim token to validate
      const existingClaimToken = cachedClaimToken || sessionStorage.getItem(CLAIM_TOKEN_STORAGE_KEY);

      // Requirement (3): Doesn't fire the check at all if there's no valid token yet
      const hasValidJwt = isValidJwtFormat(idTokenToUse);
      const hasValidClaimToken = Boolean(existingClaimToken && existingClaimToken.startsWith('claim_'));

      if (!hasValidJwt && !hasValidClaimToken) {
        // No valid authentication token available yet — do NOT make request that fails decoding
        const unverifiedResult: VerifyCeoClaimsResponse = {
          authorized: false,
          error: 'Waiting for valid authentication token.',
        };
        // Don't permanently cache failure if auth is just pending
        return unverifiedResult;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Pass verified server claim token in dedicated header
      if (hasValidClaimToken && existingClaimToken) {
        headers['x-ceo-claim-token'] = existingClaimToken;
      }

      // Only attach Authorization Bearer if we have an actual valid JWT
      if (hasValidJwt && idTokenToUse) {
        headers['Authorization'] = `Bearer ${idTokenToUse}`;
      }

      const res = await fetch('/api/admin/verify-claims', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: cleanEmail,
          idToken: hasValidJwt ? idTokenToUse : undefined,
        }),
      });

      const data: VerifyCeoClaimsResponse = await res.json();

      if (res.ok && data.authorized) {
        saveSessionResult(cleanEmail, data);
        return data;
      }

      const failedResult: VerifyCeoClaimsResponse = {
        authorized: false,
        error: data.error || 'Access denied: Valid CEO custom claims required.',
      };
      saveSessionResult(cleanEmail, failedResult);
      return failedResult;
    } catch (err: any) {
      return {
        authorized: false,
        error: err.message || 'Server claims verification failed.',
      };
    } finally {
      inFlightVerification = null;
    }
  })();

  return inFlightVerification;
}

/**
 * Backward-compatible wrapper for direct calls, routing through the session cache.
 */
export async function verifyCeoClaimsOnServer(
  userEmail?: string,
  idToken?: string
): Promise<VerifyCeoClaimsResponse> {
  return verifyCeoClaimsOncePerSession(userEmail, idToken);
}

/**
 * Returns the verified CEO claim token for authenticating Admin API requests.
 */
export function getCeoClaimToken(): string | null {
  return cachedClaimToken;
}

/**
 * Returns authorization headers containing the verified CEO claim token.
 */
export function getCeoAuthHeaders(): Record<string, string> {
  const token = getCeoClaimToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'x-ceo-claim-token': token,
  };
}

/**
 * Clears cached claims on logout or user switch.
 */
export function clearCeoSession(): void {
  cachedClaimToken = null;
  cachedRole = null;
  memoryCache = null;
  inFlightVerification = null;
  try {
    sessionStorage.removeItem(CLAIM_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {}
}
