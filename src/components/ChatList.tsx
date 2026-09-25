import React, { useState } from 'react';
import { Search, Mic, Camera, Video, CheckCheck, UserPlus, Check } from 'lucide-react';
import { ChatSummary } from '../types';
import { FIND_FRIENDS_SUGGESTIONS } from '../services/mockInitialData';

interface ChatListProps {
  chats: ChatSummary[];
  onSelectChat: (chatId: string) => void;
  onStartChatWithFriend: (name: string, color: string) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  onSelectChat,
  onStartChatWithFriend,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [requestedFriends, setRequestedFriends] = useState<Record<number, boolean>>({});

  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.lastMessage && c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleRequestFriend = (index: number, name: string, color: string) => {
    setRequestedFriends((prev) => ({ ...prev, [index]: true }));
    onStartChatWithFriend(name, color);
  };

  return (
    <div className="pb-24">
      {/* Search Bar */}
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-full px-4 py-2.5 text-sm shadow-xs">
          <Search className="w-4 h-4 text-[#9AA1C4]" />
          <input
            type="text"
            placeholder="Search chats or messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Chats List */}
      <div className="divide-y divide-[#E4E8F7]/60 dark:divide-[#242D57]/60">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className="flex items-center gap-3.5 px-4 py-3 hover:bg-black/2 dark:hover:bg-white/5 active:bg-black/5 cursor-pointer transition-colors"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-xs"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {getInitials(chat.name)}
              </div>
              {chat.online && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#2FBE8F] border-2 border-white dark:border-[#131B3E]"></span>
              )}
            </div>

            {/* Chat Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF] truncate">
                  {chat.name}
                </h3>
                <span className="text-[11px] text-[#9AA1C4] dark:text-[#7A81A8] flex-shrink-0 ml-2">
                  {chat.lastMessageTime}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#5A6182] dark:text-[#AEB4DA] truncate">
                  {chat.mine && (
                    <CheckCheck className="w-3.5 h-3.5 text-[#4DD8E8] flex-shrink-0" />
                  )}
                  {chat.lastMessageType === 'voice' && (
                    <Mic className="w-3.5 h-3.5 text-[#3B6BFA] flex-shrink-0" />
                  )}
                  {chat.lastMessageType === 'image' && (
                    <Camera className="w-3.5 h-3.5 text-[#3B6BFA] flex-shrink-0" />
                  )}
                  {chat.lastMessageType === 'video' && (
                    <Video className="w-3.5 h-3.5 text-[#3B6BFA] flex-shrink-0" />
                  )}
                  <span className="truncate">{chat.lastMessage || 'Tap to chat'}</span>
                </div>

                {chat.unreadCount > 0 && (
                  <span className="flex-shrink-0 bg-[#3B6BFA] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-xs">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredChats.length === 0 && (
          <div className="text-center py-12 text-[#9AA1C4]">
            <p className="text-sm font-medium">No chats found for "{searchTerm}"</p>
          </div>
        )}
      </div>

      {/* Find Friends Section */}
      <div className="mt-4 pt-3 border-t-8 border-[#F4F6FC] dark:border-[#0B1130]">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0E1430] dark:text-[#EEF1FF] tracking-tight">
              Find friends
            </h2>
            <span className="text-[11px] font-semibold text-[#3B6BFA]">People nearby</span>
          </div>
          <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] mt-0.5 mb-3">
            People near you on Blue Chats who aren't in your contacts yet.
          </p>
        </div>

        <div className="space-y-1">
          {FIND_FRIENDS_SUGGESTIONS.map((friend, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-black/2 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs flex-shrink-0"
                  style={{ backgroundColor: friend.color }}
                >
                  {getInitials(friend.name)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF] truncate">
                    {friend.name}
                  </h4>
                  <p className="text-[11px] text-[#9AA1C4] dark:text-[#7A81A8] truncate">
                    {friend.sub}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRequestFriend(idx, friend.name, friend.color)}
                disabled={requestedFriends[idx]}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  requestedFriends[idx]
                    ? 'bg-[#E4E8F7] dark:bg-[#242D57] text-[#5A6182] dark:text-[#AEB4DA]'
                    : 'bg-[#3B6BFA] hover:bg-[#2453D6] text-white shadow-xs'
                }`}
              >
                {requestedFriends[idx] ? (
                  <>
                    <Check className="w-3 h-3" /> Chatting
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" /> Chat
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
