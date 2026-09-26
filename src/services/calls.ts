import { collection, onSnapshot, query, where, orderBy, limit, type DocumentData } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { toMillis } from '../lib/format';
import type { CallDoc, CallRecord } from '../types';

const FALLBACK_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
let iceCache: { servers: RTCIceServer[]; expires: number } | null = null;

/** STUN/TURN servers from the backend (TURN credentials are minted server-side). */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && iceCache.expires > Date.now()) return iceCache.servers;
  try {
    const data = await apiFetch<{ iceServers: RTCIceServer[] }>('/api/webrtc/ice-servers');
    iceCache = { servers: data.iceServers, expires: Date.now() + 10 * 60 * 1000 };
    return data.iceServers;
  } catch (err) {
    console.warn('[calls] using fallback STUN servers', err);
    return FALLBACK_ICE;
  }
}

export function callFromDoc(id: string, d: DocumentData): CallDoc {
  return {
    id,
    callerId: d.callerId,
    calleeId: d.calleeId,
    participants: d.participants || [],
    caller: d.caller || { name: 'Unknown', avatarColor: '#3B6BFA' },
    callee: d.callee || { name: 'Unknown', avatarColor: '#3B6BFA' },
    type: d.type === 'video' ? 'video' : 'voice',
    status: d.status,
    offer: d.offer,
    answer: d.answer,
    createdAt: toMillis(d.createdAt),
    answeredAt: d.answeredAt ? toMillis(d.answeredAt) : null,
    endedAt: d.endedAt ? toMillis(d.endedAt) : null,
    endedBy: d.endedBy || null,
    duration: typeof d.duration === 'number' ? d.duration : null,
    recording: d.recording || {},
    recordings: d.recordings || {},
  };
}

export function toCallRecord(call: CallDoc, myUid: string): CallRecord {
  const outgoing = call.callerId === myUid;
  const partner = outgoing ? call.callee : call.caller;
  // A call I declined myself isn't "missed" — it shows as "You declined" without a badge.
  const declinedByMe = call.status === 'declined' && call.endedBy === myUid;
  const unanswered = !call.answeredAt && !declinedByMe && ['missed', 'cancelled', 'declined', 'busy', 'failed', 'ringing'].includes(call.status);
  return {
    id: call.id,
    partnerId: outgoing ? call.calleeId : call.callerId,
    partnerName: partner.name,
    avatarColor: partner.avatarColor,
    avatarUrl: partner.avatarUrl,
    type: call.type,
    direction: outgoing ? 'outgoing' : unanswered ? 'missed' : 'incoming',
    status: call.status,
    timestamp: call.createdAt,
    durationSeconds: call.duration || 0,
    recordingUrl: call.recordings?.[myUid],
  };
}

/** Live call history. Falls back to an unordered query if the composite index isn't deployed yet. */
export function subscribeCallHistory(uid: string, cb: (records: CallRecord[]) => void) {
  const base = collection(getDb(), 'calls');
  let unsub = () => {};
  const handle = (docs: Array<{ id: string; data: () => DocumentData }>) => {
    // Hide calls that are still ringing (they appear once answered, declined or missed).
    const records = docs
      .map((d) => toCallRecord(callFromDoc(d.id, d.data()), uid))
      .filter((r) => r.status !== 'ringing' || Date.now() - r.timestamp > 60_000);
    records.sort((a, b) => b.timestamp - a.timestamp);
    cb(records);
  };

  unsub = onSnapshot(
    query(base, where('participants', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => handle(snap.docs),
    (err) => {
      if ((err as { code?: string }).code !== 'failed-precondition') return console.warn('[calls] history error', err);
      console.warn('[calls] Composite index missing — run `npm run deploy:rules`. Using unordered fallback.', err.message);
      unsub = onSnapshot(query(base, where('participants', 'array-contains', uid), limit(200)), (snap) => handle(snap.docs));
    }
  );
  return () => unsub();
}

/** Ringing calls addressed to me (drives the incoming-call screen). */
export function subscribeIncomingCalls(uid: string, cb: (calls: CallDoc[]) => void) {
  const q = query(collection(getDb(), 'calls'), where('calleeId', '==', uid), where('status', '==', 'ringing'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => callFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })))));
}
