import React, { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { ArrowLeft, Lock, Users, MessageSquareText, ShieldCheck, ChevronDown } from 'lucide-react';
import { getFirebaseAuth } from '../lib/firebase';
import { COUNTRIES, DEFAULT_COUNTRY, toE164, formatPhone, countryForNumber } from '../lib/phone';
import { createProfile, countUsers } from '../services/users';
import { submitWalletApplication } from '../services/wallet';
import { useAuth } from '../context/AuthContext';
import { BRANDING } from '../config/branding';
import { LegalModal, type LegalDocType } from './LegalModals';
import { ErrorBanner, Spinner } from './ui';
import type { DocType } from '../types';

type Step = 'phone' | 'code' | 'profile' | 'wallet' | 'done';

const RESEND_SECONDS = 60;

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/invalid-phone-number': 'That phone number is not valid. Check the country code and number.',
    'auth/missing-phone-number': 'Enter your phone number.',
    'auth/too-many-requests': 'Too many attempts from this device. Please wait a while and try again.',
    'auth/quota-exceeded': 'The SMS quota for this app has been reached. Please try again later.',
    'auth/invalid-verification-code': 'That code is incorrect. Check the SMS and try again.',
    'auth/code-expired': 'This code has expired. Tap “Resend code” to get a new one.',
    'auth/session-expired': 'This code has expired. Tap “Resend code” to get a new one.',
    'auth/captcha-check-failed': 'The security check failed. Please try again.',
    'auth/invalid-app-credential': 'The security check failed. Refresh the page and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    'auth/operation-not-allowed':
      'Phone sign-in is not enabled for this Firebase project. Enable it under Authentication → Sign-in method → Phone.',
    'auth/unauthorized-domain': `This website (${window.location.hostname}) is not an authorised domain. Add it under Firebase Authentication → Settings → Authorized domains.`,
    'auth/billing-not-enabled': 'SMS sign-in requires the Firebase Blaze (pay-as-you-go) plan on this project.',
    'auth/invalid-api-key': 'The Firebase API key is invalid. Check FIREBASE_API_KEY on the server.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is invalid. Check FIREBASE_API_KEY on the server.',
  };
  return messages[code] || (err as Error)?.message || 'Something went wrong. Please try again.';
}

interface AuthModalProps {
  /** Called when a brand-new profile is created, so the parent keeps onboarding visible. */
  onProfileCreated: () => void;
  onFinished: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onProfileCreated, onFinished }) => {
  const { status, firebaseUser, error: authError, signOut } = useAuth();
  const [step, setStep] = useState<Step>(status === 'needsProfile' ? 'profile' : 'phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // phone + code
  const [dial, setDial] = useState(DEFAULT_COUNTRY.dial);
  const [localNumber, setLocalNumber] = useState('');
  const [e164, setE164] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const captchaHostRef = useRef<HTMLDivElement>(null);

  // profile
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // wallet
  const [docType, setDocType] = useState<DocType>('id');
  const [docNumber, setDocNumber] = useState('');
  const [walletTerms, setWalletTerms] = useState(false);
  const [walletOptedIn, setWalletOptedIn] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);

  const [legalModal, setLegalModal] = useState<LegalDocType>(null);

  useEffect(() => {
    if (status === 'needsProfile' && (step === 'phone' || step === 'code')) setStep('profile');
  }, [status, step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'done') countUsers().then(setUserCount).catch(() => setUserCount(null));
  }, [step]);

  useEffect(() => () => verifierRef.current?.clear(), []);

  const resetVerifier = () => {
    try {
      verifierRef.current?.clear();
    } catch {
      /* already cleared */
    }
    verifierRef.current = null;
  };

  /** A fresh, empty element is required each time a reCAPTCHA widget is created. */
  const getVerifier = () => {
    if (verifierRef.current) return verifierRef.current;
    const host = captchaHostRef.current!;
    host.replaceChildren();
    const el = document.createElement('div');
    host.appendChild(el);
    verifierRef.current = new RecaptchaVerifier(getFirebaseAuth(), el, { size: 'invisible' });
    return verifierRef.current;
  };

  const sendCode = async () => {
    setError('');
    const number = toE164(localNumber, dial);
    if (!number) {
      setError('Enter a valid phone number, e.g. 082 123 4567.');
      return;
    }
    setBusy(true);
    try {
      confirmationRef.current = await signInWithPhoneNumber(getFirebaseAuth(), number, getVerifier());
      setE164(number);
      setCode('');
      setResendIn(RESEND_SECONDS);
      setStep('code');
    } catch (err) {
      console.error('[auth] signInWithPhoneNumber failed', err);
      setError(authErrorMessage(err));
      resetVerifier();
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (value = code) => {
    if (!confirmationRef.current || value.length !== 6) return;
    setError('');
    setBusy(true);
    try {
      await confirmationRef.current.confirm(value);
      // AuthContext now loads the profile; new users are moved to the profile step automatically.
    } catch (err) {
      setError(authErrorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const name = fullName.trim();
    if (name.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('That email address does not look right.');
      return;
    }
    const phone = firebaseUser.phoneNumber || e164;
    setBusy(true);
    setError('');
    try {
      onProfileCreated();
      await createProfile(firebaseUser.uid, {
        name,
        phone,
        email,
        country: countryForNumber(phone)?.name || '',
      });
      setStep('wallet');
    } catch (err) {
      console.error('[auth] createProfile failed', err);
      setError(
        (err as { code?: string }).code === 'permission-denied'
          ? 'Your profile could not be saved: Firestore security rules are not deployed. Run `npm run deploy:rules`.'
          : (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  const submitWallet = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    setError('');
    try {
      await submitWalletApplication(firebaseUser.uid, {
        name: fullName.trim(),
        email,
        phone: firebaseUser.phoneNumber || e164,
        docType,
        docNumber,
      });
      setWalletOptedIn(true);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stepNumber = { phone: 1, code: 2, profile: 3, wallet: 4, done: 5 }[step];
  const selectedCountry = COUNTRIES.find((c) => c.dial === dial) || DEFAULT_COUNTRY;
  const goal = BRANDING.wallet.unlockGoal;
  const pct = userCount ? Math.min(100, (userCount / goal) * 100) : 0;

  const input =
    'w-full bg-white dark:bg-night-card border border-line dark:border-night-line rounded-xl px-4 py-3 text-sm text-ink dark:text-mist placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-brand';
  const primary =
    'w-full bg-brand hover:bg-brand-strong active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-white font-bold py-3.5 rounded-full text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2';

  return (
    <div className="fixed inset-0 z-50 bg-paper dark:bg-night flex flex-col max-w-[480px] mx-auto overflow-y-auto">
      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white px-6 pt-10 pb-7 rounded-b-[28px] shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
            <span className="font-serif-brand italic font-semibold text-2xl tracking-tight">{BRANDING.appName}</span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-white/10 px-2.5 py-0.5 rounded-full text-accent">Step {stepNumber} of 5</span>
        </div>
        <p className="text-haze text-xs mt-1">
          {step === 'phone' && 'Sign in or create an account with your phone number.'}
          {step === 'code' && `Enter the 6-digit code we sent by SMS to ${formatPhone(e164)}.`}
          {step === 'profile' && 'Tell people who you are.'}
          {step === 'wallet' && `${BRANDING.appName} Wallet pre-registration (optional).`}
          {step === 'done' && `Wallet unlocks at ${goal.toLocaleString()} users.`}
        </p>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {(error || authError) && <ErrorBanner message={error || authError || ''} onDismiss={error ? () => setError('') : undefined} />}

        {step === 'phone' && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider">Phone number</label>
            <div className="flex gap-2">
              {/* Compact "🇿🇦 +27" face over a native select that lists full country names */}
              <label className="relative flex items-center gap-1 bg-white dark:bg-night-card border border-line dark:border-night-line rounded-xl px-3 text-sm font-semibold text-ink dark:text-mist focus-within:ring-2 focus-within:ring-brand cursor-pointer flex-shrink-0">
                <span aria-hidden="true">
                  {selectedCountry.flag} {selectedCountry.dial}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
                <select
                  value={`${dial}|${selectedCountry.iso}`}
                  onChange={(e) => setDial(e.target.value.split('|')[0])}
                  aria-label="Country code"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso} value={`${c.dial}|${c.iso}`}>
                      {c.flag} {c.name} ({c.dial})
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                placeholder="82 123 4567"
                className={`${input} flex-1`}
                autoFocus
                name="phone"
              />
            </div>
            <p className="text-[11px] text-ink-faint">We'll send a one-time verification code by SMS. Standard SMS rates may apply.</p>

            <button type="submit" disabled={busy || !localNumber.trim()} className={primary} id="send-code-button">
              {busy ? <Spinner className="w-4 h-4 text-white" /> : <MessageSquareText className="w-4 h-4" />}
              <span>{busy ? 'Sending code…' : 'Send verification code'}</span>
            </button>
            <p className="text-[11px] text-ink-faint dark:text-mist-faint text-center leading-relaxed">
              By continuing you agree to the{' '}
              <button type="button" onClick={() => setLegalModal('terms')} className="text-brand underline font-bold">
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" onClick={() => setLegalModal('privacy')} className="text-brand underline font-bold">
                Privacy Policy
              </button>
              .
            </p>
            <p className="text-[10px] text-ink-faint dark:text-mist-faint text-center">
              Protected by reCAPTCHA — the Google{' '}
              <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a className="underline" href="https://policies.google.com/terms" target="_blank" rel="noreferrer">
                Terms
              </a>{' '}
              apply.
            </p>
          </form>
        )}

        {step === 'code' && (
          <form
            className="space-y-4 text-center"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) void verifyCode(v);
              }}
              placeholder="••••••"
              aria-label="6-digit verification code"
              name="otp"
              autoFocus
              className="w-full max-w-[260px] mx-auto block text-center text-3xl tracking-[0.5em] font-bold font-mono bg-white dark:bg-night-card border border-line dark:border-night-line rounded-2xl py-4 text-ink dark:text-mist focus:outline-none focus:ring-2 focus:ring-brand"
            />

            <button type="submit" disabled={busy || code.length !== 6} className={primary}>
              {busy ? <Spinner className="w-4 h-4 text-white" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{busy ? 'Verifying…' : 'Verify code'}</span>
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError('');
                  resetVerifier();
                }}
                className="text-ink-soft dark:text-mist-soft font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change number
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => {
                  resetVerifier();
                  void sendCode();
                }}
                className="font-bold text-brand disabled:text-ink-faint cursor-pointer disabled:cursor-default"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {step === 'profile' && (
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="p-3 rounded-2xl bg-success/10 text-success text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified {firebaseUser?.phoneNumber ? formatPhone(firebaseUser.phoneNumber) : 'phone number'}</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">Your name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Naledi Mokoena"
                maxLength={60}
                autoComplete="name"
                name="name"
                autoFocus
                className={input}
              />
              <p className="text-[10px] text-ink-faint mt-1">Shown to people you chat with.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">
                Recovery email <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                name="email"
                className={input}
              />
              <p className="text-[10px] text-ink-faint mt-1">Private — only you and support can see it.</p>
            </div>
            <button type="submit" disabled={busy} className={primary}>
              {busy && <Spinner className="w-4 h-4 text-white" />}
              <span>{busy ? 'Creating your account…' : 'Continue →'}</span>
            </button>
            <button type="button" onClick={() => void signOut()} className="w-full py-2 text-xs text-ink-soft dark:text-mist-soft font-semibold cursor-pointer">
              Use a different number
            </button>
          </form>
        )}

        {step === 'wallet' && (
          <div className="space-y-3.5">
            <div className="p-3 bg-brand/10 border border-brand/20 rounded-2xl">
              <span className="font-bold text-xs text-brand block mb-0.5">Optional wallet pre-registration</span>
              <p className="text-[11px] text-ink-soft dark:text-mist-soft leading-relaxed">
                Register your interest for the {BRANDING.appName} Wallet. Only a masked version of your document number is stored — the
                full number never leaves this device.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">Document type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)} className={input}>
                <option value="id">National ID number</option>
                <option value="passport">Passport number</option>
                <option value="drivers_licence">Driver’s licence number</option>
                <option value="asylum_doc">Asylum / refugee document number</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1.5">Document number</label>
              <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className={`${input} font-mono`} placeholder="Document number" />
            </div>
            <label className="flex items-start gap-2.5 p-3 bg-white dark:bg-night-card border border-line dark:border-night-line rounded-2xl cursor-pointer">
              <input type="checkbox" checked={walletTerms} onChange={(e) => setWalletTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand" />
              <span className="text-[11px] text-ink-soft dark:text-mist-soft leading-relaxed">
                I agree to the Wallet{' '}
                <button type="button" className="text-brand underline font-bold" onClick={() => setLegalModal('terms')}>
                  Terms
                </button>
                . This only registers interest and does not unlock financial features yet.
              </span>
            </label>
            <button onClick={submitWallet} disabled={busy || docNumber.trim().length < 5 || !walletTerms} className={primary}>
              {busy && <Spinner className="w-4 h-4 text-white" />}
              <span>Pre-register &amp; continue →</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWalletOptedIn(false);
                setStep('done');
              }}
              className="w-full pt-1 text-xs font-bold text-ink-soft dark:text-mist-soft hover:text-brand underline cursor-pointer"
            >
              No wallet needed for now →
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-block bg-gold/10 text-gold font-bold text-[10px] uppercase px-3 py-1 rounded-full mb-2">
                {BRANDING.appName} Wallet — coming soon
              </div>
              <h2 className="font-bold text-lg text-ink dark:text-mist">You're all set!</h2>
              <p className="text-xs text-ink-soft dark:text-mist-soft max-w-xs mx-auto mt-1 leading-relaxed">
                {walletOptedIn
                  ? 'Your pre-registration is saved. Wallet features unlock automatically when we reach our community milestone.'
                  : 'You can chat, call, post on Discover and share status updates right away.'}
              </p>
            </div>
            <div className="bg-white dark:bg-night-card border border-line dark:border-night-line rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-soft dark:text-mist-soft flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand" /> Community progress
                </span>
                <span className="font-bold font-mono">
                  {userCount === null ? '…' : userCount.toLocaleString()} / {goal.toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 w-full bg-line dark:bg-night-line rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
            </div>
            <button onClick={onFinished} className={primary}>
              Continue to {BRANDING.appName} →
            </button>
          </div>
        )}
      </div>

      <div ref={captchaHostRef} aria-hidden="true" />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};
