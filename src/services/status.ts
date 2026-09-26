import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  increment,
  setDoc,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { toMillis, chunk } from '../lib/format';
import { deleteMedia } from '../lib/media';
import type { StatusItem, UserProfile } from '../types';

export const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function postStatus(
  me: UserProfile,
  item: { type: StatusItem['type']; text?: string | null; mediaUrl?: string | null; mediaPath?: string | null; bg: string }
) {
  await addDoc(collection(getDb(), 'statuses'), {
    authorId: me.uid,
    author: { name: me.name, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl || null },
    type: item.type,
    text: item.text?.trim() || null,
    mediaUrl: item.mediaUrl || null,
    mediaPath: item.mediaPath || null,
    bg: item.bg,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + STATUS_LIFETIME_MS),
    viewers: [],
  });
}

/** Live statuses from the given authors (chunked for Firestore's 30-value `in` limit). Expired items are dropped. */
export function subscribeStatuses(authorIds: string[], cb: (items: StatusItem[]) => void) {
  const ids = [...new Set(authorIds)].filter(Boolean);
  if (!ids.length) {
    cb([]);
    return () => {};
  }
  const buckets = new Map<number, StatusItem[]>();
  const emit = () => {
    const now = Date.now();
    cb([...buckets.values()].flat().filter((s) => s.expiresAt > now));
  };
  const unsubs = chunk(ids, 30).map((group, i) =>
    onSnapshot(query(collection(getDb(), 'statuses'), where('authorId', 'in', group)), (snap) => {
      buckets.set(
        i,
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            authorId: data.authorId,
            author: data.author,
            type: data.type,
            text: data.text,
            mediaUrl: data.mediaUrl,
            mediaPath: data.mediaPath,
            bg: data.bg || '#2453D6',
            createdAt: toMillis(data.createdAt),
            expiresAt: toMillis(data.expiresAt),
            viewers: data.viewers || [],
          } as StatusItem;
        })
      );
      emit();
    })
  );
  // Re-filter periodically so statuses disappear when they expire.
  const timer = window.setInterval(emit, 60_000);
  return () => {
    unsubs.forEach((u) => u());
    window.clearInterval(timer);
  };
}

export async function markStatusViewed(statusId: string, uid: string) {
  try {
    await updateDoc(doc(getDb(), 'statuses', statusId), { viewers: arrayUnion(uid) });
  } catch (err) {
    console.warn('[status] could not record view', err);
  }
}

export async function deleteStatus(item: StatusItem) {
  await deleteDoc(doc(getDb(), 'statuses', item.id));
  void deleteMedia(item.mediaPath);
}

/** Records a sponsored-card impression or click (+1, enforced by security rules). */
export async function trackSponsored(adId: string, kind: 'impressions' | 'clicks') {
  const month = new Date().toISOString().slice(0, 7);
  const ref = doc(getDb(), 'adStats', `${month}_${adId}`);
  try {
    await updateDoc(ref, { [kind]: increment(1) });
  } catch {
    try {
      await setDoc(ref, { adId, month, impressions: kind === 'impressions' ? 1 : 0, clicks: kind === 'clicks' ? 1 : 0 });
    } catch (err) {
      console.warn('[ads] tracking failed', err);
    }
  }
}
