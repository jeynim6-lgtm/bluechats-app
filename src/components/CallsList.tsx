import React, { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Plus } from 'lucide-react';
import { CallRecord } from '../types';

interface CallsListProps {
  calls: CallRecord[];
  onStartCall: (partnerId: string, partnerName: string, type: 'voice' | 'video') => void;
}

export const CallsList: React.FC<CallsListProps> = ({ calls, onStartCall }) => {
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [activeRecording, setActiveRecording] = useState<string | null>(null);

  const filteredCalls = calls.filter((c) => {
    if (filter === 'missed') return c.direction === 'missed';
    return true;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDuration = (sec: number) => {
    if (sec === 0) return 'Missed';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  return (
    <div className="pb-24">
      {/* Filter Tabs */}
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-[#3B6BFA] text-white shadow-xs'
              : 'bg-white dark:bg-[#131B3E] text-[#5A6182] dark:text-[#AEB4DA] border border-[#E4E8F7] dark:border-[#242D57]'
          }`}
        >
          All Calls
        </button>
        <button
          onClick={() => setFilter('missed')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            filter === 'missed'
              ? 'bg-[#3B6BFA] text-white shadow-xs'
              : 'bg-white dark:bg-[#131B3E] text-[#5A6182] dark:text-[#AEB4DA] border border-[#E4E8F7] dark:border-[#242D57]'
          }`}
        >
          Missed
        </button>
      </div>

      {/* Calls List */}
      <div className="divide-y divide-[#E4E8F7]/60 dark:divide-[#242D57]/60">
        {filteredCalls.map((call) => (
          <div
            key={call.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-black/2 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-sm shadow-xs flex-shrink-0"
                style={{ backgroundColor: call.avatarColor || '#3B6BFA' }}
              >
                {getInitials(call.partnerName)}
              </div>

              {/* Call Details */}
              <div className="min-w-0">
                <h3
                  className={`font-bold text-sm truncate ${
                    call.direction === 'missed' ? 'text-red-500' : 'text-[#0E1430] dark:text-[#EEF1FF]'
                  }`}
                >
                  {call.partnerName}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-[#5A6182] dark:text-[#AEB4DA] mt-0.5">
                  {call.direction === 'incoming' && (
                    <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                  {call.direction === 'outgoing' && (
                    <PhoneOutgoing className="w-3.5 h-3.5 text-[#3B6BFA] flex-shrink-0" />
                  )}
                  {call.direction === 'missed' && (
                    <PhoneMissed className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}

                  <span>{call.timeFormatted}</span>
                  {call.durationSeconds > 0 && (
                    <span>· ({formatDuration(call.durationSeconds)})</span>
                  )}
                </div>

                {/* Bunny.net recording tag */}
                {call.recordingUrl && (
                  <button
                    onClick={() => setActiveRecording(call.recordingUrl || null)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#3B6BFA] bg-[#3B6BFA]/10 px-2 py-0.5 rounded-full mt-1 cursor-pointer hover:bg-[#3B6BFA]/20"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>Play Bunny Recording</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick redial action */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStartCall(call.partnerId, call.partnerName, call.type)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] text-[#3B6BFA] hover:bg-[#3B6BFA] hover:text-white transition-all shadow-xs cursor-pointer"
              >
                {call.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}

        {filteredCalls.length === 0 && (
          <div className="text-center py-12 text-[#9AA1C4]">
            <p className="text-sm font-medium">No calls in this view</p>
          </div>
        )}
      </div>

      {/* Recording Player Modal */}
      {activeRecording && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#131B3E] rounded-3xl p-4 border border-white/10 space-y-3">
            <h4 className="font-bold text-sm text-white">Call Recording on Bunny.net</h4>
            <video src={activeRecording} controls autoPlay className="w-full rounded-2xl bg-black" />
            <button
              onClick={() => setActiveRecording(null)}
              className="w-full bg-[#3B6BFA] text-white py-2 rounded-full font-bold text-xs cursor-pointer"
            >
              Close Recording
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
