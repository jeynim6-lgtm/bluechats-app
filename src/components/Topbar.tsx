import React from 'react';
import { CreditCard, Moon, Sun, Plus } from 'lucide-react';

interface TopbarProps {
  onOpenWallet: () => void;
  onOpenNewChat: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenWallet,
  onOpenNewChat,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#0B1330] via-[#101C42] to-[#152657] text-white rounded-b-[22px] shadow-lg select-none">
      {/* Left branding and wallet trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenWallet}
          title="Open Blue Chats Wallet"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[#E8A23B]/15 border border-[#E8A23B]/40 hover:bg-[#E8A23B]/25 active:scale-95 transition-all text-[#E8A23B] cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4DD8E8] shadow-[0_0_8px_rgba(77,216,232,0.6)]"></span>
          <h1 className="font-serif-brand italic font-semibold text-2xl tracking-tight text-white flex items-center">
            Blue Chats
          </h1>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white border border-white/10 cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-200" />}
        </button>

        <button
          onClick={onOpenNewChat}
          title="New Chat or Status"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-90 transition-all text-white shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </header>
  );
};
