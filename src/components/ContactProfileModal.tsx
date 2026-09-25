import React, { useState } from 'react';
import {
  X,
  Phone,
  Video,
  MessageSquare,
  ShieldAlert,
  Ban,
  Users,
  CheckCircle2,
  Globe,
  MapPin,
  Flag,
} from 'lucide-react';

interface ContactProfileModalProps {
  contact: {
    id: string;
    name: string;
    avatar?: string;
    avatarColor?: string;
    phone?: string;
    about?: string;
    country?: string;
    online?: boolean;
    isBlocked?: boolean;
  };
  onClose: () => void;
  onStartVoiceCall?: (id: string, name: string) => void;
  onStartVideoCall?: (id: string, name: string) => void;
  onStartChat?: (id: string, name: string) => void;
  onToggleBlock?: (id: string, shouldBlock: boolean) => void;
  onReport?: (id: string, name: string) => void;
}

export const ContactProfileModal: React.FC<ContactProfileModalProps> = ({
  contact,
  onClose,
  onStartVoiceCall,
  onStartVideoCall,
  onStartChat,
  onToggleBlock,
  onReport,
}) => {
  const [blocked, setBlocked] = useState(contact.isBlocked || false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate messages');

  // Shared common groups mock list
  const sharedGroups = [
    { id: 'g1', name: 'Blue Chats Community South Africa', membersCount: 1420 },
    { id: 'g2', name: 'Cape Town & Joburg Creators', membersCount: 380 },
  ];

  const handleBlockToggle = () => {
    const nextState = !blocked;
    setBlocked(nextState);
    if (onToggleBlock) {
      onToggleBlock(contact.id, nextState);
    }
  };

  const submitReport = () => {
    setReportSuccess(true);
    if (onReport) {
      onReport(contact.id, contact.name);
    }
    setTimeout(() => {
      setShowReportPrompt(false);
      setReportSuccess(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header Hero */}
        <div className="relative bg-gradient-to-br from-[#0B1330] via-[#101C42] to-[#152657] text-white p-6 pt-8 pb-6 text-center flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="relative inline-block mx-auto mb-3">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-xl mx-auto border-2 border-white/20"
              style={{ backgroundColor: contact.avatarColor || '#3B6BFA' }}
            >
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                contact.name.substring(0, 2).toUpperCase()
              )}
            </div>
            {contact.online && (
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#2FBE8F] border-2 border-[#0B1330] shadow-[0_0_8px_rgba(47,190,143,0.8)]"></span>
            )}
          </div>

          <h2 className="font-bold text-lg text-white truncate px-2">{contact.name}</h2>
          <p className="text-xs text-[#AEB4DA] mt-0.5 flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#4DD8E8]" />
            <span>{contact.country || 'South Africa'}</span>
          </p>

          {/* Action Row */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => {
                onClose();
                onStartChat?.(contact.id, contact.name);
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#4DD8E8]" />
              <span>Message</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onStartVoiceCall?.(contact.id, contact.name);
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Voice</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onStartVideoCall?.(contact.id, contact.name);
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Video</span>
            </button>
          </div>
        </div>

        {/* Scrollable details */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-[#0E1430] dark:text-[#EEF1FF]">
          {/* About / Status */}
          <div className="bg-[#F4F6FC] dark:bg-[#0B1130] p-3.5 rounded-2xl border border-[#E4E8F7]/80 dark:border-[#242D57]/70">
            <span className="text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider block mb-1">
              About
            </span>
            <p className="text-xs text-[#0E1430] dark:text-[#EEF1FF] leading-relaxed">
              {contact.about || 'Hey there! I am using Blue Chats to connect across Africa & the world.'}
            </p>
          </div>

          {/* Shared Groups */}
          <div className="bg-[#F4F6FC] dark:bg-[#0B1130] p-3.5 rounded-2xl border border-[#E4E8F7]/80 dark:border-[#242D57]/70">
            <span className="text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-[#3B6BFA]" />
              <span>Shared Groups ({sharedGroups.length})</span>
            </span>
            <div className="space-y-2">
              {sharedGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold truncate max-w-[200px]">{g.name}</span>
                  <span className="text-[10px] text-[#9AA1C4]">{g.membersCount} members</span>
                </div>
              ))}
            </div>
          </div>

          {/* Report or Block actions */}
          <div className="space-y-2 pt-1">
            {showReportPrompt ? (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl space-y-2.5">
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 block">
                  Select report reason:
                </span>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-white dark:bg-[#131B3E] border border-red-500/30 rounded-xl px-2.5 py-1.5 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
                >
                  <option value="Inappropriate messages">Inappropriate messages</option>
                  <option value="Spam / Scams">Spam / Scams</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Impersonation">Impersonation</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReportPrompt(false)}
                    className="flex-1 py-1.5 text-xs rounded-xl border border-red-500/30 text-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    className="flex-1 py-1.5 text-xs rounded-xl bg-red-600 text-white font-bold"
                  >
                    Confirm Report
                  </button>
                </div>
              </div>
            ) : reportSuccess ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 text-center font-bold text-xs flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>User reported to moderation team</span>
              </div>
            ) : (
              <button
                onClick={() => setShowReportPrompt(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/5 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Report {contact.name}</span>
              </button>
            )}

            <button
              onClick={handleBlockToggle}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                blocked
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Ban className="w-4 h-4" />
              <span>{blocked ? `Unblock ${contact.name}` : `Block ${contact.name}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
