import React, { useEffect, useMemo, useState } from 'react';
import { Search, CheckCheck, Check, MessageSquarePlus, UserPlus, Users } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData, useUserProfile, useNow } from '../context/AppDataContext';
import { listRecentUsers } from '../services/users';
import { formatListTime, isOnline } from '../lib/format';
import { useT } from '../lib/i18n';
import { Avatar, Spinner, toast } from './ui';
import type { Chat, UserProfile } from '../types';
import type { ProfileTarget } from './ContactProfileModal';

interface ChatListProps {
  onNewChat: () => void;
  onOpenProfile: (target: ProfileTarget) => void;
}

const TYPING_WINDOW_MS = 8000;

export function useChatTitle(chat: Chat, meUid: string) {
  const { displayName } = useAppData();
  const partnerUid = chat.type === 'direct' ? chat.participants.find((p) => p !== meUid) || null : null;
  const partner = useUserProfile(partnerUid);
  const cached = partnerUid ? chat.members[partnerUid] : undefined;
  return {
    partnerUid,
    partner,
    title: chat.type === 'group' ? chat.name || 'Group' : displayName(partnerUid || '', partner?.name || cached?.name || 'Blue Chats user'),
    avatarColor: chat.type === 'group' ? chat.avatarColor || '#8A6CF2' : partner?.avatarColor || cached?.avatarColor || '#3B6BFA',
    avatarUrl: chat.type === 'group' ? null : partner?.avatarUrl || cached?.avatarUrl || null,
  };
}

const ChatRow: React.FC<{ chat: Chat; onOpen: () => void }> = ({ chat, onOpen }) => {
  const me = useMe();
  const t = useT();
  const now = useNow(10_000);
  const { title, partner, avatarColor, avatarUrl } = useChatTitle(chat, me.uid);
  const unread = chat.unread[me.uid] || 0;
  const last = chat.lastMessage;
  const typingUids = Object.entries(chat.typing).filter(([uid, at]) => uid !== me.uid && now - at < TYPING_WINDOW_MS).map(([uid]) => uid);
  const mine = last?.senderId === me.uid;
  const readByOthers = mine && last && chat.participants.filter((p) => p !== me.uid).every((p) => (chat.readAt[p] || 0) >= last.at);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3.5 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/5 active:bg-black/5 cursor-pointer transition-colors"
    >
      <Avatar name={title} color={avatarColor} url={avatarUrl} size={52} online={chat.type === 'direct' && isOnline(partner?.lastSeen)} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5 gap-2">
          <h3 className="font-bold text-sm text-ink dark:text-mist truncate flex items-center gap-1">
            {chat.type === 'group' && <Users className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />}
            {title}
          </h3>
          <span className={`text-[11px] flex-shrink-0 ${unread ? 'text-brand font-bold' : 'text-ink-faint dark:text-mist-faint'}`}>
            {last ? formatListTime(last.at) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-mist-soft truncate min-w-0">
            {typingUids.length > 0 ? (
              <span className="text-success font-semibold truncate">
                {chat.type === 'group' ? `${chat.members[typingUids[0]]?.name?.split(' ')[0] || 'Someone'} is ${t('typing')}` : t('typing')}
              </span>
            ) : (
              <>
                {mine &&
                  (readByOthers ? (
                    <CheckCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
                  ))}
                <span className="truncate">
                  {last
                    ? chat.type === 'group' && !mine && last.type !== 'system'
                      ? `${last.senderName.split(' ')[0]}: ${last.text}`
                      : last.text
                    : 'Tap to start chatting'}
                </span>
              </>
            )}
          </div>
          {unread > 0 && (
            <span className="flex-shrink-0 bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export const ChatList: React.FC<ChatListProps> = ({ onNewChat, onOpenProfile }) => {
  const me = useMe();
  const t = useT();
  const { chats, chatsLoading, openChat, openDirectChat, blocked, displayName } = useAppData();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [openingUid, setOpeningUid] = useState<string | null>(null);

  const partnerIds = useMemo(
    () => new Set(chats.filter((c) => c.type === 'direct').flatMap((c) => c.participants)),
    [chats]
  );

  useEffect(() => {
    listRecentUsers(25)
      .then((users) => setSuggestions(users))
      .catch((err) => console.warn('[chats] suggestions unavailable', err));
  }, []);

  const visibleSuggestions = suggestions
    .filter((u) => u.uid !== me.uid && !partnerIds.has(u.uid) && !blocked.has(u.uid))
    .slice(0, 6);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? chats.filter((c) => {
        const partner = c.participants.find((p) => p !== me.uid) || '';
        const name = c.type === 'group' ? c.name || '' : displayName(partner, c.members[partner]?.name || '');
        return name.toLowerCase().includes(term) || (c.lastMessage?.text || '').toLowerCase().includes(term);
      })
    : chats;

  const startChat = async (uid: string) => {
    setOpeningUid(uid);
    try {
      await openDirectChat(uid);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setOpeningUid(null);
    }
  };

  return (
    <div className="pb-4">
      <div className="px-4 py-2.5">
        <label className="flex items-center gap-2 bg-white dark:bg-night-card border border-line dark:border-night-line rounded-full px-4 py-2.5 shadow-xs">
          <Search className="w-4 h-4 text-ink-faint" />
          <input
            type="search"
            placeholder={t('searchChats')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-ink dark:text-mist placeholder-ink-faint focus:outline-none text-sm"
          />
        </label>
      </div>

      {chatsLoading ? (
        <div className="py-16 flex justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-6 space-y-3">
          {term ? (
            <p className="text-sm text-ink-faint">No chats match “{search}”.</p>
          ) : (
            <>
              <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
                <MessageSquarePlus className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-sm text-ink dark:text-mist">No chats yet</h3>
              <p className="text-xs text-ink-soft dark:text-mist-soft">Start a conversation with a contact, or say hi to someone below.</p>
              <button onClick={onNewChat} className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-strong text-white font-bold text-xs shadow-md cursor-pointer">
                {t('newChat')}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line/60 dark:divide-night-line/60">
          {filtered.map((chat) => (
            <ChatRow key={chat.id} chat={chat} onOpen={() => openChat(chat.id)} />
          ))}
        </div>
      )}

      {visibleSuggestions.length > 0 && !term && (
        <div className="mt-4 pt-3 border-t-8 border-paper dark:border-night">
          <div className="px-4 py-2">
            <h2 className="text-base font-bold text-ink dark:text-mist tracking-tight">People on Blue Chats</h2>
            <p className="text-xs text-ink-soft dark:text-mist-soft mt-0.5 mb-2">New members you haven't chatted with yet.</p>
          </div>
          {visibleSuggestions.map((u) => (
            <div key={u.uid} className="flex items-center justify-between px-4 py-2.5">
              <button
                onClick={() => onOpenProfile({ uid: u.uid, name: u.name, avatarColor: u.avatarColor, avatarUrl: u.avatarUrl })}
                className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
              >
                <Avatar name={u.name} color={u.avatarColor} url={u.avatarUrl} size={44} shape="circle" online={isOnline(u.lastSeen)} />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-ink dark:text-mist truncate">{u.name}</h4>
                  <p className="text-[11px] text-ink-faint dark:text-mist-faint truncate">{u.bio || u.country}</p>
                </div>
              </button>
              <button
                onClick={() => startChat(u.uid)}
                disabled={openingUid === u.uid}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand hover:bg-brand-strong text-white shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-60"
              >
                {openingUid === u.uid ? <Spinner className="w-3 h-3 text-white" /> : <UserPlus className="w-3 h-3" />}
                Say hi
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
