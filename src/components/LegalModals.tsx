import React from 'react';
import { X, Shield, FileText, Users } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | 'guidelines' | null;

interface LegalModalProps {
  type: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const contentMap = {
    terms: {
      title: 'Terms of Service',
      icon: FileText,
      subtitle: 'Effective Date: January 2026 · Version 2.4',
      sections: [
        {
          heading: '1. Acceptance of Terms',
          body: 'By downloading, accessing, or using Blue Chats, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use our services.',
        },
        {
          heading: '2. Dual-Storage Cloud Architecture',
          body: 'Blue Chats uses Firebase Firestore for persistent text messages, account credentials, and friend requests. All heavy multimedia (voice recordings, photos, video calls, status updates) are processed and distributed via Bunny.net Edge Storage and CDN. Server-side credentials are never exposed to client applications.',
        },
        {
          heading: '3. Blue Chats Wallet Pre-Registration & FICA',
          body: 'The Blue Chats Wallet is currently in pre-registration and will unlock automatically once our network reaches 50,000 verified users. Providing your National ID, Passport, Driver’s Licence, or Asylum/Refugee Documentation registers your early eligibility under South African FICA requirements and POPIA regulations. No financial transactions, debit balances, or payment transfers will be executed until official regulatory activation.',
        },
        {
          heading: '4. User Conduct & Acceptable Use',
          body: 'You agree not to transmit illegal, fraudulent, harmful, or copyright-infringing content on Blue Chats or its Discover feed. Blue Chats reserves the right to suspend or terminate accounts that breach our Community Guidelines.',
        },
        {
          heading: '5. Limitation of Liability',
          body: 'Blue Chats is provided "as is" without express or implied warranties. In no event shall Blue Chats or its affiliates be liable for indirect or consequential damages.',
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy & POPIA Notice',
      icon: Shield,
      subtitle: 'Protection of Personal Information Act (POPIA) & GDPR Compliance',
      sections: [
        {
          heading: '1. Information We Collect',
          body: 'We collect your phone number, display name, recovery email address, and optional identity documentation (National ID, Passport, Driver’s Licence, or Asylum document) for wallet pre-registration. Identity numbers are encrypted and masked (e.g. 9408******083).',
        },
        {
          heading: '2. Purpose of Processing',
          body: 'We process personal information strictly to authenticate your account, deliver end-to-end messaging, facilitate user discovery, and maintain an audit log for administrative oversight in compliance with South African data privacy laws.',
        },
        {
          heading: '3. Data Storage & Security',
          body: 'Database records are stored in secure Firebase Firestore instances. Media assets are streamed through Bunny.net with private edge token authentication. We never sell personal data to third parties or advertising brokers.',
        },
        {
          heading: '4. Your Privacy Rights',
          body: 'You hold the right to request access to your stored personal data, request correction of inaccurate records, or delete your account and associated chat histories directly from the Settings menu.',
        },
        {
          heading: '5. Administrative Auditing',
          body: 'Any access to user logs or administrative dashboards by authorized CEO/Admin personnel is logged to an immutable audit ledger (adminAccessLog) with timestamps and administrative identities.',
        },
      ],
    },
    guidelines: {
      title: 'Community Guidelines',
      icon: Users,
      subtitle: 'Keeping Blue Chats respectful, vibrant, and safe for all',
      sections: [
        {
          heading: '1. Respect and Inclusivity',
          body: 'Blue Chats connects people globally across Africa and the world. Treat fellow users with respect regardless of nationality, ethnicity, gender, religion, or background.',
        },
        {
          heading: '2. Discover Feed Standards',
          body: 'Content published to the public Discover feed must be suitable for a general audience. Explicit pornography, hate speech, harassment, graphic violence, and deceptive spam are strictly prohibited.',
        },
        {
          heading: '3. Identity and Impersonation',
          body: 'Do not impersonate other individuals, public figures, or organizations. Verified badge misuse will result in an immediate account ban.',
        },
        {
          heading: '4. Reporting and Blocking',
          body: 'If you encounter inappropriate behavior or content, use the "Report" or "Block" action located on the user’s profile or post menu. Our moderation team reviews all reports promptly.',
        },
      ],
    },
  };

  const current = contentMap[type];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-[#0B1330] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3B6BFA]/20 border border-[#3B6BFA]/40 flex items-center justify-center text-[#4DD8E8]">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">{current.title}</h2>
              <p className="text-[11px] text-[#AEB4DA]">{current.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed">
          {current.sections.map((sec, idx) => (
            <div key={idx} className="bg-[#F4F6FC] dark:bg-[#0B1130] p-4 rounded-2xl border border-[#E4E8F7]/80 dark:border-[#242D57]/70">
              <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF] mb-1.5">
                {sec.heading}
              </h3>
              <p>{sec.body}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-[#131B3E] border-t border-[#E4E8F7] dark:border-[#242D57] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close &amp; Accept
          </button>
        </div>
      </div>
    </div>
  );
};
