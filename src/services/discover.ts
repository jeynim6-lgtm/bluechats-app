import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  increment,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { toMillis } from '../lib/format';
import { deleteMedia } from '../lib/media';
import type { DiscoverPost, DiscoverComment, FriendRequest, UserProfile } from '../types';

function postFromDoc(id: string, d: DocumentData): DiscoverPost {
  return {
    id,
    uid: d.uid,
    author: d.author || { name: 'Blue Chats user', avatarColor: '#3B6BFA' },
    country: d.country || '',
    countryCode: d.countryCode || '',
    mediaUrl: d.mediaUrl,
    mediaPath: d.mediaPath || null,
    mediaType: d.mediaType === 'video' ? 'video' : 'image',
    caption: d.caption || '',
    commentCount: d.commentCount || 0,
    viewCount: d.viewCount || 0,
    starCount: d.starCount || 0,
    createdAt: toMillis(d.createdAt),
  };
}

export function subscribeFeed(cb: (posts: DiscoverPost[]) => void, onError?: (e: Error) => void, max = 60) {
  return onSnapshot(
    query(collection(getDb(), 'discoverPosts'), orderBy('createdAt', 'desc'), limit(max)),
    (snap) => cb(snap.docs.map((d) => postFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })))),
    onError
  );
}

export async function createPost(
  me: UserProfile,
  post: { caption: string; country: string; countryCode: string; mediaUrl: string; mediaPath: string; mediaType: 'image' | 'video' }
) {
  await addDoc(collection(getDb(), 'discoverPosts'), {
    uid: me.uid,
    author: { name: me.name, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl || null },
    country: post.country,
    countryCode: post.countryCode,
    mediaUrl: post.mediaUrl,
    mediaPath: post.mediaPath,
    mediaType: post.mediaType,
    caption: post.caption.trim(),
    commentCount: 0,
    viewCount: 0,
    starCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function deletePost(post: DiscoverPost) {
  await deleteDoc(doc(getDb(), 'discoverPosts', post.id));
  void deleteMedia(post.mediaPath);
}

export function subscribeMyStars(uid: string, cb: (postIds: Set<string>) => void) {
  return onSnapshot(collection(getDb(), 'users', uid, 'stars'), (snap) => cb(new Set(snap.docs.map((d) => d.id))));
}

/** Star/unstar: the marker doc and counter change atomically (rules verify they match). */
export async function setStar(postId: string, uid: string, starred: boolean) {
  const db = getDb();
  const batch = writeBatch(db);
  const marker = doc(db, 'users', uid, 'stars', postId);
  if (starred) batch.set(marker, { createdAt: serverTimestamp() });
  else batch.delete(marker);
  batch.update(doc(db, 'discoverPosts', postId), { starCount: increment(starred ? 1 : -1) });
  await batch.commit();
}

const viewedThisSession = new Set<string>();

export async function registerView(postId: string) {
  if (viewedThisSession.has(postId)) return;
  viewedThisSession.add(postId);
  try {
    await updateDoc(doc(getDb(), 'discoverPosts', postId), { viewCount: increment(1) });
  } catch {
    /* non-critical */
  }
}

export function subscribeComments(postId: string, cb: (comments: DiscoverComment[]) => void) {
  return onSnapshot(query(collection(getDb(), 'discoverPosts', postId, 'comments'), orderBy('createdAt')), (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, postId, uid: data.uid, author: data.author, text: data.text, createdAt: toMillis(data.createdAt) };
      })
    )
  );
}

export async function addComment(postId: string, me: UserProfile, text: string) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'discoverPosts', postId, 'comments')), {
    uid: me.uid,
    author: { name: me.name, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl || null },
    text: text.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'discoverPosts', postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(postId: string, commentId: string) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'discoverPosts', postId, 'comments', commentId));
  batch.update(doc(db, 'discoverPosts', postId), { commentCount: increment(-1) });
  await batch.commit();
}

// ---------- follows ----------
export function subscribeFollowing(uid: string, cb: (uids: Set<string>) => void) {
  return onSnapshot(collection(getDb(), 'users', uid, 'following'), (snap) => cb(new Set(snap.docs.map((d) => d.id))));
}

export async function setFollowing(uid: string, target: string, follow: boolean) {
  const ref = doc(getDb(), 'users', uid, 'following', target);
  if (follow) await setDoc(ref, { createdAt: serverTimestamp() });
  else await deleteDoc(ref);
}

// ---------- friend requests ----------
function requestFromDoc(id: string, d: DocumentData): FriendRequest {
  return {
    id,
    fromUid: d.fromUid,
    toUid: d.toUid,
    from: d.from || { name: 'Blue Chats user', avatarColor: '#3B6BFA' },
    to: d.to || { name: 'Blue Chats user', avatarColor: '#3B6BFA' },
    status: d.status,
    createdAt: toMillis(d.createdAt),
  };
}

export async function sendFriendRequest(me: UserProfile, to: { uid: string; name: string; avatarColor: string; avatarUrl?: string | null }) {
  await setDoc(doc(getDb(), 'friendRequests', `${me.uid}_${to.uid}`), {
    fromUid: me.uid,
    toUid: to.uid,
    from: { name: me.name, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl || null, country: me.country || '' },
    to: { name: to.name, avatarColor: to.avatarColor, avatarUrl: to.avatarUrl || null },
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export function subscribeIncomingRequests(uid: string, cb: (requests: FriendRequest[]) => void) {
  return onSnapshot(
    query(collection(getDb(), 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending')),
    (snap) => cb(snap.docs.map((d) => requestFromDoc(d.id, d.data({ serverTimestamps: 'estimate' }))))
  );
}

export function subscribeOutgoingRequests(uid: string, cb: (requests: FriendRequest[]) => void) {
  return onSnapshot(query(collection(getDb(), 'friendRequests'), where('fromUid', '==', uid)), (snap) =>
    cb(snap.docs.map((d) => requestFromDoc(d.id, d.data({ serverTimestamps: 'estimate' }))))
  );
}

export async function respondToFriendRequest(requestId: string, accept: boolean) {
  await updateDoc(doc(getDb(), 'friendRequests', requestId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
  });
}
