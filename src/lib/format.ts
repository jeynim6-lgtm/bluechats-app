import type { Timestamp } from 'firebase/firestore';

/** Converts Firestore Timestamps / numbers / nulls into epoch milliseconds. */
export function toMillis(value: unknown, fallback = Date.now()): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as Timestamp).toMillis === 'function') return (value as Timestamp).toMillis();
  return fallback;
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => [...w][0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Chat-list style: 14:02 · Yesterday · Mon · 12/03/2026 */
export function formatListTime(ms: number): string {
  const today = startOfDay(Date.now());
  if (ms >= today) return formatClock(ms);
  if (ms >= today - DAY) return 'Yesterday';
  if (ms >= today - 6 * DAY) return new Date(ms).toLocaleDateString([], { weekday: 'short' });
  return new Date(ms).toLocaleDateString();
}

/** Separator label inside a conversation. */
export function formatDayLabel(ms: number): string {
  const today = startOfDay(Date.now());
  if (ms >= today) return 'Today';
  if (ms >= today - DAY) return 'Yesterday';
  return new Date(ms).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function isSameDay(a: number, b: number) {
  return startOfDay(a) === startOfDay(b);
}

export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isOnline(lastSeen?: number | null): boolean {
  return Boolean(lastSeen && Date.now() - lastSeen < ONLINE_WINDOW_MS);
}

export function formatLastSeen(lastSeen?: number | null): string {
  if (!lastSeen) return 'Blue Chats user';
  if (isOnline(lastSeen)) return 'online';
  const today = startOfDay(Date.now());
  if (lastSeen >= today) return `last seen today at ${formatClock(lastSeen)}`;
  if (lastSeen >= today - DAY) return `last seen yesterday at ${formatClock(lastSeen)}`;
  return `last seen ${new Date(lastSeen).toLocaleDateString()}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pickAvatarColor(seed: string, palette: string[]): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
