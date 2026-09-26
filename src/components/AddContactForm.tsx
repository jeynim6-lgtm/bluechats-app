import React, { useState } from 'react';
import { UserPlus, Share2 } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { COUNTRIES, toE164, countryForNumber, DEFAULT_COUNTRY } from '../lib/phone';
import { findUserByPhone, saveContact } from '../services/users';
import { BRANDING } from '../config/branding';
import { ErrorBanner, Spinner, shareInvite } from './ui';

interface AddContactFormProps {
  initialName?: string;
  initialPhone?: string;
  /** Called after saving; `uid` is null when the number isn't on Blue Chats yet. */
  onSaved: (result: { uid: string | null; name: string; phone: string }) => void;
}

export function inviteText() {
  const url = BRANDING.inviteUrl || window.location.origin;
  return { text: BRANDING.inviteMessage(BRANDING.appName, url), url };
}

export const AddContactForm: React.FC<AddContactFormProps> = ({ initialName = '', initialPhone = '', onSaved }) => {
  const me = useMe();
  const initialCountry = countryForNumber(initialPhone) || COUNTRIES.find((c) => c.name === me.country) || DEFAULT_COUNTRY;
  const [dial, setDial] = useState(initialCountry.dial);
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState(initialPhone.startsWith(initialCountry.dial) ? initialPhone.slice(initialCountry.dial.length) : initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notOnApp, setNotOnApp] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phone = toE164(number, dial);
    if (!name.trim()) return setError('Enter a name.');
    if (!phone) return setError('Enter a valid phone number.');
    setBusy(true);
    try {
      const user = await findUserByPhone(phone);
      if (user?.uid === me.uid) {
        setError("That's your own number.");
        return;
      }
      await saveContact(me.uid, { name, phone, uid: user?.uid || null, avatarColor: user?.avatarColor });
      if (!user) {
        setNotOnApp(phone);
        return;
      }
      onSaved({ uid: user.uid, name: name.trim(), phone });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3.5 py-2.5 text-sm text-ink dark:text-mist focus:outline-none focus:ring-1 focus:ring-brand';

  if (notOnApp) {
    return (
      <div className="p-5 space-y-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gold/15 text-gold flex items-center justify-center mx-auto">
          <Share2 className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-sm">{name} isn't on {BRANDING.appName} yet</h3>
        <p className="text-xs text-ink-soft dark:text-mist-soft">We saved them to your contacts. Invite them so you can chat and call for free.</p>
        <button
          onClick={() => {
            const { text, url } = inviteText();
            void shareInvite(text, url);
          }}
          className="w-full py-3 rounded-full bg-brand hover:bg-brand-strong text-white font-bold text-xs cursor-pointer"
        >
          Invite {name.split(' ')[0]}
        </button>
        <a href={`sms:${notOnApp}?body=${encodeURIComponent(inviteText().text)}`} className="block text-xs font-bold text-brand">
          Send invite by SMS
        </a>
        <button onClick={() => onSaved({ uid: null, name, phone: notOnApp })} className="text-xs text-ink-faint cursor-pointer">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-5 space-y-3.5">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      <div>
        <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase mb-1">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sindi Ndlovu" className={field} autoFocus maxLength={60} name="contact-name" />
      </div>
      <div>
        <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase mb-1">Phone number</label>
        <div className="flex gap-2">
          <select value={dial} onChange={(e) => setDial(e.target.value)} aria-label="Country code" className={`${field} w-28 px-2 text-xs`}>
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.flag} {c.dial}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="82 000 0000"
            className={`${field} flex-1`}
            name="contact-phone"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand hover:bg-brand-strong disabled:opacity-60 text-white py-3 rounded-full font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        {busy ? <Spinner className="w-4 h-4 text-white" /> : <UserPlus className="w-4 h-4" />}
        Save contact
      </button>
    </form>
  );
};
