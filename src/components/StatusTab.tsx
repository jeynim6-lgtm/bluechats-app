import React from 'react';
import { Plus } from 'lucide-react';
import { StatusContact } from '../types';

interface StatusTabProps {
  contacts: StatusContact[];
  onOpenStory: (contactIndex: number) => void;
  onOpenComposer: () => void;
}

export const StatusTab: React.FC<StatusTabProps> = ({
  contacts,
  onOpenStory,
  onOpenComposer,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="pb-24">
      {/* Prototype Banner */}
      <div className="mx-4 mt-3 p-3.5 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-2xl text-xs text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed shadow-xs">
        <strong className="text-[#0E1430] dark:text-[#EEF1FF]">Status Stories —</strong> Tap any circle to view updates. Tap right to advance or hold to pause. Photos and videos stream via Bunny.net CDN.
      </div>

      {/* My Status */}
      <div className="px-4 py-3">
        <div
          onClick={onOpenComposer}
          className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-black/2 dark:hover:bg-white/5 active:bg-black/5 cursor-pointer transition-colors"
        >
          <div className="relative">
            <div className="w-13 h-13 rounded-full bg-white dark:bg-[#131B3E] border-2 border-dashed border-[#6E8CFF] flex items-center justify-center text-[#3B6BFA] font-bold text-xl shadow-xs">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#3B6BFA] text-white flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-[#131B3E]">
              +
            </span>
          </div>

          <div>
            <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF]">My Status</h3>
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA]">Tap to add status (text, photo, video)</p>
          </div>
        </div>
      </div>

      {/* Stories Horizontal Row */}
      <div className="pt-2 pb-4">
        <div className="px-4 mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0E1430] dark:text-[#EEF1FF] tracking-tight">
            Recent updates
          </h2>
          <span className="text-[11px] font-semibold text-[#3B6BFA]">{contacts.length} stories</span>
        </div>

        <div className="flex gap-3.5 overflow-x-auto px-4 no-scrollbar">
          {contacts.map((contact, idx) => (
            <div
              key={contact.id}
              onClick={() => onOpenStory(idx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 cursor-pointer group"
            >
              {/* Conic gradient ring */}
              <div
                className={`w-15 h-15 rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                  contact.seen
                    ? 'bg-[#E4E8F7] dark:bg-[#242D57]'
                    : 'bg-gradient-to-tr from-[#4DD8E8] via-[#3B6BFA] to-[#8A6CF2]'
                }`}
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-xs border-2 border-white dark:border-[#0B1130] shadow-xs"
                  style={{ backgroundColor: contact.avatarColor }}
                >
                  {getInitials(contact.name)}
                </div>
              </div>

              <span className="text-xs font-semibold text-[#5A6182] dark:text-[#AEB4DA] text-center w-full truncate">
                {contact.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Updates List */}
      <div className="mt-2 divide-y divide-[#E4E8F7]/60 dark:divide-[#242D57]/60 border-t border-[#E4E8F7] dark:border-[#242D57]">
        {contacts.map((contact, idx) => {
          const latestItem = contact.items[contact.items.length - 1];
          return (
            <div
              key={contact.id}
              onClick={() => onOpenStory(idx)}
              className="flex items-center gap-3.5 px-4 py-3 hover:bg-black/2 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs flex-shrink-0"
                style={{ backgroundColor: contact.avatarColor }}
              >
                {getInitials(contact.name)}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF] truncate">
                  {contact.name}
                </h4>
                <p className="text-[11px] text-[#5A6182] dark:text-[#AEB4DA] truncate mt-0.5">
                  {latestItem?.timeFormatted || 'recently'} · {contact.items.length} update{contact.items.length > 1 ? 's' : ''}
                </p>
              </div>

              <span className="text-[11px] font-bold text-[#3B6BFA] bg-[#3B6BFA]/10 px-2.5 py-1 rounded-full">
                View
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
