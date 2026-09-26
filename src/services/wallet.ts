import { doc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { toMillis } from '../lib/format';
import type { DocType, WalletApplicant } from '../types';

/** Masks all but the first 4 and last 3 characters, e.g. 9408155092083 → 9408******083 */
export function maskDocumentNumber(raw: string): string {
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  if (clean.length > 7) return `${clean.slice(0, 4)}${'*'.repeat(clean.length - 7)}${clean.slice(-3)}`;
  return `${clean.slice(0, 2)}****`;
}

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stores the pre-registration. The full document number never leaves the device —
 * only a masked version and a one-way hash (for duplicate detection) are saved.
 */
export async function submitWalletApplication(
  uid: string,
  details: { name: string; email?: string; phone: string; docType: DocType; docNumber: string }
) {
  const normalised = details.docNumber.replace(/\s+/g, '').toUpperCase();
  await setDoc(doc(getDb(), 'walletApplicants', uid), {
    uid,
    name: details.name.trim(),
    email: details.email?.trim() || '',
    phone: details.phone,
    docType: details.docType,
    docNumberMasked: maskDocumentNumber(normalised),
    docHash: await sha256(`${details.docType}:${normalised}`),
    termsAccepted: true,
    status: 'pre-registered',
    appliedAt: serverTimestamp(),
  });
}

export function subscribeMyApplication(uid: string, cb: (applicant: WalletApplicant | null) => void) {
  return onSnapshot(doc(getDb(), 'walletApplicants', uid), (snap) => {
    if (!snap.exists()) return cb(null);
    const d = snap.data({ serverTimestamps: 'estimate' });
    cb({ ...(d as WalletApplicant), appliedAt: toMillis(d.appliedAt) });
  });
}

export async function withdrawWalletApplication(uid: string) {
  await deleteDoc(doc(getDb(), 'walletApplicants', uid));
}
