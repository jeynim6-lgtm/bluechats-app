import React, { useEffect, useState } from 'react';
import { Lock, Shield, CheckCircle2, Users } from 'lucide-react';
import { useMe, useAuth } from '../context/AuthContext';
import { submitWalletApplication, subscribeMyApplication, withdrawWalletApplication } from '../services/wallet';
import { countUsers } from '../services/users';
import { BRANDING } from '../config/branding';
import { LegalModal, type LegalDocType } from './LegalModals';
import { ErrorBanner, Spinner, toast } from './ui';
import type { DocType, WalletApplicant } from '../types';

const DOC_LABELS: Record<DocType, { name: string; placeholder: string; example: string }> = {
  id: { name: 'National ID number', placeholder: '13-digit South African ID number', example: 'e.g. 9408155092083' },
  passport: { name: 'Passport number', placeholder: 'Passport document number', example: 'e.g. A01234567' },
  drivers_licence: { name: 'Driver’s licence number', placeholder: 'Driver’s licence number', example: 'e.g. 12345678ABCD' },
  asylum_doc: { name: 'Asylum / refugee document number', placeholder: 'Section 22 / 24 permit number', example: 'e.g. CTRRFC000123' },
};

export const WalletView: React.FC = () => {
  const me = useMe();
  const { account } = useAuth();
  const goal = BRANDING.wallet.unlockGoal;
  const [userCount, setUserCount] = useState<number | null>(null);
  const [applicant, setApplicant] = useState<WalletApplicant | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [docType, setDocType] = useState<DocType>('id');
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState(me.name);
  const [email, setEmail] = useState(account?.email || '');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [legal, setLegal] = useState<LegalDocType>(null);

  useEffect(() => {
    countUsers().then(setUserCount).catch(() => setUserCount(null));
  }, []);
  useEffect(() => subscribeMyApplication(me.uid, setApplicant), [me.uid]);
  useEffect(() => {
    if (account?.email && !email) setEmail(account.email);
  }, [account?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = userCount ? Math.min(100, (userCount / goal) * 100) : 0;

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!terms) return setError('You must agree to the Terms of Service to pre-register.');
    if (docNumber.replace(/\s/g, '').length < 5) return setError('Please enter a valid document number.');
    if (docType === 'id' && !/^\d{13}$/.test(docNumber.replace(/\s/g, ''))) return setError('A South African ID number has 13 digits.');
    setBusy(true);
    try {
      await submitWalletApplication(me.uid, { name: fullName, email, phone: account?.phone || '', docType, docNumber });
      setDocNumber('');
      setEditing(false);
      toast('Pre-registration saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3.5 py-2.5 text-sm text-ink dark:text-mist placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand';

  return (
    <div className="pb-4 p-4 space-y-4">
      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-brand/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-accent">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Coming soon</span>
            <h1 className="text-xl font-bold font-serif-brand tracking-tight">{BRANDING.appName} Wallet</h1>
          </div>
        </div>
        <p className="text-xs text-haze leading-relaxed mb-5">
          The wallet unlocks automatically when our community reaches <strong>{goal.toLocaleString()} users</strong>.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-mist-soft font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-accent" /> Community goal
            </span>
            <span className="font-bold font-mono">
              {userCount === null ? '…' : userCount.toLocaleString()} / {goal.toLocaleString()}
            </span>
          </div>
          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div className="h-full bg-gradient-to-r from-brand via-accent to-success rounded-full transition-all duration-1000" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          <p className="text-[10px] text-mist-soft">{pct.toFixed(pct < 1 ? 2 : 1)}% reached</p>
        </div>
      </div>

      <div className="bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand" />
          <h2 className="font-bold text-sm">Identity consent &amp; pre-registration</h2>
        </div>

        {applicant === undefined ? (
          <div className="py-6 flex justify-center">
            <Spinner />
          </div>
        ) : applicant && !editing ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" /> Pre-registration recorded
            </div>
            <p className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
              You're on the early-access list. Wallet features stay locked until the community milestone is reached.
            </p>
            <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-ink-faint">Applicant</span>
                <span className="font-bold">{applicant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Document</span>
                <span className="font-bold uppercase">{DOC_LABELS[applicant.docType]?.name || applicant.docType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Number</span>
                <span className="font-bold text-brand">{applicant.docNumberMasked}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-brand hover:underline cursor-pointer">
                Update details
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Withdraw your wallet pre-registration?')) return;
                  await withdrawWalletApplication(me.uid).catch((err) => toast(err.message));
                }}
                className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
              >
                Withdraw
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={apply} className="space-y-4">
            <p className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
              Pre-register to prepare for FICA verification at launch. Only a masked version of your document number (e.g. 9408******083) is
              stored — the full number never leaves this device.
            </p>
            {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(DOC_LABELS) as DocType[]).map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    docType === type ? 'border-brand bg-brand/5' : 'border-line dark:border-night-line hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <input type="radio" name="docType" checked={docType === type} onChange={() => setDocType(type)} className="accent-brand" />
                  <div className="text-xs">
                    <span className="font-bold block">{DOC_LABELS[type].name}</span>
                    <span className="text-[10px] text-ink-faint">{DOC_LABELS[type].example}</span>
                  </div>
                </label>
              ))}
            </div>
            <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder={DOC_LABELS[docType].placeholder} className={`${field} font-mono`} autoComplete="off" />
            <div className="grid grid-cols-2 gap-2">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full legal name" className={field} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={field} />
            </div>
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-paper dark:bg-night border border-line dark:border-night-line cursor-pointer">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand" />
              <span className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
                I agree to the Wallet{' '}
                <button type="button" onClick={() => setLegal('terms')} className="text-brand font-bold underline">
                  Terms
                </button>{' '}
                and{' '}
                <button type="button" onClick={() => setLegal('privacy')} className="text-brand font-bold underline">
                  Privacy Policy
                </button>
                . This registers early interest and does not unlock balances or transfers.
              </span>
            </label>
            <div className="flex gap-2">
              {applicant && (
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-3 rounded-full border border-line dark:border-night-line text-xs font-bold cursor-pointer">
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 rounded-full bg-brand hover:bg-brand-strong disabled:opacity-50 text-white font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {busy && <Spinner className="w-4 h-4 text-white" />}
                {applicant ? 'Save changes' : `Pre-register for ${BRANDING.appName} Wallet`}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-paper dark:bg-night border border-line/80 dark:border-night-line text-center space-y-1">
        <p className="text-[11px] font-bold">Regulatory notice</p>
        <p className="text-[10px] text-ink-faint leading-relaxed">
          No financial services are offered yet. At launch the wallet will operate under applicable South African Reserve Bank and FICA
          requirements, and personal information is processed in line with POPIA.
        </p>
      </div>

      <LegalModal type={legal} onClose={() => setLegal(null)} />
    </div>
  );
};
