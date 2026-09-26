import React from 'react';
import { Shield, FileText, Users } from 'lucide-react';
import { BRANDING } from '../config/branding';
import { Sheet } from './ui';

export type LegalDocType = 'terms' | 'privacy' | 'guidelines' | null;

const APP = BRANDING.appName;

const CONTENT = {
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    subtitle: `Version ${BRANDING.version}`,
    sections: [
      {
        heading: '1. Acceptance of terms',
        body: `By creating an account or using ${APP} you agree to these Terms. If you do not agree, do not use the service.`,
      },
      {
        heading: '2. Your account',
        body: 'You sign in with a phone number verified by SMS. You are responsible for activity on your account and for keeping your device secure. You must be at least 13 years old (or the minimum age in your country).',
      },
      {
        heading: '3. How the service works',
        body: `Messages, profiles and call signalling are stored in Google Firebase. Photos, videos, voice notes, documents and call recordings are stored on Bunny.net and delivered through ${APP}'s servers or CDN. Voice and video calls connect directly between devices where possible, using encrypted WebRTC media.`,
      },
      {
        heading: `4. ${APP} Wallet pre-registration`,
        body: `The Wallet is not yet available. Pre-registering only records your interest and eligibility; no balances, payments or transfers exist until the Wallet officially launches under applicable South African financial regulation (including FICA). The Wallet unlocks when ${APP} reaches ${BRANDING.wallet.unlockGoal.toLocaleString()} users.`,
      },
      {
        heading: '5. Acceptable use',
        body: 'Do not send or post illegal, fraudulent, harassing, hateful or infringing content, spam, or malware, and do not record calls without complying with the law where you live. We may suspend accounts that break these Terms or the Community Guidelines.',
      },
      {
        heading: '6. Liability',
        body: `${APP} is provided "as is". To the extent permitted by law, we are not liable for indirect or consequential losses arising from your use of the service.`,
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy & POPIA notice',
    icon: Shield,
    subtitle: 'Protection of Personal Information Act (POPIA) & GDPR',
    sections: [
      {
        heading: '1. What we collect',
        body: 'Your phone number (for sign-in), display name, optional profile photo, "about" text and optional recovery email; the contacts you choose to save; messages, media and posts you send; call history; and basic presence ("last seen"). Wallet pre-registration stores your document type, a masked document number and a one-way hash of it — the full number never leaves your device.',
      },
      {
        heading: '2. Who can see what',
        body: 'Your name, photo, about text, country and last-seen time are visible to other signed-in users. Your phone number and email are private: people can only find you by entering your exact number. Messages are readable only by the participants of each chat. Status updates are visible to your contacts and people you chat with for 24 hours.',
      },
      {
        heading: '3. Media links',
        body: 'Shared photos, videos, voice notes and documents are stored with long, unguessable addresses. Anyone who obtains such a link can open the file, so only share sensitive media with people you trust.',
      },
      {
        heading: '4. Calls and recordings',
        body: 'Call audio and video are encrypted in transit (DTLS-SRTP) and usually flow directly between devices; a relay server may be used when a direct connection is impossible, but it cannot decrypt your call. Calls are only recorded when a participant starts a recording, and the other participant is shown a notice.',
      },
      {
        heading: '5. Your rights',
        body: 'You can view and edit your profile, remove your contacts, withdraw your wallet pre-registration and permanently delete your account from Settings. You may also contact us to request access to or correction of your information.',
      },
      {
        heading: '6. Administration',
        body: 'Only staff with a server-assigned administrator role can view moderation reports and aggregate statistics, and each dashboard access is recorded in an audit log.',
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    icon: Users,
    subtitle: `Keeping ${APP} respectful and safe`,
    sections: [
      { heading: '1. Respect everyone', body: `${APP} connects people across Africa and the world. Treat others with respect regardless of nationality, ethnicity, gender, religion or background.` },
      { heading: '2. Discover standards', body: 'Public posts must be suitable for a general audience. Nudity, hate speech, harassment, graphic violence and scams are not allowed.' },
      { heading: '3. Be yourself', body: 'Do not impersonate other people, public figures or organisations.' },
      { heading: '4. Report and block', body: 'Use "Report" and "Block" on any profile to protect yourself. Reports go to our moderation team.' },
    ],
  },
};

export const LegalModal: React.FC<{ type: LegalDocType; onClose: () => void }> = ({ type, onClose }) => {
  if (!type) return null;
  const doc = CONTENT[type];
  const Icon = doc.icon;
  return (
    <Sheet
      wide
      z="z-[75]"
      title={
        <>
          <Icon className="w-4 h-4 text-brand" />
          <span>
            {doc.title}
            <span className="block text-[10px] font-normal text-ink-faint">{doc.subtitle}</span>
          </span>
        </>
      }
      onClose={onClose}
      footer={
        <button onClick={onClose} className="w-full py-2.5 rounded-full bg-brand hover:bg-brand-strong text-white font-bold text-xs cursor-pointer">
          Close
        </button>
      }
    >
      <div className="p-5 space-y-3 text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
        {doc.sections.map((s) => (
          <div key={s.heading} className="bg-paper dark:bg-night p-4 rounded-2xl">
            <h3 className="font-bold text-sm text-ink dark:text-mist mb-1.5">{s.heading}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </Sheet>
  );
};
