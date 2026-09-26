import React, { useState } from 'react';
import { Search, Users, UserPlus, ArrowLeft, Check, Share2 } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { createGroupChat } from '../services/chats';
import { getUserProfile } from '../services/users';
import { useT } from '../lib/i18n';
import { AddContactForm, inviteText } from './AddContactForm';
import { Avatar, Sheet, Spinner, ErrorBanner, shareInvite, toast } from './ui';
import type { UserProfile } from '../types';

export const NewChatSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const me = useMe();
  const t = useT();
  const { contacts, openDirectChat, openChat } = useAppData();
  const [mode, setMode] = useState<'list' | 'contact' | 'group'>('list');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const q = search.toLowerCase();
  const matches = contacts.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q));
  const onApp = matches.filter((c) => c.uid);
  const notOnApp = matches.filter((c) => !c.uid);

  const startChat = async (uid: string) => {
    setBusy(uid);
    try {
      await openDirectChat(uid);
      onClose();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const createGroup = async () => {
    setError('');
    if (selected.size < 1) return setError('Pick at least one member.');
    if (!groupName.trim()) return setError('Give the group a name.');
    setBusy('group');
    try {
      const profiles = (await Promise.all([...selected].map((uid) => getUserProfile(uid)))).filter(Boolean) as UserProfile[];
      const id = await createGroupChat(me, profiles, groupName);
      openChat(id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const title =
    mode === 'list' ? (
      t('newChat')
    ) : (
      <>
        <button onClick={() => setMode('list')} aria-label="Back" className="cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {mode === 'contact' ? t('newContact') : t('newGroup')}
      </>
    );

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === 'contact' ? (
        <AddContactForm
          onSaved={({ uid }) => {
            if (uid) void startChat(uid);
            else setMode('list');
          }}
        />
      ) : (
        <div className="p-4 space-y-3">
          <label className="flex items-center gap-2 bg-paper dark:bg-night border border-line dark:border-night-line rounded-full px-3.5 py-2">
            <Search className="w-4 h-4 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchContacts')}
              className="bg-transparent text-sm flex-1 focus:outline-none"
            />
          </label>

          {mode === 'list' && (
            <div className="space-y-1">
              <button onClick={() => setMode('group')} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold">{t('newGroup')}</span>
              </button>
              <button onClick={() => setMode('contact')} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold">{t('newContact')}</span>
              </button>
            </div>
          )}

          {mode === 'group' && (
            <div className="space-y-2">
              {error && <ErrorBanner message={error} />}
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                maxLength={80}
                className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <p className="text-[11px] text-ink-faint">{selected.size} selected</p>
            </div>
          )}

          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint pt-1">Contacts on Blue Chats</h3>
          {onApp.length === 0 && (
            <p className="text-xs text-ink-faint py-2">
              No contacts on Blue Chats yet. Tap “{t('newContact')}” to add someone by their phone number.
            </p>
          )}
          {onApp.map((c) => {
            const isSelected = selected.has(c.uid!);
            return (
              <button
                key={c.id}
                onClick={() => {
                  if (mode === 'group') {
                    const next = new Set(selected);
                    if (isSelected) next.delete(c.uid!);
                    else next.add(c.uid!);
                    setSelected(next);
                  } else void startChat(c.uid!);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer"
              >
                <Avatar name={c.name} color={c.avatarColor} size={40} shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-xs text-ink-faint">{c.phone}</p>
                </div>
                {busy === c.uid && <Spinner className="w-4 h-4" />}
                {mode === 'group' && (
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-brand border-brand text-white' : 'border-line dark:border-night-line'}`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </span>
                )}
              </button>
            );
          })}

          {mode === 'list' && notOnApp.length > 0 && (
            <>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint pt-2">Invite to Blue Chats</h3>
              {notOnApp.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2">
                  <Avatar name={c.name} color={c.avatarColor} size={40} shape="circle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-xs text-ink-faint">{c.phone}</p>
                  </div>
                  <button
                    onClick={() => {
                      const { text, url } = inviteText();
                      void shareInvite(text, url);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold text-brand bg-brand/10 flex items-center gap-1 cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" /> {t('invite')}
                  </button>
                </div>
              ))}
            </>
          )}

          {mode === 'group' && (
            <button
              onClick={createGroup}
              disabled={busy === 'group'}
              className="w-full mt-2 py-3 rounded-full bg-brand hover:bg-brand-strong disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy === 'group' && <Spinner className="w-4 h-4 text-white" />}
              Create group
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
};
