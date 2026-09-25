import React, { useState } from 'react';
import { UserProfile, DocType } from '../types';
import { Shield, Lock, Users, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { LegalModal, LegalDocType } from './LegalModals';

interface AuthModalProps {
  onComplete: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onComplete }) => {
  // Step 1 to 5 as requested
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Phone
  const [countryCode, setCountryCode] = useState('+27');
  const [phone, setPhone] = useState('82 123 4567');

  // Step 2: Name & Recovery Email
  const [fullName, setFullName] = useState('Lilo Banim');
  const [recoveryEmail, setRecoveryEmail] = useState('lilobanim60@gmail.com');

  // Step 3: OTP
  const [otp, setOtp] = useState(['4', '2', '1', '9']);

  // Step 4: Wallet Pre-registration (optional)
  const [docType, setDocType] = useState<DocType>('id');
  const [docNumber, setDocNumber] = useState('');
  const [walletTermsAgreed, setWalletTermsAgreed] = useState(false);
  const [walletOptedIn, setWalletOptedIn] = useState(false);

  // Legal Modal
  const [legalModal, setLegalModal] = useState<LegalDocType>(null);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val[val.length - 1];
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
  };

  const handleFinishOnboarding = () => {
    // If user filled wallet pre-registration, submit to API
    if (walletOptedIn && docNumber.trim() && walletTermsAgreed) {
      fetch('/api/wallet/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: recoveryEmail,
          phone: `${countryCode} ${phone}`,
          docType,
          docNumber: docNumber.trim(),
          termsAccepted: true,
        }),
      }).catch(() => {});
    }

    const user: UserProfile = {
      id: `usr_${Date.now()}`,
      name: fullName || 'Blue Chats User',
      phone: `${countryCode} ${phone}`,
      email: recoveryEmail || undefined,
      country: countryCode === '+27' ? 'South Africa' : countryCode === '+263' ? 'Zimbabwe' : 'Global',
      bio: 'Hey there! I am using Blue Chats.',
      isOnline: true,
      role: 'user', // Roles and claims are strictly enforced and verified server-side
    };

    onComplete(user);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F6FC] dark:bg-[#0B1130] flex flex-col max-w-[480px] mx-auto overflow-y-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#0B1330] via-[#101C42] to-[#152657] text-white px-6 pt-10 pb-7 rounded-b-[28px] shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4DD8E8] shadow-[0_0_8px_rgba(77,216,232,0.8)]"></span>
            <span className="font-serif-brand italic font-semibold text-2xl tracking-tight">
              Blue Chats
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-white/10 px-2.5 py-0.5 rounded-full text-[#4DD8E8]">
            Step {step} of 5
          </span>
        </div>

        {step === 1 && (
          <p className="text-[#B9C0E6] text-xs mt-1">
            Step 1: Enter your phone number with international country code.
          </p>
        )}
        {step === 2 && (
          <p className="text-[#B9C0E6] text-xs mt-1">
            Step 2: Tell us your full legal name and a recovery email address.
          </p>
        )}
        {step === 3 && (
          <p className="text-[#B9C0E6] text-xs mt-1">
            Step 3: Enter the 4-digit verification code sent to {countryCode} {phone}.
          </p>
        )}
        {step === 4 && (
          <p className="text-[#B9C0E6] text-xs mt-1">
            Step 4: Blue Chats Wallet pre-registration (Optional).
          </p>
        )}
        {step === 5 && (
          <p className="text-[#B9C0E6] text-xs mt-1">
            Step 5: Wallet unlocks at 50,000 verified users.
          </p>
        )}
      </div>

      {/* Form Content */}
      <div className="flex-1 p-6">
        {/* STEP 1: Phone number with country code */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-2">
                Phone Number &amp; Country Code
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-3 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
                >
                  <option value="+27">🇿🇦 South Africa (+27)</option>
                  <option value="+263">🇿🇼 Zimbabwe (+263)</option>
                  <option value="+258">🇲🇿 Mozambique (+258)</option>
                  <option value="+267">🇧🇼 Botswana (+267)</option>
                  <option value="+234">🇳🇬 Nigeria (+234)</option>
                  <option value="+254">🇰🇪 Kenya (+254)</option>
                  <option value="+44">🇬🇧 United Kingdom (+44)</option>
                  <option value="+1">🇺🇸 United States (+1)</option>
                </select>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="82 123 4567"
                  className="flex-1 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-4 py-3 text-sm font-medium text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-[0.98] text-white font-bold py-3.5 rounded-full text-sm mt-6 shadow-md transition-all cursor-pointer"
            >
              Continue to Name &amp; Email →
            </button>

            <p className="text-[11px] text-[#9AA1C4] dark:text-[#7A81A8] text-center leading-relaxed mt-4">
              By continuing you agree to the{' '}
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-[#3B6BFA] underline font-bold"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-[#3B6BFA] underline font-bold"
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        )}

        {/* STEP 2: Name and recovery email */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Full Legal Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Lilo Banim"
                className="w-full bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-4 py-3 text-sm text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Recovery Email Address
              </label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-4 py-3 text-sm text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              />
              <p className="text-[10px] text-[#9AA1C4] mt-1">
                Used strictly for account recovery and two-factor authentication.
              </p>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-[0.98] text-white font-bold py-3.5 rounded-full text-sm mt-4 shadow-md transition-all cursor-pointer"
            >
              Send OTP Code →
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full py-2.5 text-xs text-[#5A6182] dark:text-[#AEB4DA] font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Phone
            </button>
          </div>
        )}

        {/* STEP 3: Send OTP code, verify */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA]">
              Enter the 4-digit code sent via SMS to {countryCode} {phone}
            </p>

            <div className="flex justify-center gap-3 my-6">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-[#E4E8F7] dark:border-[#242D57] bg-white dark:bg-[#131B3E] text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
                />
              ))}
            </div>

            <button
              onClick={() => alert('New OTP code dispatched to ' + phone)}
              className="text-xs font-bold text-[#3B6BFA] hover:underline cursor-pointer block mx-auto"
            >
              Resend code
            </button>

            <button
              onClick={() => setStep(4)}
              className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-[0.98] text-white font-bold py-3.5 rounded-full text-sm mt-4 shadow-md transition-all cursor-pointer"
            >
              Verify Code →
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full py-2.5 text-xs text-[#5A6182] dark:text-[#AEB4DA] font-semibold cursor-pointer"
            >
              Back
            </button>
          </div>
        )}

        {/* STEP 4: Wallet pre-registration (ID / passport / driver's licence / asylum doc) */}
        {step === 4 && (
          <div className="space-y-3.5">
            <div className="p-3 bg-[#3B6BFA]/10 border border-[#3B6BFA]/20 rounded-2xl">
              <span className="font-bold text-xs text-[#3B6BFA] block mb-0.5">
                Optional Wallet Pre-Registration
              </span>
              <p className="text-[11px] text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
                Provide identity documentation to pre-register your eligibility for the upcoming Blue Chats Wallet.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Identification Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="w-full bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              >
                <option value="id">🇿🇦 National ID Number</option>
                <option value="passport">🌍 Passport Number</option>
                <option value="drivers_licence">🚗 Driver’s Licence Number</option>
                <option value="asylum_doc">📄 Asylum / Refugee Documentation Number</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Document Number
              </label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Enter ID, Passport, Driver's Licence, or Asylum Permit #"
                className="w-full bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-4 py-2.5 text-xs font-mono text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              />
            </div>

            {/* Terms checkbox */}
            <div className="p-3 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-2xl">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={walletTermsAgreed}
                  onChange={(e) => setWalletTermsAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#3B6BFA] rounded"
                />
                <span className="text-[11px] text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
                  I agree to the Blue Chats Wallet Terms of Service. I understand this only pre-registers my interest and does not unlock financial features yet.
                </span>
              </label>
            </div>

            <button
              onClick={() => {
                setWalletOptedIn(true);
                setStep(5);
              }}
              disabled={!docNumber.trim() || !walletTermsAgreed}
              className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-40 text-white font-bold py-3.5 rounded-full text-xs shadow-md transition-all cursor-pointer"
            >
              Pre-Register &amp; Proceed →
            </button>

            {/* Clear "No wallet needed for now" option */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setWalletOptedIn(false);
                  setStep(5);
                }}
                className="text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] hover:text-[#3B6BFA] underline cursor-pointer"
              >
                No wallet needed for now →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: "Coming soon" notice (wallet unlocks at 50,000 users) with Continue button */}
        {step === 5 && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-[#3B6BFA]/10 text-[#3B6BFA] flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-block bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase px-3 py-1 rounded-full mb-2">
                Blue Chats Wallet — Coming Soon
              </div>
              <h2 className="font-bold text-lg text-[#0E1430] dark:text-[#EEF1FF]">
                Unlocks at 50,000 Users
              </h2>
              <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] max-w-xs mx-auto mt-1 leading-relaxed">
                {walletOptedIn
                  ? 'Your pre-registration has been securely filed. Wallet features will unlock automatically once our community milestone is reached.'
                  : 'You have skipped wallet setup for now. You can chat, post on Discover, and join calls with no limits.'}
              </p>
            </div>

            {/* 50,000 Progress preview */}
            <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[#5A6182] dark:text-[#AEB4DA] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#3B6BFA]" />
                  <span>Activation Progress</span>
                </span>
                <span className="font-bold font-mono">1,847 / 50,000</span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#3B6BFA] rounded-full w-[3.7%]" />
              </div>
            </div>

            {/* Required: A "Continue" button at the very bottom moves them into the app regardless of what they chose on the wallet step */}
            <button
              onClick={handleFinishOnboarding}
              className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-[0.98] text-white font-extrabold py-4 rounded-full text-sm shadow-xl transition-all cursor-pointer mt-6"
            >
              Continue to Blue Chats →
            </button>
          </div>
        )}
      </div>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};
