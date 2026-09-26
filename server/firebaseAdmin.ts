import { initializeApp, getApps, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env.ts';

let adminApp: App | null = null;
let credentialsLoaded = false;

function parseServiceAccount(raw: string): ServiceAccount | null {
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json) as ServiceAccount;
  } catch (err) {
    console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64 JSON:', (err as Error).message);
    return null;
  }
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }
  const projectId = env.firebase.projectId;
  if (!projectId) return null;

  const serviceAccount = parseServiceAccount(env.serviceAccount);
  credentialsLoaded = Boolean(serviceAccount) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  adminApp = initializeApp(serviceAccount ? { projectId, credential: cert(serviceAccount) } : { projectId });
  return adminApp;
}

/**
 * Privileged operations (custom claims) need a service account, except against the local emulator.
 * ID-token verification only needs the project ID.
 */
export function canWriteAuth(): boolean {
  getAdminApp();
  return credentialsLoaded || Boolean(env.emulators.auth);
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  const app = getAdminApp();
  if (!app || !token || token.split('.').length !== 3) return null;
  try {
    return await getAuth(app).verifyIdToken(token);
  } catch (err) {
    console.warn('[auth] ID token rejected:', (err as Error).message);
    return null;
  }
}

function bearer(req: Request): string {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/** Express middleware: requires a valid Firebase ID token; exposes it as `res.locals.user`. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const decoded = await verifyIdToken(bearer(req));
  if (!decoded) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  res.locals.user = decoded;
  next();
}

export function hasCeoClaim(token: DecodedIdToken): boolean {
  return token.ceo === true || token.role === 'ceo';
}

/** True when a verified identity (phone from SMS auth, or verified email) is on the server-side CEO list. */
export function isDesignatedCeo(token: DecodedIdToken): boolean {
  const phone = (token.phone_number || '').replace(/[^\d+]/g, '');
  if (phone && env.ceoPhoneNumbers.includes(phone)) return true;
  const email = (token.email || '').toLowerCase();
  return Boolean(email && token.email_verified && env.ceoEmails.includes(email));
}

export async function requireCeo(req: Request, res: Response, next: NextFunction) {
  const decoded = await verifyIdToken(bearer(req));
  if (!decoded) return res.status(401).json({ error: 'Sign in required.' });
  if (!hasCeoClaim(decoded) && !isDesignatedCeo(decoded)) {
    return res.status(403).json({ error: 'Forbidden: CEO/admin access required.' });
  }
  res.locals.user = decoded;
  next();
}

export async function grantCeoClaims(uid: string): Promise<void> {
  const app = getAdminApp();
  if (!app) throw new Error('Firebase project is not configured.');
  const auth = getAuth(app);
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), role: 'ceo', admin: true, ceo: true });
}
