import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { BRANDING } from '../config/branding';
import type { UserProfile } from '../types';

export async function submitBugReport(me: UserProfile, email: string | undefined, description: string, screen: string) {
  await addDoc(collection(getDb(), 'bugReports'), {
    uid: me.uid,
    userName: me.name,
    userEmail: email || '',
    description: description.trim().slice(0, 4000),
    screen,
    appVersion: BRANDING.version,
    userAgent: navigator.userAgent.slice(0, 300),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function reportUser(me: UserProfile, target: { uid: string; name: string }, reason: string, context = '') {
  await addDoc(collection(getDb(), 'reports'), {
    reporterId: me.uid,
    reporterName: me.name,
    targetUid: target.uid,
    targetName: target.name,
    reason,
    context: context.slice(0, 500),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}
