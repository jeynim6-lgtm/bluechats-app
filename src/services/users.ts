import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { toMillis, pickAvatarColor } from '../lib/format';
import { BRANDING } from '../config/branding';
import type { UserProfile, PrivateAccount, Contact } from '../types';

export function profileFromDoc(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    name: data.name || 'Blue Chats user',
    bio: data.bio || '',
    avatarUrl: data.avatarUrl || null,
    avatarPath: data.avatarPath || null,
    avatarColor: data.avatarColor || pickAvatarColor(uid, BRANDING.avatarPalette),
    country: data.country || '',
    createdAt: toMillis(data.createdAt, 0),
    lastSeen: toMillis(data.lastSeen, 0),
  };
}

export async function createProfile(
  uid: string,
  details: { name: string; phone: string; email?: string; country?: string }
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), {
    uid,
    name: details.name.trim().slice(0, 60),
    bio: `Hey there! I am using ${BRANDING.appName}.`,
    avatarUrl: null,
    avatarColor: pickAvatarColor(uid, BRANDING.avatarPalette),
    country: details.country || '',
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  });
  batch.set(doc(db, 'users', uid, 'private', 'account'), {
    phone: details.phone,
    email: details.email?.trim() || '',
    blocked: [],
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'phoneIndex', details.phone), { uid, createdAt: serverTimestamp() });
  await batch.commit();
}

export async function updateProfile(uid: string, changes: Partial<Pick<UserProfile, 'name' | 'bio' | 'avatarUrl' | 'avatarPath' | 'country'>>) {
  const payload: Record<string, unknown> = {};
  if (changes.name !== undefined) payload.name = changes.name.trim().slice(0, 60);
  if (changes.bio !== undefined) payload.bio = changes.bio.trim().slice(0, 160);
  if (changes.avatarUrl !== undefined) payload.avatarUrl = changes.avatarUrl;
  if (changes.avatarPath !== undefined) payload.avatarPath = changes.avatarPath;
  if (changes.country !== undefined) payload.country = changes.country;
  await updateDoc(doc(getDb(), 'users', uid), payload);
}

export async function updateAccountEmail(uid: string, email: string) {
  await setDoc(doc(getDb(), 'users', uid, 'private', 'account'), { email: email.trim() }, { merge: true });
}

export function subscribeProfile(uid: string, cb: (profile: UserProfile | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    doc(getDb(), 'users', uid),
    (snap) => cb(snap.exists() ? profileFromDoc(uid, snap.data({ serverTimestamps: 'estimate' })) : null),
    onError
  );
}

export function subscribeAccount(uid: string, cb: (account: PrivateAccount | null) => void) {
  return onSnapshot(doc(getDb(), 'users', uid, 'private', 'account'), (snap) => {
    if (!snap.exists()) return cb(null);
    const d = snap.data();
    cb({ phone: d.phone || '', email: d.email || '', blocked: Array.isArray(d.blocked) ? d.blocked : [] });
  });
}

// ---------- profile cache for other users ----------
const profileCache = new Map<string, { profile: UserProfile | null; listeners: Set<(p: UserProfile | null) => void>; unsub: () => void }>();

/** Shared live subscription to another user's profile (deduplicated across components). */
export function watchUser(uid: string, cb: (profile: UserProfile | null) => void): () => void {
  let entry = profileCache.get(uid);
  if (!entry) {
    const listeners = new Set<(p: UserProfile | null) => void>();
    const created = { profile: null as UserProfile | null, listeners, unsub: () => {} };
    created.unsub = subscribeProfile(
      uid,
      (p) => {
        created.profile = p;
        listeners.forEach((l) => l(p));
      },
      () => listeners.forEach((l) => l(null))
    );
    profileCache.set(uid, created);
    entry = created;
  } else if (entry.profile) {
    cb(entry.profile);
  }
  entry.listeners.add(cb);
  return () => {
    const e = profileCache.get(uid);
    if (!e) return;
    e.listeners.delete(cb);
    if (e.listeners.size === 0) {
      // keep briefly to avoid thrashing when components remount
      window.setTimeout(() => {
        const again = profileCache.get(uid);
        if (again && again.listeners.size === 0) {
          again.unsub();
          profileCache.delete(uid);
        }
      }, 30_000);
    }
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const cached = profileCache.get(uid)?.profile;
  if (cached) return cached;
  const snap = await getDoc(doc(getDb(), 'users', uid));
  return snap.exists() ? profileFromDoc(uid, snap.data()) : null;
}

/** Exact-match lookup of a registered phone number. */
export async function findUserByPhone(e164: string): Promise<UserProfile | null> {
  const idx = await getDoc(doc(getDb(), 'phoneIndex', e164));
  if (!idx.exists()) return null;
  return getUserProfile(idx.data().uid);
}

export async function touchPresence(uid: string) {
  try {
    await updateDoc(doc(getDb(), 'users', uid), { lastSeen: serverTimestamp() });
  } catch {
    /* offline — will retry on next tick */
  }
}

export async function listRecentUsers(max = 20): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(getDb(), 'users'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => profileFromDoc(d.id, d.data()));
}

export async function countUsers(): Promise<number> {
  const snap = await getCountFromServer(collection(getDb(), 'users'));
  return snap.data().count;
}

export async function countActiveSince(ms: number): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(getDb(), 'users'), where('lastSeen', '>=', Timestamp.fromMillis(ms)))
  );
  return snap.data().count;
}

// ---------- contacts ----------
export function contactIdFor(uid: string | null, phone: string) {
  return uid || `tel_${phone.replace(/\D/g, '')}`;
}

export function subscribeContacts(uid: string, cb: (contacts: Contact[]) => void) {
  return onSnapshot(collection(getDb(), 'users', uid, 'contacts'), (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid || null,
        name: data.name || data.phone,
        phone: data.phone || '',
        avatarColor: data.avatarColor || pickAvatarColor(d.id, BRANDING.avatarPalette),
      } as Contact;
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    cb(list);
  });
}

export async function saveContact(ownerUid: string, contact: { name: string; phone: string; uid: string | null; avatarColor?: string }) {
  const id = contactIdFor(contact.uid, contact.phone);
  await setDoc(doc(getDb(), 'users', ownerUid, 'contacts', id), {
    uid: contact.uid,
    name: contact.name.trim().slice(0, 60) || contact.phone,
    phone: contact.phone,
    avatarColor: contact.avatarColor || pickAvatarColor(id, BRANDING.avatarPalette),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function deleteContact(ownerUid: string, contactId: string) {
  await deleteDoc(doc(getDb(), 'users', ownerUid, 'contacts', contactId));
}

// ---------- blocking ----------
export async function setBlocked(ownerUid: string, targetUid: string, blocked: boolean) {
  await setDoc(
    doc(getDb(), 'users', ownerUid, 'private', 'account'),
    { blocked: blocked ? arrayUnion(targetUid) : arrayRemove(targetUid) },
    { merge: true }
  );
}

/** Removes the user's own documents. Messages already delivered to others remain with them. */
export async function deleteUserData(uid: string, phone: string) {
  const db = getDb();
  const batch = writeBatch(db);
  for (const sub of ['contacts', 'following', 'stars']) {
    const snap = await getDocs(collection(db, 'users', uid, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'users', uid, 'private', 'account'));
  if (phone) {
    // Only delete the index entry if it still points at this account (rules require it).
    const idx = await getDoc(doc(db, 'phoneIndex', phone));
    if (idx.exists() && idx.data().uid === uid) batch.delete(idx.ref);
  }
  batch.delete(doc(db, 'walletApplicants', uid));
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
}
