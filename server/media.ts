import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { Readable } from 'stream';
import { env, bunnyConfigured } from './env.ts';
import { requireAuth } from './firebaseAdmin.ts';

const MB = 1024 * 1024;

const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'];
const VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-matroska'];
const AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/x-wav'];
const DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'application/zip',
  'text/plain',
  'text/csv',
];

/** Allowed media per logical folder. SVG/HTML are never accepted (stored XSS). */
export const FOLDER_POLICIES: Record<string, { maxBytes: number; types: string[] }> = {
  photos: { maxBytes: 25 * MB, types: IMAGE },
  videos: { maxBytes: 100 * MB, types: VIDEO },
  voice: { maxBytes: 25 * MB, types: AUDIO },
  docs: { maxBytes: 50 * MB, types: [...DOCS, ...IMAGE, ...VIDEO, ...AUDIO] },
  status: { maxBytes: 50 * MB, types: [...IMAGE, ...VIDEO] },
  discover: { maxBytes: 100 * MB, types: [...IMAGE, ...VIDEO] },
  avatars: { maxBytes: 5 * MB, types: IMAGE },
  calls: { maxBytes: 200 * MB, types: [...AUDIO, ...VIDEO] },
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/x-matroska': 'mkv',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'application/zip': 'zip',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const SERVE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/** Files that browsers should download rather than render inline. */
function isInlineExtension(ext: string) {
  return ext in SERVE_TYPES;
}

function normaliseMime(mime: string): string {
  return (mime || '').split(';')[0].trim().toLowerCase();
}

/** Accepts only paths produced by this server: folder/uid/yyyy/mm/uuid.ext */
const SAFE_PATH = /^[a-z]+\/[A-Za-z0-9_-]{1,128}\/\d{4}\/\d{2}\/[A-Za-z0-9-]{8,64}\.[a-z0-9]{2,5}$/;

export function publicUrlFor(path: string): string {
  return env.bunny.cdnUrl ? `${env.bunny.cdnUrl}/${path}` : `/api/media/file/${path}`;
}

function storageUrl(path: string) {
  return `${env.bunny.endpoint}/${encodeURIComponent(env.bunny.storageZone)}/${path}`;
}

// Simple per-user sliding-window rate limit to stop storage abuse.
const uploadLog = new Map<string, number[]>();
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UPLOADS_PER_WINDOW = 120;

function rateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (uploadLog.get(uid) || []).filter((t) => now - t < UPLOAD_WINDOW_MS);
  if (recent.length >= UPLOADS_PER_WINDOW) {
    uploadLog.set(uid, recent);
    return true;
  }
  recent.push(now);
  uploadLog.set(uid, recent);
  return false;
}

export async function checkBunnyConnectivity(): Promise<{ ok: boolean; status?: number; message: string }> {
  if (!bunnyConfigured) {
    return { ok: false, message: 'BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY not set' };
  }
  try {
    const res = await fetch(`${env.bunny.endpoint}/${encodeURIComponent(env.bunny.storageZone)}/`, {
      headers: { AccessKey: env.bunny.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, status: res.status, message: `Storage zone "${env.bunny.storageZone}" reachable` };
    if (res.status === 401) return { ok: false, status: 401, message: 'Bunny rejected the storage API key (401)' };
    return { ok: false, status: res.status, message: `Bunny storage returned HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: `Cannot reach ${env.bunny.endpoint}: ${(err as Error).message}` };
  }
}

async function purgeCdn(path: string) {
  if (!env.bunny.cdnUrl || !env.bunny.accountApiKey) return;
  try {
    await fetch(`https://api.bunny.net/purge?url=${encodeURIComponent(`${env.bunny.cdnUrl}/${path}`)}`, {
      method: 'POST',
      headers: { AccessKey: env.bunny.accountApiKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.warn('[media] CDN purge failed:', (err as Error).message);
  }
}

export const mediaRouter = Router();

mediaRouter.get('/api/media/status', (_req, res) => {
  res.json({
    configured: bunnyConfigured,
    storageZone: env.bunny.storageZone || null,
    endpoint: bunnyConfigured ? env.bunny.endpoint.replace(/^https?:\/\//, '') : null,
    cdn: Boolean(env.bunny.cdnUrl),
    cdnUrl: env.bunny.cdnUrl || null,
    folders: Object.fromEntries(Object.entries(FOLDER_POLICIES).map(([k, v]) => [k, { maxBytes: v.maxBytes }])),
  });
});

function handleUpload(req: Request, res: Response) {
  if (!bunnyConfigured) {
    return res.status(503).json({
      error: 'Media storage is not configured. Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY on the server.',
    });
  }
  const uid: string = res.locals.user.uid;
  const folder = String(req.query.folder || '');
  const policy = FOLDER_POLICIES[folder];
  if (!policy) {
    return res.status(400).json({ error: `Unknown upload folder "${folder}".` });
  }
  if (rateLimited(uid)) {
    return res.status(429).json({ error: 'Too many uploads. Please wait a few minutes and try again.' });
  }

  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: policy.maxBytes, files: 1, fields: 10 },
  }).single('file');

  parser(req, res, async (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Max ${Math.round(policy.maxBytes / MB)} MB for ${folder}.` });
      }
      return res.status(400).json({ error: `Upload error: ${(err as Error).message}` });
    }

    const file = req.file;
    if (!file || !file.buffer?.length) {
      return res.status(400).json({ error: 'No file received. Send multipart/form-data with a "file" field.' });
    }

    const mime = normaliseMime(file.mimetype);
    if (!policy.types.includes(mime)) {
      return res.status(415).json({ error: `File type "${mime || 'unknown'}" is not allowed for ${folder}.` });
    }

    const now = new Date();
    const path = [
      folder,
      uid.replace(/[^A-Za-z0-9_-]/g, '_'),
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${crypto.randomUUID()}.${EXTENSIONS[mime] || 'bin'}`,
    ].join('/');

    try {
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex').toUpperCase();
      const upstream = await fetch(storageUrl(path), {
        method: 'PUT',
        headers: {
          AccessKey: env.bunny.apiKey,
          'Content-Type': 'application/octet-stream',
          Checksum: checksum,
        },
        body: new Uint8Array(file.buffer),
        signal: AbortSignal.timeout(120_000),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        console.error(`[media] Bunny PUT ${path} failed: HTTP ${upstream.status} ${detail.slice(0, 200)}`);
        const hint = upstream.status === 401 ? ' (check BUNNY_STORAGE_API_KEY — use the storage zone password)' : '';
        return res.status(502).json({ error: `Storage upload failed: HTTP ${upstream.status}${hint}` });
      }

      res.status(201).json({
        success: true,
        url: publicUrlFor(path),
        path,
        size: file.size,
        contentType: mime,
        fileName: file.originalname?.slice(0, 200) || null,
        cdn: Boolean(env.bunny.cdnUrl),
        uploadedAt: now.toISOString(),
      });
    } catch (uploadErr) {
      console.error('[media] Upload to Bunny failed:', uploadErr);
      res.status(502).json({ error: `Storage upload failed: ${(uploadErr as Error).message}` });
    }
  });
}

mediaRouter.post('/api/media/upload', requireAuth, handleUpload);
// Backwards-compatible alias for the previous endpoint name.
mediaRouter.post('/api/bunny/upload', requireAuth, handleUpload);

/** Streams a stored file (used when no CDN pull zone is configured). */
mediaRouter.get(/^\/api\/media\/file\/(.+)$/, async (req: Request, res: Response) => {
  const path = (req.params as unknown as Record<string, string>)[0] || '';
  if (!SAFE_PATH.test(path)) return res.status(400).json({ error: 'Invalid media path.' });
  if (!bunnyConfigured) return res.status(503).json({ error: 'Media storage is not configured.' });

  try {
    const headers: Record<string, string> = { AccessKey: env.bunny.apiKey };
    if (req.headers.range) headers.Range = String(req.headers.range);
    const upstream = await fetch(storageUrl(path), { headers });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'File not found in storage.' });
    }

    const ext = path.split('.').pop() || '';
    res.status(upstream.status);
    res.setHeader('Content-Type', SERVE_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    for (const h of ['content-length', 'content-range']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!isInlineExtension(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.split('/').pop()}"`);
    }
    Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream).pipe(res);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** Deletes a file owned by the caller (path must contain their uid). */
mediaRouter.delete('/api/media', requireAuth, async (req: Request, res: Response) => {
  if (!bunnyConfigured) return res.status(503).json({ error: 'Media storage is not configured.' });
  const uid: string = res.locals.user.uid;
  let path = String(req.body?.path || '');
  // Accept a full public URL as well as a bare path.
  const marker = path.indexOf('/api/media/file/');
  if (marker >= 0) path = path.slice(marker + '/api/media/file/'.length);
  if (env.bunny.cdnUrl && path.startsWith(env.bunny.cdnUrl)) path = path.slice(env.bunny.cdnUrl.length + 1);

  if (!SAFE_PATH.test(path) || path.split('/')[1] !== uid.replace(/[^A-Za-z0-9_-]/g, '_')) {
    return res.status(403).json({ error: 'You can only delete your own files.' });
  }

  const upstream = await fetch(storageUrl(path), { method: 'DELETE', headers: { AccessKey: env.bunny.apiKey } });
  if (!upstream.ok && upstream.status !== 404) {
    return res.status(502).json({ error: `Storage delete failed: HTTP ${upstream.status}` });
  }
  await purgeCdn(path);
  res.json({ success: true });
});
