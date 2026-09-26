import { getFirebaseAuth } from './firebase';

export async function getIdToken(forceRefresh = false): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You are signed out. Please sign in again.');
  return user.getIdToken(forceRefresh);
}

/** fetch() that attaches the signed-in user's Firebase ID token and throws readable errors. */
export async function apiFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (HTTP ${res.status})`);
    (err as Error & { status?: number; data?: unknown }).status = res.status;
    (err as Error & { data?: unknown }).data = data;
    throw err;
  }
  return data as T;
}
