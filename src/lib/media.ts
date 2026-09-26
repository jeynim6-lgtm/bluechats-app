import { apiFetch, getIdToken } from './api';

export type MediaFolder = 'photos' | 'videos' | 'voice' | 'docs' | 'status' | 'discover' | 'avatars' | 'calls';

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
  fileName: string | null;
}

export interface UploadOptions {
  fileName?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a file to Bunny.net Storage through the authenticated server proxy
 * (credentials never reach the browser). Rejects with a readable error on failure —
 * there is no silent local fallback, so a message is only sent once its media is really stored.
 */
export async function uploadMedia(file: Blob, folder: MediaFolder, options: UploadOptions = {}): Promise<UploadResult> {
  const token = await getIdToken();
  const name = options.fileName || (file instanceof File ? file.name : `${folder}-${Date.now()}`);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/media/upload?folder=${encodeURIComponent(folder)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve(body as UploadResult);
      else reject(new Error(body.error || `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    options.signal?.addEventListener('abort', () => xhr.abort());

    const form = new FormData();
    form.append('file', file, name);
    xhr.send(form);
  });
}

/** Deletes one of the caller's own uploads. Failures are logged, never thrown. */
export async function deleteMedia(path?: string | null) {
  if (!path) return;
  try {
    await apiFetch('/api/media', { method: 'DELETE', body: JSON.stringify({ path }) });
  } catch (err) {
    console.warn('[media] delete failed', err);
  }
}

/**
 * Downscales large photos before upload (phone cameras produce 5–12 MB images).
 * GIFs and files the browser cannot decode (e.g. HEIC on desktop) are returned unchanged.
 */
export async function compressImage(file: Blob, maxDimension = 1920, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Picks a MediaRecorder format the current browser supports (Safari records mp4, others webm/ogg). */
export function pickRecorderMimeType(kind: 'audio' | 'video'): string {
  const candidates =
    kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
      : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

export function fileExtensionFor(mime: string): string {
  const base = mime.split(';')[0];
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };
  return map[base] || 'bin';
}

/** Returns the canonical media type (drops codec parameters) so the server's allow-list matches. */
export function baseMime(mime: string): string {
  return (mime || '').split(';')[0].trim();
}
