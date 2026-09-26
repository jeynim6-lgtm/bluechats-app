import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { getDb, getFirebaseAuth } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { toMillis, chunk } from '../lib/format';
import { countUsers, countActiveSince } from './users';
import type { AdminUserRecord, AdStat, BugReport, HealthCheckResult, UserReport, WalletApplicant } from '../types';

export interface CeoAccess {
  authorized: boolean;
  claimsActive: boolean;
  setupRequired?: string;
  error?: string;
}

let cached: { uid: string; result: CeoAccess } | null = null;

/** Local check of the ID token's custom claims (no network). */
export async function hasCeoClaimLocally(): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult();
  return token.claims.ceo === true || token.claims.role === 'ceo';
}

/**
 * Asks the server to confirm CEO access. The server verifies the Firebase ID token and,
 * for designated accounts, attaches the `ceo` custom claim; we then refresh the token so
 * Firestore rules see it. Cached per session and user.
 */
export async function verifyCeoAccess(force = false): Promise<CeoAccess> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return { authorized: false, claimsActive: false, error: 'Not signed in' };
  if (!force && cached?.uid === user.uid) return cached.result;

  let result: CeoAccess;
  try {
    const data = await apiFetch<CeoAccess & { refreshToken?: boolean }>('/api/admin/verify', { method: 'POST', body: '{}' });
    if (data.refreshToken) {
      await user.getIdToken(true);
    }
    result = { ...data, claimsActive: data.claimsActive || (await hasCeoClaimLocally()) };
  } catch (err) {
    result = { authorized: false, claimsActive: false, error: (err as Error).message };
  }
  cached = { uid: user.uid, result };
  return result;
}

export function clearCeoCache() {
  cached = null;
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const data = await apiFetch<{ health: HealthCheckResult }>('/api/admin/health-check');
  return data.health;
}

export async function logAdminAccess(uid: string, action: string) {
  try {
    await addDoc(collection(getDb(), 'adminAccessLog'), {
      adminUid: uid,
      action,
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[admin] audit log failed', err);
  }
}

export interface DashboardData {
  totalUsers: number;
  activeToday: number;
  users: AdminUserRecord[];
  bugReports: BugReport[];
  reports: UserReport[];
  walletApplicants: WalletApplicant[];
  adStats: AdStat[];
}

export async function loadDashboard(): Promise<DashboardData> {
  const db = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalUsers, activeToday, usersSnap, bugsSnap, reportsSnap, walletSnap, adsSnap] = await Promise.all([
    countUsers(),
    countActiveSince(startOfToday.getTime()),
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100))),
    getDocs(query(collection(db, 'bugReports'), orderBy('createdAt', 'desc'), limit(100))),
    getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))),
    getDocs(query(collection(db, 'walletApplicants'), limit(200))),
    getDocs(collection(db, 'adStats')),
  ]);

  // Look up phone numbers only for the users being displayed (30 per `in` query).
  const phoneByUid = new Map<string, string>();
  const phoneSnaps = await Promise.all(
    chunk(usersSnap.docs.map((d) => d.id), 30).map((ids) => getDocs(query(collection(db, 'phoneIndex'), where('uid', 'in', ids))))
  );
  phoneSnaps.flatMap((s) => s.docs).forEach((d) => phoneByUid.set(d.data().uid, d.id));

  return {
    totalUsers,
    activeToday,
    users: usersSnap.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        name: u.name,
        country: u.country,
        phone: phoneByUid.get(d.id),
        createdAt: toMillis(u.createdAt, 0),
        lastSeen: toMillis(u.lastSeen, 0),
      };
    }),
    bugReports: bugsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BugReport, 'id' | 'createdAt'>), createdAt: toMillis(d.data().createdAt) })),
    reports: reportsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserReport, 'id' | 'createdAt'>), createdAt: toMillis(d.data().createdAt) })),
    walletApplicants: walletSnap.docs.map((d) => ({ ...(d.data() as WalletApplicant), appliedAt: toMillis(d.data().appliedAt) })),
    adStats: adsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdStat, 'id'>) })),
  };
}

export async function setBugStatus(id: string, status: BugReport['status']) {
  await updateDoc(doc(getDb(), 'bugReports', id), { status });
}

export async function setReportStatus(id: string, status: UserReport['status']) {
  await updateDoc(doc(getDb(), 'reports', id), { status });
}
