import { Router, type Request, type Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { env, bunnyConfigured, turnConfigured } from './env.ts';
import {
  requireAuth,
  requireCeo,
  hasCeoClaim,
  isDesignatedCeo,
  canWriteAuth,
  grantCeoClaims,
  getAdminApp,
} from './firebaseAdmin.ts';
import { checkBunnyConnectivity } from './media.ts';

type Health = { status: 'healthy' | 'degraded' | 'failing'; message: string };

export const adminRouter = Router();

/**
 * Confirms CEO access for the signed-in caller.
 * Access is granted ONLY from a cryptographically verified Firebase ID token:
 *  - the token already carries the `ceo` custom claim, or
 *  - the token's verified phone number / email is on the server-side CEO list,
 *    in which case the claim is attached so Firestore rules recognise it too.
 */
async function verifyHandler(_req: Request, res: Response) {
  const token = res.locals.user as DecodedIdToken;

  if (hasCeoClaim(token)) {
    return res.json({ authorized: true, claimsActive: true, role: 'ceo' });
  }

  if (!isDesignatedCeo(token)) {
    // Not an error for the client — most users simply aren't admins. Data stays protected by Firestore rules.
    return res.json({ authorized: false, claimsActive: false, error: 'This account is not a CEO/admin.' });
  }

  if (!canWriteAuth()) {
    return res.json({
      authorized: true,
      claimsActive: false,
      role: 'ceo',
      setupRequired:
        'Your account is designated as CEO, but the server has no Firebase service account, so the "ceo" claim ' +
        'cannot be attached. Set FIREBASE_SERVICE_ACCOUNT or run `npm run grant-ceo-claims`.',
    });
  }

  try {
    await grantCeoClaims(token.uid);
    res.json({ authorized: true, claimsActive: false, refreshToken: true, role: 'ceo' });
  } catch (err) {
    console.error('[admin] Failed to attach CEO claims:', err);
    res.status(500).json({ authorized: true, claimsActive: false, error: 'Could not attach CEO claims.' });
  }
}

adminRouter.post('/api/admin/verify', requireAuth, verifyHandler);
adminRouter.post('/api/admin/verify-claims', requireAuth, verifyHandler);

adminRouter.get('/api/admin/health-check', requireCeo, async (_req: Request, res: Response) => {
  const token = res.locals.user as DecodedIdToken;

  const auth: Health = hasCeoClaim(token)
    ? { status: 'healthy', message: 'ID token verified; "ceo" custom claim active' }
    : { status: 'degraded', message: 'Designated CEO but claim not yet attached — refresh or grant claims' };

  let firestore: Health = {
    status: 'healthy',
    message: 'Client access enforced by Firestore security rules',
  };
  if (canWriteAuth() && (env.serviceAccount || env.emulators.firestore)) {
    try {
      const { getFirestore } = await import('firebase-admin/firestore');
      const snap = await getFirestore(getAdminApp()!).collection('users').count().get();
      firestore = { status: 'healthy', message: `Firestore reachable — ${snap.data().count} user profiles` };
    } catch (err) {
      firestore = { status: 'failing', message: `Firestore check failed: ${(err as Error).message}` };
    }
  }

  const bunnyCheck = await checkBunnyConnectivity();
  const bunny: Health = bunnyCheck.ok
    ? { status: 'healthy', message: `${bunnyCheck.message}${env.bunny.cdnUrl ? ` · CDN ${env.bunny.cdnUrl}` : ' · served via /api/media proxy'}` }
    : { status: bunnyConfigured ? 'failing' : 'degraded', message: bunnyCheck.message };

  const webrtc: Health = turnConfigured
    ? { status: 'healthy', message: 'STUN + TURN relay configured' }
    : { status: 'degraded', message: 'STUN only — calls may fail behind strict NAT. Configure TURN_* env vars.' };

  const server: Health = {
    status: 'healthy',
    message: `Uptime ${Math.floor(process.uptime())}s · Node ${process.version}`,
  };

  res.json({ health: { auth, firestore, server, bunny, webrtc, timestamp: new Date().toISOString() } });
});
