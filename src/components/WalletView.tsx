import React, { useState, useEffect } from 'react';
import {
  Lock,
  Shield,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { DocType, WalletApplicant } from '../types';
import { LegalModal, LegalDocType } from './LegalModals';

interface WalletViewProps {
  onOpenTerms?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = () => {
  const currentUserCount = 1847;
  const goal = 50000;
  const pct = Math.min(100, (currentUserCount / goal) * 100);

  // Pre-registration form state
  const [docType, setDocType] = useState<DocType>('id');
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState('Lilo Banim');
  const [email, setEmail] = useState('lilobanim60@gmail.com');
  const [phone, setPhone] = useState('+27 82 123 4567');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [legalModalType, setLegalModalType] = useState<LegalDocType>(null);

  // Saved applicant status
  const [savedApplicant, setSavedApplicant] = useState<WalletApplicant | null>(() => {
    const raw = localStorage.getItem('bluechats_wallet_applicant');
    return raw ? JSON.parse(raw) : null;
  });

  const docTypeLabels: Record<DocType, { name: string; placeholder: string; example: string }> = {
    id: {
      name: 'National Identity Number (ID)',
      placeholder: '13-digit South African ID number',
      example: 'e.g. 9408155092083',
    },
    passport: {
      name: 'Passport Number',
      placeholder: 'International passport document number',
      example: 'e.g. A01234567',
    },
    drivers_licence: {
      name: 'Driver’s Licence Number',
      placeholder: 'Official driver’s licence number',
      example: 'e.g. DL-987654321',
    },
    asylum_doc: {
      name: 'Asylum / Refugee Documentation Number',
      placeholder: 'Department of Home Affairs Section 22 / 24 permit number',
      example: 'e.g. ASY-2026-087612',
    },
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) {
      setErrorMsg('You must agree to the Terms of Service to pre-register.');
      return;
    }
    if (!docNumber.trim()) {
      setErrorMsg('Please enter your document number.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        name: fullName,
        email,
        phone,
        docType,
        docNumber: docNumber.trim(),
        termsAccepted: true,
      };

      const res = await fetch('/api/wallet/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application');

      // Mask document number locally for privacy compliance
      const raw = docNumber.trim();
      const masked =
        raw.length > 7
          ? `${raw.substring(0, 4)}${'*'.repeat(raw.length - 7)}${raw.substring(raw.length - 3)}`
          : `${raw.substring(0, 2)}****`;

      const applicantData: WalletApplicant = {
        id: data.applicant?.id || `app_${Date.now()}`,
        uid: 'current_user',
        name: fullName,
        email,
        phone,
        docType,
        docNumberMasked: masked,
        termsAccepted: true,
        status: 'pre-registered',
        appliedAt: Date.now(),
      };

      setSavedApplicant(applicantData);
      localStorage.setItem('bluechats_wallet_applicant', JSON.stringify(applicantData));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error pre-registering. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24 p-4 space-y-4">
      {/* LOCKED STATE BANNER */}
      <div className="bg-gradient-to-br from-[#0B1330] via-[#101C42] to-[#152657] text-white rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#3B6BFA]/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Lock header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#4DD8E8] shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <h1 className="text-xl font-bold font-serif-brand tracking-tight text-white">
              Blue Chats Wallet
            </h1>
          </div>
        </div>

        <p className="text-xs text-[#B9C0E6] leading-relaxed mb-5">
          The next-generation African &amp; global digital wallet is currently preparing for activation. Unlocks automatically when our community reaches <strong>50,000 users</strong>.
        </p>

        {/* 50,000-User Progress Bar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#AEB4DA] font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#4DD8E8]" />
              <span>Community Activation Goal</span>
            </span>
            <span className="font-bold text-white font-mono">
              {currentUserCount.toLocaleString()} / {goal.toLocaleString()}
            </span>
          </div>

          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#3B6BFA] via-[#4DD8E8] to-[#2FBE8F] rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(77,216,232,0.6)]"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-[#AEB4DA]">
            <span>{pct.toFixed(1)}% reached</span>
            <span>Unlocks at 50k users</span>
          </div>
        </div>
      </div>

      {/* PRE-REGISTRATION STATUS OR FORM */}
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3B6BFA]" />
          <h2 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF]">
            Identity Consent &amp; Pre-Registration
          </h2>
        </div>

        {savedApplicant ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pre-Registration Recorded (Early Access List)</span>
            </div>

            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
              Your eligibility details have been submitted for verification. Wallet features will stay safely locked until the 50,000 user threshold is achieved.
            </p>

            <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-[#9AA1C4]">Applicant:</span>
                <span className="font-bold">{savedApplicant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA1C4]">Doc Type:</span>
                <span className="font-bold uppercase">{savedApplicant.docType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA1C4]">Doc Number:</span>
                <span className="font-bold text-[#3B6BFA]">{savedApplicant.docNumberMasked}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSavedApplicant(null);
                localStorage.removeItem('bluechats_wallet_applicant');
              }}
              className="text-[11px] font-bold text-[#3B6BFA] hover:underline cursor-pointer"
            >
              Update or submit different ID documentation →
            </button>
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-4">
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
              Pre-register with your identification to prepare for FICA compliance when the wallet launches. This step does not unlock any financial capabilities today.
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Document Type Radio Selector (All 4 supported) */}
            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-2">
                Select Document Type
              </label>

              <div className="grid grid-cols-1 gap-2">
                {(['id', 'passport', 'drivers_licence', 'asylum_doc'] as DocType[]).map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      docType === type
                        ? 'border-[#3B6BFA] bg-[#3B6BFA]/5 dark:bg-[#3B6BFA]/10'
                        : 'border-[#E4E8F7] dark:border-[#242D57] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="docType"
                      value={type}
                      checked={docType === type}
                      onChange={() => setDocType(type)}
                      className="accent-[#3B6BFA]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#0E1430] dark:text-[#EEF1FF] block">
                        {docTypeLabels[type].name}
                      </span>
                      <span className="text-[10px] text-[#9AA1C4]">
                        {docTypeLabels[type].example}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Document Number Input */}
            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                {docTypeLabels[docType].name}
              </label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder={docTypeLabels[docType].placeholder}
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-4 py-3 text-xs font-mono text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              />
              <span className="text-[10px] text-[#9AA1C4] block mt-1">
                🔒 Data is encrypted and masked for South African POPIA compliance
              </span>
            </div>

            {/* Name & Email confirmation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1">
                  Recovery Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
                />
              </div>
            </div>

            {/* Mandatory Terms Agreement Checkbox */}
            <div className="p-3 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#3B6BFA] rounded cursor-pointer"
                />
                <span className="text-xs text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
                  I agree to the Blue Chats Wallet{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModalType('terms')}
                    className="text-[#3B6BFA] font-bold underline cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModalType('privacy')}
                    className="text-[#3B6BFA] font-bold underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  . I understand this registers early interest and does not unlock account balances or transfers yet.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              {submitting ? 'Recording pre-registration...' : 'Pre-Register for Blue Chats Wallet'}
            </button>
          </form>
        )}
      </div>

      {/* Legal & Regulation Footer */}
      <div className="p-4 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7]/80 dark:border-[#242D57] text-center space-y-1">
        <p className="text-[11px] font-bold text-[#0E1430] dark:text-[#EEF1FF]">
          Regulatory Compliance Notice
        </p>
        <p className="text-[10px] text-[#9AA1C4] leading-relaxed">
          Blue Chats Wallet is adhering to South African Reserve Bank (SARB) and Financial Intelligence Centre Act (FICA) standards. Stored in <code>walletApplicants</code> collection.
        </p>
      </div>

      {/* Legal Modals */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
    </div>
  );
};
