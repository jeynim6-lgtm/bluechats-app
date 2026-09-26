import React from 'react';
import { MessageSquare, Compass, Disc, Phone, Users, Settings } from 'lucide-react';
import { useT, type TranslationKey } from '../lib/i18n';

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
  const t = useT();
  const tabs: Array<{ id: TabType; label: TranslationKey; icon: typeof MessageSquare; badge?: number; dot?: boolean }> = [
    { id: 'chats', label: 'chats', icon: MessageSquare, badge: unreadChatsCount },
    { id: 'discover', label: 'discover', icon: Compass, dot: hasFriendRequests },
    { id: 'status', label: 'status', icon: Disc, dot: hasUnseenStatus },
    { id: 'calls', label: 'calls', icon: Phone, badge: missedCallsCount },
    { id: 'contacts', label: 'contacts', icon: Users },
    { id: 'settings', label: 'settings', icon: Settings },
  ];

  return (
    <>
      {/* spacer so content isn't hidden behind the fixed bar */}
      <div className="h-16 flex-shrink-0" aria-hidden="true" />
      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/95 dark:bg-night-card/95 backdrop-blur-md border-t border-line dark:border-night-line px-1 pt-1.5 pb-safe z-30 flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-12 ${
                isActive ? 'text-brand font-bold' : 'text-ink-faint hover:text-ink-soft dark:text-mist-faint dark:hover:text-mist-soft'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-brand text-white text-[9px] font-bold px-1 rounded-full min-w-4 text-center leading-4">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
                {tab.dot && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[64px]">{t(tab.label)}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
