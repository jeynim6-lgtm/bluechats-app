import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Firestore,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { ChatMessage, ChatSummary, StatusContact, CallRecord, WalletTransaction } from '../types';

export const FIREBASE_WEB_KEY = 'AIzaSyBwAgQfJzsuLWg073kD3NJ71UVBRizEs0Y';

export const firebaseConfig = {
  apiKey: FIREBASE_WEB_KEY,
  authDomain: 'bluechats.firebaseapp.com',
  projectId: 'bluechats',
  storageBucket: 'bluechats.appspot.com',
  messagingSenderId: '64519650154',
  appId: '1:64519650154:web:bluechats',
};

// Singleton instances
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase initialized in fallback mode:', e);
}

export { app, db, auth };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

// Local storage key constants
const STORAGE_PREFIX = 'bluechats_data_';

/**
 * Save chat message to Firebase Firestore and local store
 */
export async function saveMessageToFirebase(message: ChatMessage): Promise<void> {
  const storageKey = `${STORAGE_PREFIX}messages_${message.chatId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    list.push(message);
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (err) {
    console.error('Local save error:', err);
  }

  // Attempt Firestore sync
  if (db) {
    try {
      const msgRef = doc(db, 'chats', message.chatId, 'messages', message.id);
      await setDoc(msgRef, {
        ...message,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${message.chatId}/messages/${message.id}`);
    }
  }
}

/**
 * Load chat messages
 */
export function getStoredMessages(chatId: string): ChatMessage[] {
  const storageKey = `${STORAGE_PREFIX}messages_${chatId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save a call record
 */
export async function saveCallRecord(call: CallRecord): Promise<void> {
  const storageKey = `${STORAGE_PREFIX}calls`;
  try {
    const raw = localStorage.getItem(storageKey);
    const list: CallRecord[] = raw ? JSON.parse(raw) : [];
    list.unshift(call);
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (err) {
    console.error('Call record save error:', err);
  }

  if (db) {
    try {
      await addDoc(collection(db, 'calls'), {
        ...call,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'calls');
    }
  }
}

/**
 * Get call records
 */
export function getStoredCalls(): CallRecord[] {
  const storageKey = `${STORAGE_PREFIX}calls`;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Re-export Bunny.net upload handler and export uploadMediaFile
export { uploadToBunny } from './bunnyStorage';
import { uploadToBunny } from './bunnyStorage';
import { BunnyUploadResponse } from '../types';

/**
 * Uploads media file/blob to Bunny.net storage using FormData populated with 'file' key
 */
export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  folder: 'voice' | 'photos' | 'videos' | 'calls' | 'status' | 'avatars' = 'photos',
  customFilename?: string
): Promise<BunnyUploadResponse> {
  return uploadToBunny(fileOrBlob, folder, customFilename);
}
