import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMe, useAuth } from './AuthContext';
import { subscribeChats, ensureDirectChat } from '../services/chats';
import { subscribeContacts, watchUser, getUserProfile } from '../services/users';
import { subscribeIncomingRequests } from '../services/discover';
import { playMessageSound, showSystemNotification } from '../lib/notify';
import type { Chat, Contact, FriendRequest, UserProfile } from '../types';

interface AppDataValue {
  chats: Chat[];
  chatsLoading: boolean;
  contacts: Contact[];
  contactsByUid: Map<string, Contact>;
  blocked: Set<string>;
  friendRequests: FriendRequest[];
  activeChatId: string | null;
  openChat: (chatId: string | null) => void;
  /** Opens (creating if needed) a 1-to-1 chat with a registered user. */
  openDirectChat: (uid: string) => Promise<void>;
  /** Saved contact name if present, otherwise the user's profile name. */
  displayName: (uid: string, fallback: string) => string;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const me = useMe();
  const { account } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatRef = useRef<string | null>(null);
  const lastSeenMessageAt = useRef<Map<string, number>>(new Map());
  const initialLoad = useRef(true);
  const blockedRef = useRef<string[]>([]);

  useEffect(() => {
    activeChatRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    blockedRef.current = account?.blocked || [];
  }, [account?.blocked]);

  useEffect(() => {
    return subscribeChats(
      me.uid,
      (list) => {
        // Sound + system notification for new incoming messages outside the open chat.
        for (const chat of list) {
          const last = chat.lastMessage;
          if (!last) continue;
          const previous = lastSeenMessageAt.current.get(chat.id) ?? 0;
          lastSeenMessageAt.current.set(chat.id, last.at);
          if (initialLoad.current || last.at <= previous || last.senderId === me.uid || last.type === 'system') continue;
          if (blockedRef.current.includes(last.senderId)) continue;
          if (activeChatRef.current !== chat.id || document.visibilityState !== 'visible') {
            playMessageSound();
            const title = chat.type === 'group' ? `${chat.name} · ${last.senderName}` : last.senderName;
            showSystemNotification(title, last.text, () => setActiveChatId(chat.id), chat.id);
          }
        }
        initialLoad.current = false;
        setChats(list);
        setChatsLoading(false);
      },
      (err) => {
        console.error('[chats] subscription failed', err);
        setChatsLoading(false);
      }
    );
  }, [me.uid]);

  useEffect(() => subscribeContacts(me.uid, setContacts), [me.uid]);
  useEffect(() => subscribeIncomingRequests(me.uid, setFriendRequests), [me.uid]);

  const contactsByUid = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => c.uid && map.set(c.uid, c));
    return map;
  }, [contacts]);

  const blocked = useMemo(() => new Set(account?.blocked || []), [account?.blocked]);

  const displayName = useCallback(
    (uid: string, fallback: string) => contactsByUid.get(uid)?.name || fallback,
    [contactsByUid]
  );

  const openDirectChat = useCallback(
    async (uid: string) => {
      const other = await getUserProfile(uid);
      if (!other) throw new Error('This user is no longer on Blue Chats.');
      const id = await ensureDirectChat(me, other);
      setActiveChatId(id);
    },
    [me]
  );

  const value: AppDataValue = {
    chats,
    chatsLoading,
    contacts,
    contactsByUid,
    blocked,
    friendRequests: friendRequests.filter((r) => !blocked.has(r.fromUid)),
    activeChatId,
    openChat: setActiveChatId,
    openDirectChat,
    displayName,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}

/** Live profile of another user (shared, de-duplicated Firestore listener). */
export function useUserProfile(uid: string | null | undefined): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!uid) return setProfile(null);
    return watchUser(uid, setProfile);
  }, [uid]);
  return profile;
}

/** Re-renders periodically so "online / last seen" labels stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
