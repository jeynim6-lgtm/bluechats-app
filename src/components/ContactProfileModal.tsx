import React, { useMemo, useState } from 'react';
import { X, Phone, Video, MessageSquare, Ban, Users, CheckCircle2, MapPin, Flag, UserPlus, Check } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData, useUserProfile, useNow } from '../context/AppDataContext';
import { useCalls } from '../context/CallContext';
import { setBlocked } from '../services/users';
import { reportUser } from '../services/reports';
import { sendFriendRequest } from '../services/discover';
import { formatLastSeen, isOnline } from '../lib/format';
import { useT } from '../lib/i18n';
import { Avatar, toast } from './ui';

export interface ProfileTarget {
  uid: string;
  name: string;
  avatarColor?: string;
  avatarUrl?: string | null;
}

const REPORT_REASONS = ['Spam or scam', 'Harassment or bullying', 'Inappropriate content', 'Impersonation', 'Other'];

export const ContactProfileModal: React.FC<{ target: ProfileTarget; onClose: () => void }> = ({ target, onClose }) => {
  const me = useMe();
  const t = useT();
  useNow(30_000);
  const { contactsByUid, blocked, chats, openDirectChat } = useAppData();
  const { startCall, call } = useCalls();
  const profile = useUserProfile(target.uid);
  const contact = contactsByUid.get(target.uid);
  const isMe = target.uid === me.uid;
  const isBlocked = blocked.has(target.uid);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [reported, setReported] = useState(false);
  const [requested, setRequested] = useState(false);

  const name = contact?.name || profile?.name || target.name;
  const color = profile?.avatarColor || target.avatarColor || '#3B6BFA';
  const url = profile?.avatarUrl ?? target.avatarUrl;
  const sharedGroups = useMemo(
    () => chats.filter((c) => c.type === 'group' && c.participants.includes(target.uid) && c.participants.includes(me.uid)),
    [chats, target.uid, me.uid]
  );
  const hasChat = chats.some((c) => c.type === 'direct' && c.participants.includes(target.uid));
  const partner = { uid: target.uid, name, avatarColor: color, avatarUrl: url };

  const toggleBlock = async () => {
    if (!isBlocked && !window.confirm(`Block ${name}? They won't be able to call you and their messages will be hidden.`)) return;
    try {
      await setBlocked(me.uid, target.uid, !isBlocked);
      toast(isBlocked ? `${name} unblocked` : `${name} blocked`);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const submitReport = async () => {
    try {
      await reportUser(me, { uid: target.uid, name }, reason);
      setReported(true);
      setReporting(false);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const action = 'flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} profile`}
      >
        <div className="relative bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white p-6 pt-8 text-center flex-shrink-0">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <Avatar name={name} color={color} url={url} size={84} online={isOnline(profile?.lastSeen)} className="mx-auto mb-3" />
          <h2 className="font-bold text-lg truncate px-2">{name}</h2>
          {contact && profile && contact.name !== profile.name && <p className="text-[11px] text-haze">~{profile.name}</p>}
          <p className="text-xs text-accent mt-0.5">{isMe ? 'This is you' : formatLastSeen(profile?.lastSeen)}</p>

          {!isMe && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => {
                  onClose();
                  openDirectChat(target.uid).catch((err) => toast(err.message));
                }}
                className={action}
              >
                <MessageSquare className="w-4 h-4 text-accent" /> {t('message')}
              </button>
              <button
                onClick={() => {
                  onClose();
                  startCall(partner, 'voice');
                }}
                disabled={isBlocked || Boolean(call)}
                className={action}
              >
                <Phone className="w-4 h-4 text-emerald-400" /> Voice
              </button>
              <button
                onClick={() => {
                  onClose();
                  startCall(partner, 'video');
                }}
                disabled={isBlocked || Boolean(call)}
                className={action}
              >
                <Video className="w-4 h-4 text-cyan-400" /> Video
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3 overflow-y-auto text-xs">
          <div className="bg-paper dark:bg-night p-3.5 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider block">About</span>
            <p className="leading-relaxed">{profile?.bio || 'Hey there! I am using Blue Chats.'}</p>
            {profile?.country && (
              <p className="flex items-center gap-1.5 text-ink-soft dark:text-mist-soft">
                <MapPin className="w-3.5 h-3.5 text-accent" /> {profile.country}
              </p>
            )}
            {contact?.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-brand font-semibold">
                <Phone className="w-3.5 h-3.5" /> {contact.phone}
              </a>
            )}
          </div>

          {sharedGroups.length > 0 && (
            <div className="bg-paper dark:bg-night p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-brand" /> Groups in common ({sharedGroups.length})
              </span>
              {sharedGroups.map((g) => (
                <div key={g.id} className="flex justify-between py-0.5">
                  <span className="font-semibold truncate">{g.name}</span>
                  <span className="text-ink-faint">{g.participants.length} members</span>
                </div>
              ))}
            </div>
          )}

          {!isMe && !contact && !hasChat && (
            <button
              onClick={async () => {
                try {
                  await sendFriendRequest(me, { uid: target.uid, name, avatarColor: color, avatarUrl: url });
                  setRequested(true);
                } catch (err) {
                  toast((err as Error).message);
                }
              }}
              disabled={requested}
              className="w-full py-2.5 rounded-xl bg-brand/10 text-brand font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {requested ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {requested ? 'Friend request sent' : 'Send friend request'}
            </button>
          )}

          {!isMe && (
            <div className="space-y-2 pt-1">
              {reported ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 text-center font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Report sent to the moderation team
                </div>
              ) : reporting ? (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl space-y-2.5">
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 block">Why are you reporting {name}?</span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-white dark:bg-night-card border border-red-500/30 rounded-xl px-2.5 py-1.5"
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setReporting(false)} className="flex-1 py-1.5 rounded-xl border border-red-500/30 cursor-pointer">
                      {t('cancel')}
                    </button>
                    <button onClick={submitReport} className="flex-1 py-1.5 rounded-xl bg-red-600 text-white font-bold cursor-pointer">
                      Report
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReporting(true)}
                  className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/5 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flag className="w-4 h-4" /> Report {name}
                </button>
              )}
              <button
                onClick={toggleBlock}
                className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer text-white ${
                  isBlocked ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <Ban className="w-4 h-4" /> {isBlocked ? `Unblock ${name}` : `Block ${name}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
