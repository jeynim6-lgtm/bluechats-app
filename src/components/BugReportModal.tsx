import React, { useState } from 'react';
import { Bug, Send, CheckCircle2 } from 'lucide-react';
import { useAuth, useMe } from '../context/AuthContext';
import { submitBugReport } from '../services/reports';
import { Sheet, Spinner, ErrorBanner } from './ui';

const SCREENS = [
  'Chats / Messages',
  'Discover Feed',
  'Status Stories',
  'Voice / Video Calls',
  'Contacts',
  'Wallet Screen',
  'Settings / Profile',
  'Camera / Media Upload',
  'Sign-in / SMS code',
  'Other',
];

export const BugReportModal: React.FC<{ defaultScreen?: string; onClose: () => void }> = ({ defaultScreen = 'Other', onClose }) => {
  const me = useMe();
  const { account } = useAuth();
  const [description, setDescription] = useState('');
  const [screen, setScreen] = useState(SCREENS.includes(defaultScreen) ? defaultScreen : 'Other');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) return setError('Please describe the issue in a little more detail.');
    setBusy(true);
    setError('');
    try {
      await submitBugReport(me, account?.email, description, screen);
      setDone(true);
      window.setTimeout(onClose, 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={
        <>
          <Bug className="w-4 h-4 text-red-500" /> Report a bug
        </>
      }
      onClose={onClose}
    >
      {done ? (
        <div className="py-10 text-center space-y-3 px-6">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base">Thanks — report sent!</h3>
          <p className="text-xs text-ink-soft dark:text-mist-soft">Our team reviews every report in the admin dashboard.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
          <div>
            <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">Where did it happen?</label>
            <select
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
              className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {SCREENS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">What went wrong?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="What did you do, what did you expect, and what happened instead?"
              className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-[10px] text-ink-faint mt-1">Your device/browser details are attached automatically to help us reproduce it.</p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? <Spinner className="w-4 h-4 text-white" /> : <Send className="w-4 h-4" />} Send report
          </button>
        </form>
      )}
    </Sheet>
  );
};
