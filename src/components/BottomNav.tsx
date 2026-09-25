import React from 'react';
import { MessageSquare, Compass, Disc, Phone, Users, Settings } from 'lucide-react';

export type TabType = 'chats' | 'discover' | 'status' | 'calls' | 'contacts' | 'settings' | 'wallet' | 'admin';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  unreadChatsCount: number;
  hasUnseenStatus: boolean;
  missedCallsCount: number;
  hasFriendRequests?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadChatsCount,
  hasUnseenStatus,
  missedCallsCount,
  hasFriendRequests,
}) => {
  const tabs = [
    {
      id: 'chats' as TabType,
      label: 'Chats',
      icon: MessageSquare,
      badge: unreadChatsCount > 0 ? unreadChatsCount : null,
    },
    {
      id: 'discover' as TabType,
      label: 'Discover',
      icon: Compass,
      dot: hasFriendRequests,
    },
    {
      id: 'status' as TabType,
      label: 'Status',
      icon: Disc,
      dot: hasUnseenStatus,
    },
    {
      id: 'calls' as TabType,
      label: 'Calls',
      icon: Phone,
      badge: missedCallsCount > 0 ? missedCallsCount : null,
    },
    {
      id: 'contacts' as TabType,
      label: 'Contacts',
      icon: Users,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/95 dark:bg-[#131B3E]/95 backdrop-blur-md border-t border-[#E4E8F7] dark:border-[#242D57] px-1 py-1.5 z-40 flex justify-around items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-[#3B6BFA] font-bold'
                : 'text-[#9AA1C4] hover:text-[#5A6182] dark:text-[#7A81A8]'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />

              {/* Number badge */}
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2 bg-[#3B6BFA] text-white text-[9px] font-bold px-1 rounded-full min-w-3.5 text-center">
                  {tab.badge}
                </span>
              )}

              {/* Dot */}
              {tab.dot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#4DD8E8] shadow-[0_0_6px_rgba(77,216,232,0.8)]"></span>
              )}
            </div>

            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
