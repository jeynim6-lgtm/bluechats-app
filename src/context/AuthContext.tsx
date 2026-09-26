import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from '../lib/firebase';
import { profileFromDoc, subscribeAccount, touchPresence } from '../services/users';
import { clearCeoCache } from '../services/admin';
import type { UserProfile, PrivateAccount } from '../types';

export type AuthStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: UserProfile | null;
  account: PrivateAccount | null;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PRESENCE_INTERVAL_MS = 60_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [account, setAccount] = useState<PrivateAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
      if (!user) {
        setProfile(null);
        setAccount(null);
        setProfileResolved(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setProfileResolved(false);
    const unsubProfile = onSnapshot(
      doc(getDb(), 'users', firebaseUser.uid),
      (snap) => {
        // A cache miss is not proof the profile doesn't exist — wait for the server.
        if (!snap.exists() && snap.metadata.fromCache) return;
        setProfile(snap.exists() ? profileFromDoc(snap.id, snap.data({ serverTimestamps: 'estimate' })) : null);
        setProfileResolved(true);
        setError(null);
      },
      (err) => {
        console.error('[auth] profile subscription failed', err);
        setError(
          err.code === 'permission-denied'
            ? 'Firestore rejected the request. Deploy firestore.rules to your Firebase project (npm run deploy:rules).'
            : err.message
        );
        setProfileResolved(true);
      }
    );
    const unsubAccount = subscribeAccount(firebaseUser.uid, setAccount);
    return () => {
      unsubProfile();
      unsubAccount();
    };
  }, [firebaseUser?.uid]);

  // Presence heartbeat while the app is open and visible.
  const ready = Boolean(firebaseUser && profile);
  useEffect(() => {
    if (!ready || !firebaseUser) return;
    const uid = firebaseUser.uid;
    const beat = () => document.visibilityState === 'visible' && touchPresence(uid);
    beat();
    const id = window.setInterval(beat, PRESENCE_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [ready, firebaseUser?.uid]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    clearCeoCache();
    await fbSignOut(getFirebaseAuth());
    // Wipe the offline cache so the next person on this device can't read old chats.
    try {
      await terminate(getDb());
      await clearIndexedDbPersistence(getDb());
    } catch (err) {
      console.warn('[auth] could not clear offline cache', err);
    }
    window.location.reload();
  }, []);

  let status: AuthStatus = 'loading';
  if (signingOut) status = 'loading';
  else if (authResolved && !firebaseUser) status = 'signedOut';
  else if (firebaseUser && profileResolved) status = profile ? 'ready' : 'needsProfile';

  return (
    <AuthContext.Provider value={{ status, firebaseUser, profile, account, error, signOut }}>{children}</AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For screens rendered only when signed in with a profile. */
export function useMe(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe called without a signed-in profile');
  return profile;
}
