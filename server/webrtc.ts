import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env, turnConfigured } from './env.ts';
import { requireAuth } from './firebaseAdmin.ts';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

let cloudflareCache: { servers: IceServer[]; expiresAt: number } | null = null;

async function cloudflareIceServers(): Promise<IceServer[]> {
  const { cloudflareKeyId, cloudflareApiToken, turnTtlSeconds } = env.webrtc;
  if (!cloudflareKeyId || !cloudflareApiToken) return [];
  if (cloudflareCache && cloudflareCache.expiresAt > Date.now()) return cloudflareCache.servers;

  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(cloudflareKeyId)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cloudflareApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: turnTtlSeconds }),
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare TURN returned HTTP ${res.status}`);
  const data = (await res.json()) as { iceServers: IceServer | IceServer[] };
  const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
  // Refresh well before the credentials expire.
  cloudflareCache = { servers, expiresAt: Date.now() + (turnTtlSeconds * 1000) / 2 };
  return servers;
}

/** Time-limited credentials for coturn's `use-auth-secret` (TURN REST API) mode. */
function sharedSecretIceServer(uid: string): IceServer | null {
  const { turnUrls, turnSharedSecret, turnTtlSeconds } = env.webrtc;
  if (!turnUrls.length || !turnSharedSecret) return null;
  const username = `${Math.floor(Date.now() / 1000) + turnTtlSeconds}:${uid}`;
  const credential = crypto.createHmac('sha1', turnSharedSecret).update(username).digest('base64');
  return { urls: turnUrls, username, credential };
}

export const webrtcRouter = Router();

webrtcRouter.get('/api/webrtc/ice-servers', requireAuth, async (_req: Request, res: Response) => {
  const iceServers: IceServer[] = [{ urls: env.webrtc.stunUrls }];
  const { turnUrls, turnUsername, turnCredential } = env.webrtc;

  const shared = sharedSecretIceServer(res.locals.user.uid);
  if (shared) iceServers.push(shared);
  else if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
  }

  try {
    iceServers.push(...(await cloudflareIceServers()));
  } catch (err) {
    console.warn('[webrtc] Cloudflare TURN unavailable:', (err as Error).message);
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ iceServers, relay: turnConfigured });
});
