import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limitToLast,
  writeBatch,
  updateDoc,
  serverTimestamp,
  increment,
  deleteField,
  arrayRemove,
  runTransaction,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { toMillis } from '../lib/format';
import type { Chat, ChatMessage, ChatMember, MessageType, UserProfile, MediaInfo, ReplyRef } from '../types';

export function directChatId(a: string, b: string) {
  return `dm_${[a, b].sort().join('_')}`;
}

function memberOf(p: Pick<UserProfile, 'name' | 'avatarColor' | 'avatarUrl'>): ChatMember {
  return { name: p.name, avatarColor: p.avatarColor, avatarUrl: p.avatarUrl || null };
}

function millisMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) out[k] = toMillis(v, Date.now());
  }
  return out;
}

function chatFromDoc(id: string, d: DocumentData): Chat {
  return {
    id,
    type: d.type === 'group' ? 'group' : 'direct',
    participants: d.participants || [],
    members: d.members || {},
    name: d.name,
    avatarColor: d.avatarColor,
    createdBy: d.createdBy,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    lastMessage: d.lastMessage
      ? { ...d.lastMessage, at: toMillis(d.lastMessage.at) }
      : null,
    unread: d.unread || {},
    readAt: millisMap(d.readAt),
    typing: millisMap(d.typing),
  };
}

export function subscribeChats(uid: string, cb: (chats: Chat[]) => void, onError?: (e: Error) => void) {
  const q = query(collection(getDb(), 'chats'), where('participants', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const chats = snap.docs.map((d) => chatFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })));
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      cb(chats);
    },
    onError
  );
}

/** Opens (creating on first use) the 1-to-1 chat between two users. */
export async function ensureDirectChat(me: UserProfile, other: UserProfile): Promise<string> {
  const db = getDb();
  const id = directChatId(me.uid, other.uid);
  const ref = doc(db, 'chats', id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, {
      type: 'direct',
      participants: [me.uid, other.uid],
      members: { [me.uid]: memberOf(me), [other.uid]: memberOf(other) },
      createdBy: me.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unread: { [me.uid]: 0, [other.uid]: 0 },
      readAt: {},
      typing: {},
    });
  });
  return id;
}

export async function createGroupChat(me: UserProfile, members: UserProfile[], name: string): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, 'chats'));
  const all = [me, ...members.filter((m) => m.uid !== me.uid)];
  const batch = writeBatch(db);
  batch.set(ref, {
    type: 'group',
    name: name.trim().slice(0, 80) || 'New group',
    avatarColor: me.avatarColor,
    participants: all.map((m) => m.uid),
    members: Object.fromEntries(all.map((m) => [m.uid, memberOf(m)])),
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: { text: `${me.name} created the group`, type: 'system', senderId: me.uid, senderName: me.name, at: serverTimestamp() },
    unread: Object.fromEntries(all.map((m) => [m.uid, 0])),
    readAt: {},
    typing: {},
  });
  await batch.commit();
  await sendMessage({ id: ref.id, participants: all.map((m) => m.uid) }, me, {
    type: 'system',
    text: `${me.name} created the group “${name.trim() || 'New group'}”`,
  });
  return ref.id;
}

export async function leaveGroup(chatId: string, me: UserProfile) {
  await sendMessage({ id: chatId, participants: [] }, me, { type: 'system', text: `${me.name} left the group` });
  await updateDoc(doc(getDb(), 'chats', chatId), { participants: arrayRemove(me.uid) });
}

function messageFromDoc(chatId: string, d: QueryDocumentSnapshot): ChatMessage {
  const data = d.data({ serverTimestamps: 'estimate' });
  return {
    id: d.id,
    chatId,
    senderId: data.senderId,
    senderName: data.senderName || '',
    type: data.type || 'text',
    text: data.text ?? null,
    media: data.media ?? null,
    location: data.location ?? null,
    contact: data.contact ?? null,
    replyTo: data.replyTo ?? null,
    reactions: data.reactions || {},
    createdAt: toMillis(data.createdAt),
    pending: d.metadata.hasPendingWrites,
    deleted: Boolean(data.deleted),
  };
}

export function subscribeMessages(chatId: string, cb: (messages: ChatMessage[]) => void, max = 300) {
  const q = query(collection(getDb(), 'chats', chatId, 'messages'), orderBy('createdAt'), limitToLast(max));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    cb(snap.docs.map((d) => messageFromDoc(chatId, d)));
  });
}

export interface OutgoingMessage {
  type: MessageType;
  text?: string | null;
  media?: MediaInfo | null;
  location?: ChatMessage['location'];
  contact?: ChatMessage['contact'];
  replyTo?: ReplyRef | null;
}

export function previewText(m: Pick<OutgoingMessage, 'type' | 'text' | 'media' | 'contact'>): string {
  switch (m.type) {
    case 'voice':
      return '🎤 Voice note';
    case 'image':
      return m.text ? `📷 ${m.text}` : '📷 Photo';
    case 'video':
      return m.text ? `🎥 ${m.text}` : '🎥 Video';
    case 'file':
      return `📄 ${m.media?.name || 'Document'}`;
    case 'location':
      return '📍 Location';
    case 'contact':
      return `👤 ${m.contact?.name || 'Contact'}`;
    default:
      return (m.text || '').slice(0, 160);
  }
}

/**
 * Writes the message and updates the chat summary (preview, unread counters) atomically.
 * Firestore's local cache shows it instantly; the returned promise resolves on server ack.
 */
export async function sendMessage(chat: Pick<Chat, 'id' | 'participants'>, sender: UserProfile, msg: OutgoingMessage) {
  const db = getDb();
  const chatRef = doc(db, 'chats', chat.id);
  const msgRef = doc(collection(chatRef, 'messages'));
  const batch = writeBatch(db);

  batch.set(msgRef, {
    senderId: sender.uid,
    senderName: sender.name,
    type: msg.type,
    text: msg.text ?? null,
    media: msg.media ?? null,
    location: msg.location ?? null,
    contact: msg.contact ?? null,
    replyTo: msg.replyTo ?? null,
    reactions: {},
    createdAt: serverTimestamp(),
  });

  const summary: Record<string, unknown> = {
    lastMessage: { text: previewText(msg), type: msg.type, senderId: sender.uid, senderName: sender.name, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
    [`readAt.${sender.uid}`]: serverTimestamp(),
    [`typing.${sender.uid}`]: deleteField(),
    [`members.${sender.uid}`]: memberOf(sender),
  };
  for (const uid of chat.participants) {
    if (uid !== sender.uid) summary[`unread.${uid}`] = increment(1);
  }
  batch.update(chatRef, summary);
  await batch.commit();
  return msgRef.id;
}

export async function markChatRead(chatId: string, uid: string) {
  await updateDoc(doc(getDb(), 'chats', chatId), {
    [`unread.${uid}`]: 0,
    [`readAt.${uid}`]: serverTimestamp(),
  });
}

export async function setTyping(chatId: string, uid: string, typing: boolean) {
  await updateDoc(doc(getDb(), 'chats', chatId), {
    [`typing.${uid}`]: typing ? serverTimestamp() : deleteField(),
  });
}

export async function setReaction(chatId: string, messageId: string, uid: string, emoji: string | null) {
  await updateDoc(doc(getDb(), 'chats', chatId, 'messages', messageId), {
    [`reactions.${uid}`]: emoji ?? deleteField(),
  });
}

export async function deleteForEveryone(chatId: string, messageId: string) {
  await updateDoc(doc(getDb(), 'chats', chatId, 'messages', messageId), {
    deleted: true,
    text: null,
    media: null,
    location: null,
    contact: null,
    replyTo: null,
    reactions: {},
  });
}
