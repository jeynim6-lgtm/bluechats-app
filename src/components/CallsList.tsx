import React, { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, PhoneCall } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useCalls } from '../context/CallContext';
import { formatListTime, formatClock, formatDuration } from '../lib/format';
import { useT } from '../lib/i18n';
import { Avatar } from './ui';
import type { CallRecord } from '../types';
import type { ProfileTarget } from './ContactProfileModal';

interface CallsListProps {
  records: CallRecord[];
  onOpenProfile: (target: ProfileTarget) => void;
}

function describe(call: CallRecord): string {
  if (call.durationSeconds > 0) return formatDuration(call.durationSeconds);
  const outgoing = call.direction === 'outgoing';
  switch (call.status) {
    case 'declined':
      return outgoing ? 'Declined' : 'You declined';
    case 'busy':
      return outgoing ? 'Busy' : 'Missed (busy)';
    case 'missed':
      return outgoing ? 'No answer' : 'Missed';
    case 'cancelled':
      return outgoing ? 'Cancelled' : 'Missed';
    case 'failed':
      return 'Failed to connect';
    default:
      return '';
  }
}

export const CallsList: React.FC<CallsListProps> = ({ records, onOpenProfile }) => {
  const t = useT();
  const { displayName, blocked } = useAppData();
  const { startCall, call: activeCall } = useCalls();
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [playing, setPlaying] = useState<CallRecord | null>(null);

  const list = records.filter((r) => (filter === 'missed' ? r.direction === 'missed' : true));

  const pill = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
      active ? 'bg-brand text-white shadow-xs' : 'bg-white dark:bg-night-card text-ink-soft dark:text-mist-soft border border-line dark:border-night-line'
    }`;

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex gap-2">
        <button onClick={() => setFilter('all')} className={pill(filter === 'all')}>
          {t('allCalls')}
        </button>
        <button onClick={() => setFilter('missed')} className={pill(filter === 'missed')}>
          {t('missed')}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-14 px-8 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
            <PhoneCall className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-sm">{filter === 'missed' ? 'No missed calls' : 'No calls yet'}</h3>
          <p className="text-xs text-ink-soft dark:text-mist-soft">Open a chat or a contact and tap the phone or video icon to call — free, over the internet.</p>
        </div>
      ) : (
        <div className="divide-y divide-line/60 dark:divide-night-line/60">
          {list.map((call) => {
            const name = displayName(call.partnerId, call.partnerName);
            const partner = { uid: call.partnerId, name, avatarColor: call.avatarColor, avatarUrl: call.avatarUrl };
            const missed = call.direction === 'missed';
            return (
              <div key={call.id} className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/5">
                <button onClick={() => onOpenProfile(partner)} className="flex items-center gap-3.5 min-w-0 text-left cursor-pointer">
                  <Avatar name={name} color={call.avatarColor} url={call.avatarUrl} size={48} />
                  <div className="min-w-0">
                    <h3 className={`font-bold text-sm truncate ${missed ? 'text-red-500' : 'text-ink dark:text-mist'}`}>{name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-mist-soft mt-0.5">
                      {call.direction === 'incoming' && <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                      {call.direction === 'outgoing' && <PhoneOutgoing className="w-3.5 h-3.5 text-brand flex-shrink-0" />}
                      {missed && <PhoneMissed className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      {call.type === 'video' ? <Video className="w-3 h-3 flex-shrink-0" /> : <Phone className="w-3 h-3 flex-shrink-0" />}
                      <span className="truncate">
                        {formatListTime(call.timestamp)}
                        {formatListTime(call.timestamp).includes(':') ? '' : `, ${formatClock(call.timestamp)}`}
                        {describe(call) && ` · ${describe(call)}`}
                      </span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {call.recordingUrl && (
                    <button
                      onClick={() => setPlaying(call)}
                      aria-label="Play recording"
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  )}
                  <button
                    onClick={() => startCall(partner, call.type)}
                    disabled={Boolean(activeCall) || blocked.has(call.partnerId)}
                    aria-label={`Call ${name} again`}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-night-card border border-line dark:border-night-line text-brand hover:bg-brand hover:text-white transition-all shadow-xs cursor-pointer disabled:opacity-40"
                  >
                    {call.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playing?.recordingUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-sm bg-night-card rounded-3xl p-4 border border-white/10 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-sm text-white">
              Call recording · {displayName(playing.partnerId, playing.partnerName)}
            </h4>
            {playing.type === 'video' ? (
              <video src={playing.recordingUrl} controls autoPlay playsInline className="w-full rounded-2xl bg-black" />
            ) : (
              <audio src={playing.recordingUrl} controls autoPlay className="w-full" />
            )}
            <button onClick={() => setPlaying(null)} className="w-full bg-brand text-white py-2 rounded-full font-bold text-xs cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
