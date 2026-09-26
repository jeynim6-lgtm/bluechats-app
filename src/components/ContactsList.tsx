import React, { useState } from 'react';
import { Search, UserPlus, MessageSquare, Phone, Video, Share2, Trash2, BookUser } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useCalls } from '../context/CallContext';
import { deleteContact, findUserByPhone, saveContact } from '../services/users';
import { toE164, COUNTRIES, DEFAULT_COUNTRY } from '../lib/phone';
import { useT } from '../lib/i18n';
import { AddContactForm, inviteText } from './AddContactForm';
import { Avatar, Sheet, Spinner, shareInvite, toast } from './ui';
import type { Contact } from '../types';
import type { ProfileTarget } from './ContactProfileModal';

interface ContactsListProps {
  onOpenProfile: (target: ProfileTarget) => void;
}

type PickedContact = { name?: string[]; tel?: string[] };

const supportsContactPicker = () => 'contacts' in navigator && 'ContactsManager' in window;

export const ContactsList: React.FC<ContactsListProps> = ({ onOpenProfile }) => {
  const me = useMe();
  const t = useT();
  const { contacts, openDirectChat, blocked } = useAppData();
  const { startCall, call } = useCalls();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);

  const q = search.toLowerCase();
  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(search.trim()));

  const importFromPhone = async () => {
    try {
      const picked = (await (navigator as unknown as { contacts: { select: (p: string[], o: object) => Promise<PickedContact[]> } }).contacts.select(
        ['name', 'tel'],
        { multiple: true }
      )) as PickedContact[];
      if (!picked.length) return;
      setImporting(true);
      const dial = COUNTRIES.find((c) => c.name === me.country)?.dial || DEFAULT_COUNTRY.dial;
      let added = 0;
      let onApp = 0;
      for (const entry of picked) {
        const phone = toE164(entry.tel?.[0] || '', dial);
        if (!phone) continue;
        const user = await findUserByPhone(phone);
        if (user?.uid === me.uid) continue;
        await saveContact(me.uid, { name: entry.name?.[0] || phone, phone, uid: user?.uid || null, avatarColor: user?.avatarColor });
        added++;
        if (user) onApp++;
      }
      toast(`Imported ${added} contact${added === 1 ? '' : 's'} · ${onApp} on Blue Chats`);
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') toast((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const remove = async (c: Contact) => {
    if (!window.confirm(`Remove ${c.name} from your contacts?`)) return;
    await deleteContact(me.uid, c.id).catch((err) => toast(err.message));
  };

  const iconBtn = 'w-8 h-8 rounded-full flex items-center justify-center bg-line/70 dark:bg-night-line transition-all cursor-pointer disabled:opacity-40';

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex gap-2">
        <label className="flex-1 flex items-center gap-2 bg-white dark:bg-night-card border border-line dark:border-night-line rounded-full px-4 py-2 shadow-xs">
          <Search className="w-4 h-4 text-ink-faint" />
          <input
            type="search"
            placeholder={t('searchContacts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-ink dark:text-mist placeholder-ink-faint focus:outline-none text-sm"
          />
        </label>
        {supportsContactPicker() && (
          <button
            onClick={importFromPhone}
            disabled={importing}
            title="Import from phone contacts"
            aria-label="Import from phone contacts"
            className="w-9 h-9 rounded-full bg-white dark:bg-night-card border border-line dark:border-night-line text-brand flex items-center justify-center cursor-pointer flex-shrink-0"
          >
            {importing ? <Spinner className="w-4 h-4" /> : <BookUser className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={() => setShowAdd(true)}
          aria-label={t('newContact')}
          className="w-9 h-9 rounded-full bg-brand hover:bg-brand-strong text-white flex items-center justify-center shadow-md cursor-pointer flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-14 px-8 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
            <UserPlus className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-sm">Add your first contact</h3>
          <p className="text-xs text-ink-soft dark:text-mist-soft">Save people by phone number. If they're on Blue Chats you can chat and call them straight away.</p>
          <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 rounded-full bg-brand text-white font-bold text-xs shadow-md cursor-pointer">
            {t('newContact')}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-line/60 dark:divide-night-line/60">
          {filtered.map((contact) => {
            const isBlocked = Boolean(contact.uid && blocked.has(contact.uid));
            return (
              <div key={contact.id} className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/5">
                <button
                  className="flex items-center gap-3.5 min-w-0 text-left cursor-pointer"
                  onClick={() => contact.uid && onOpenProfile({ uid: contact.uid, name: contact.name, avatarColor: contact.avatarColor })}
                >
                  <Avatar name={contact.name} color={contact.avatarColor} size={44} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-ink dark:text-mist truncate">{contact.name}</h3>
                    <p className="text-xs text-ink-soft dark:text-mist-soft truncate">
                      {contact.phone}
                      {!contact.uid && <span className="ml-1.5 text-gold font-semibold">· not on Blue Chats</span>}
                      {isBlocked && <span className="ml-1.5 text-red-500 font-semibold">· blocked</span>}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {contact.uid ? (
                    <>
                      <button
                        onClick={() => openDirectChat(contact.uid!).catch((err) => toast(err.message))}
                        title={t('message')}
                        aria-label={`${t('message')} ${contact.name}`}
                        className={`${iconBtn} text-brand hover:bg-brand hover:text-white`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startCall({ uid: contact.uid!, name: contact.name, avatarColor: contact.avatarColor }, 'voice')}
                        disabled={isBlocked || Boolean(call)}
                        title={t('voiceCall')}
                        aria-label={`${t('voiceCall')} ${contact.name}`}
                        className={`${iconBtn} text-emerald-500 hover:bg-emerald-500 hover:text-white`}
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startCall({ uid: contact.uid!, name: contact.name, avatarColor: contact.avatarColor }, 'video')}
                        disabled={isBlocked || Boolean(call)}
                        title={t('videoCall')}
                        aria-label={`${t('videoCall')} ${contact.name}`}
                        className={`${iconBtn} text-cyan-500 hover:bg-cyan-500 hover:text-white`}
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        const { text, url } = inviteText();
                        void shareInvite(text, url);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-brand bg-brand/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" /> {t('invite')}
                    </button>
                  )}
                  <button onClick={() => remove(contact)} aria-label={`Remove ${contact.name}`} className={`${iconBtn} text-ink-faint hover:text-red-500`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center py-10 text-sm text-ink-faint">No contacts match “{search}”.</p>}
        </div>
      )}

      {showAdd && (
        <Sheet title={t('newContact')} onClose={() => setShowAdd(false)}>
          <AddContactForm
            onSaved={({ uid, name }) => {
              setShowAdd(false);
              if (uid) toast(`${name} is on Blue Chats — say hi!`);
            }}
          />
        </Sheet>
      )}
    </div>
  );
};
