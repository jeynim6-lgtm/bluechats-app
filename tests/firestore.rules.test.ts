/**
 * Firestore security rules tests. Run with the emulator:
 *   npm run test:rules
 */
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  increment,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';
const EVE = 'eve';
const DM = 'dm_alice_bob';

const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-bluechats-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'chats', DM), {
      type: 'direct',
      participants: [ALICE, BOB],
      createdBy: ALICE,
      members: {},
    });
    await setDoc(doc(db, 'chats', DM, 'messages', 'm1'), {
      senderId: ALICE,
      type: 'text',
      text: 'hi bob',
      createdAt: Timestamp.now(),
      reactions: {},
    });
    await setDoc(doc(db, 'discoverPosts', 'p1'), {
      uid: BOB,
      caption: 'hello',
      mediaType: 'image',
      starCount: 0,
      commentCount: 0,
      viewCount: 0,
    });
  });
});

test('profiles: owner can create; cannot self-assign a role; others read-only', async () => {
  await assertSucceeds(setDoc(doc(as(ALICE), 'users', ALICE), { uid: ALICE, name: 'Alice', bio: '' }));
  await assertFails(setDoc(doc(as(ALICE), 'users', ALICE), { uid: ALICE, name: 'Alice', role: 'ceo' }));
  await assertFails(setDoc(doc(as(EVE), 'users', ALICE), { uid: ALICE, name: 'Hacked' }));
  await assertSucceeds(getDoc(doc(as(BOB), 'users', ALICE)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', ALICE)));
});

test('private data and contacts are owner-only', async () => {
  await assertSucceeds(setDoc(doc(as(ALICE), 'users', ALICE, 'private', 'account'), { phone: '+27820000001' }));
  await assertFails(getDoc(doc(as(BOB), 'users', ALICE, 'private', 'account')));
  await assertFails(setDoc(doc(as(BOB), 'users', ALICE, 'contacts', BOB), { name: 'x' }));
  await assertSucceeds(getDoc(doc(as('boss', { ceo: true }), 'users', ALICE, 'private', 'account')));
});

test('phone index: only the verified phone owner can claim a number; no enumeration', async () => {
  const phone = '+27820000001';
  await assertFails(setDoc(doc(as(EVE, { phone_number: '+27829999999' }), 'phoneIndex', phone), { uid: EVE }));
  await assertSucceeds(setDoc(doc(as(ALICE, { phone_number: phone }), 'phoneIndex', phone), { uid: ALICE }));
  await assertSucceeds(getDoc(doc(as(BOB), 'phoneIndex', phone)));
  await assertFails(getDocs(collection(as(BOB), 'phoneIndex')));
});

test('chats: only participants can read; outsiders cannot read messages', async () => {
  await assertSucceeds(getDoc(doc(as(BOB), 'chats', DM)));
  await assertFails(getDoc(doc(as(EVE), 'chats', DM)));
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'chats'), where('participants', 'array-contains', ALICE))));
  await assertFails(getDocs(collection(as(EVE), 'chats')));
  await assertSucceeds(getDocs(collection(as(BOB), 'chats', DM, 'messages')));
  await assertFails(getDocs(collection(as(EVE), 'chats', DM, 'messages')));
});

test('chats: direct chat id must match participants; cannot add yourself to others\' chats', async () => {
  await assertSucceeds(
    setDoc(doc(as(ALICE), 'chats', 'dm_alice_eve'), { type: 'direct', participants: [ALICE, EVE], createdBy: ALICE })
  );
  await assertFails(
    setDoc(doc(as(EVE), 'chats', 'dm_alice_bob2'), { type: 'direct', participants: [EVE, BOB], createdBy: EVE })
  );
  await assertFails(updateDoc(doc(as(EVE), 'chats', DM), { participants: [ALICE, BOB, EVE] }));
  await assertFails(updateDoc(doc(as(ALICE), 'chats', DM), { participants: [ALICE, BOB, EVE] }));
});

test('messages: no impersonation; server timestamp required; reactions scoped to self', async () => {
  const msgs = collection(as(BOB), 'chats', DM, 'messages');
  await assertSucceeds(
    setDoc(doc(msgs, 'm2'), { senderId: BOB, type: 'text', text: 'hey', createdAt: serverTimestamp() })
  );
  await assertFails(setDoc(doc(msgs, 'm3'), { senderId: ALICE, type: 'text', text: 'fake', createdAt: serverTimestamp() }));
  await assertFails(
    setDoc(doc(msgs, 'm4'), { senderId: BOB, type: 'text', text: 'old', createdAt: Timestamp.fromMillis(0) })
  );
  await assertSucceeds(updateDoc(doc(as(BOB), 'chats', DM, 'messages', 'm1'), { [`reactions.${BOB}`]: '👍' }));
  await assertFails(updateDoc(doc(as(BOB), 'chats', DM, 'messages', 'm1'), { [`reactions.${ALICE}`]: '👎' }));
  await assertFails(updateDoc(doc(as(BOB), 'chats', DM, 'messages', 'm1'), { text: 'edited by bob' }));
  await assertSucceeds(
    updateDoc(doc(as(ALICE), 'chats', DM, 'messages', 'm1'), { deleted: true, text: null })
  );
});

test('calls: caller must be self; only parties can read; candidate lanes enforced', async () => {
  const call = {
    callerId: ALICE,
    calleeId: BOB,
    participants: [ALICE, BOB],
    status: 'ringing',
    type: 'video',
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(as(ALICE), 'calls', 'c1'), call));
  await assertFails(setDoc(doc(as(EVE), 'calls', 'c2'), { ...call }));
  await assertSucceeds(getDocs(query(collection(as(BOB), 'calls'), where('calleeId', '==', BOB), where('status', '==', 'ringing'))));
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'calls'), where('participants', 'array-contains', ALICE))));
  await assertFails(getDoc(doc(as(EVE), 'calls', 'c1')));
  await assertSucceeds(updateDoc(doc(as(BOB), 'calls', 'c1'), { status: 'accepted', answer: { type: 'answer', sdp: 'x' } }));
  await assertFails(updateDoc(doc(as(EVE), 'calls', 'c1'), { status: 'ended' }));
  await assertSucceeds(setDoc(doc(as(BOB), 'calls', 'c1', 'calleeCandidates', 'x'), { candidate: 'a' }));
  await assertFails(setDoc(doc(as(BOB), 'calls', 'c1', 'callerCandidates', 'x'), { candidate: 'a' }));
  await assertFails(getDocs(collection(as(EVE), 'calls', 'c1', 'callerCandidates')));
});

test('statuses: 24h expiry enforced; viewers may only add themselves', async () => {
  const now = Date.now();
  const base = { authorId: ALICE, type: 'text', text: 'hi', viewers: [], createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(as(ALICE), 'statuses', 's1'), { ...base, expiresAt: Timestamp.fromMillis(now + 24 * 3600e3) }));
  await assertFails(setDoc(doc(as(ALICE), 'statuses', 's2'), { ...base, expiresAt: Timestamp.fromMillis(now + 72 * 3600e3) }));
  await assertSucceeds(updateDoc(doc(as(BOB), 'statuses', 's1'), { viewers: arrayUnion(BOB) }));
  await assertFails(updateDoc(doc(as(BOB), 'statuses', 's1'), { viewers: arrayUnion(EVE) }));
  await assertFails(updateDoc(doc(as(BOB), 'statuses', 's1'), { text: 'defaced' }));
  await assertFails(deleteDoc(doc(as(BOB), 'statuses', 's1')));
});

test('discover: star counter must match the caller\'s star marker', async () => {
  const db = as(ALICE);
  const cheat = writeBatch(db);
  cheat.update(doc(db, 'discoverPosts', 'p1'), { starCount: increment(1) });
  await assertFails(cheat.commit());

  const star = writeBatch(db);
  star.set(doc(db, 'users', ALICE, 'stars', 'p1'), { createdAt: serverTimestamp() });
  star.update(doc(db, 'discoverPosts', 'p1'), { starCount: increment(1) });
  await assertSucceeds(star.commit());

  const again = writeBatch(db);
  again.set(doc(db, 'users', ALICE, 'stars', 'p1'), { createdAt: serverTimestamp() });
  again.update(doc(db, 'discoverPosts', 'p1'), { starCount: increment(1) });
  await assertFails(again.commit());

  await assertSucceeds(updateDoc(doc(db, 'discoverPosts', 'p1'), { viewCount: increment(1) }));
  await assertFails(updateDoc(doc(db, 'discoverPosts', 'p1'), { viewCount: increment(50) }));
  await assertFails(updateDoc(doc(db, 'discoverPosts', 'p1'), { caption: 'not mine' }));
});

test('friend requests: sender must be self; only recipient can accept', async () => {
  const req = { fromUid: EVE, toUid: BOB, status: 'pending', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(as(EVE), 'friendRequests', 'eve_bob'), req));
  await assertFails(setDoc(doc(as(EVE), 'friendRequests', 'alice_bob'), { ...req, fromUid: ALICE }));
  await assertFails(updateDoc(doc(as(EVE), 'friendRequests', 'eve_bob'), { status: 'accepted' }));
  await assertSucceeds(updateDoc(doc(as(BOB), 'friendRequests', 'eve_bob'), { status: 'accepted', respondedAt: serverTimestamp() }));
  await assertSucceeds(getDocs(query(collection(as(BOB), 'friendRequests'), where('toUid', '==', BOB))));
  await assertFails(getDocs(query(collection(as(ALICE), 'friendRequests'), where('toUid', '==', BOB))));
});

test('admin data: bug reports, wallet applicants and audit log need the ceo claim', async () => {
  await assertSucceeds(
    setDoc(doc(as(ALICE), 'bugReports', 'b1'), { uid: ALICE, description: 'broken', status: 'open', createdAt: serverTimestamp() })
  );
  await assertFails(getDoc(doc(as(ALICE), 'bugReports', 'b1')));
  await assertSucceeds(getDoc(doc(as('boss', { ceo: true }), 'bugReports', 'b1')));
  await assertSucceeds(getDoc(doc(as('boss2', { role: 'ceo' }), 'bugReports', 'b1')));

  await assertSucceeds(
    setDoc(doc(as(ALICE), 'walletApplicants', ALICE), {
      uid: ALICE, termsAccepted: true, status: 'pre-registered', docType: 'id', docNumberMasked: '9408******083',
    })
  );
  await assertFails(getDoc(doc(as(BOB), 'walletApplicants', ALICE)));
  await assertSucceeds(getDoc(doc(as('boss', { ceo: true }), 'walletApplicants', ALICE)));

  await assertFails(setDoc(doc(as(ALICE), 'adminAccessLog', 'l1'), { adminUid: ALICE }));
  await assertSucceeds(setDoc(doc(as('boss', { ceo: true }), 'adminAccessLog', 'l1'), { adminUid: 'boss' }));
});

test('ad stats: only +1 increments allowed', async () => {
  const db = as(ALICE);
  await assertSucceeds(setDoc(doc(db, 'adStats', '2026-09_house'), { adId: 'house', month: '2026-09', impressions: 1, clicks: 0 }));
  await assertSucceeds(updateDoc(doc(db, 'adStats', '2026-09_house'), { impressions: increment(1) }));
  await assertFails(updateDoc(doc(db, 'adStats', '2026-09_house'), { impressions: increment(1000) }));
  await assertFails(getDoc(doc(db, 'adStats', '2026-09_house')));
});
