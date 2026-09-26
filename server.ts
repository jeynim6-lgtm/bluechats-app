import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env, bunnyConfigured, turnConfigured, missingFirebaseConfig } from './server/env.ts';
import { mediaRouter } from './server/media.ts';
import { webrtcRouter } from './server/webrtc.ts';
import { adminRouter } from './server/admin.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
    next();
  });

  app.use('/api', express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'Blue Chats', time: new Date().toISOString() });
  });

  /** Runtime client configuration — lets the same build run against any Firebase project. */
  app.get('/api/config', (_req: Request, res: Response) => {
    const missing = missingFirebaseConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      firebase: missing.length ? null : env.firebase,
      missing,
      emulators: env.emulators.auth || env.emulators.firestore
        ? { auth: env.emulators.auth || null, firestore: env.emulators.firestore || null }
        : null,
      features: {
        media: bunnyConfigured,
        mediaCdn: Boolean(env.bunny.cdnUrl),
        turn: turnConfigured,
      },
    });
  });

  app.use(mediaRouter);
  app.use(webrtcRouter);
  app.use(adminRouter);

  // Unknown API routes should never fall through to the SPA's index.html.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  if (!env.isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' })
    );
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Blue Chats server listening on http://0.0.0.0:${env.port} (${env.isProd ? 'production' : 'development'})`);
    const missing = missingFirebaseConfig();
    if (missing.length) console.warn(`⚠  Firebase not configured — missing: ${missing.join(', ')}`);
    if (env.emulators.auth || env.emulators.firestore) {
      console.log(`   Using Firebase emulators: auth=${env.emulators.auth || '-'} firestore=${env.emulators.firestore || '-'}`);
    }
    console.log(`   Media storage: ${bunnyConfigured ? `Bunny zone "${env.bunny.storageZone}"${env.bunny.cdnUrl ? ` via ${env.bunny.cdnUrl}` : ''}` : 'NOT configured'}`);
    console.log(`   WebRTC relay (TURN): ${turnConfigured ? 'configured' : 'not configured (STUN only)'}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Blue Chats server:', err);
  process.exit(1);
});
