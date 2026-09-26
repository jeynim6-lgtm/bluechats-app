import React from 'react';
import { CreditCard, Moon, Sun, MessageSquarePlus } from 'lucide-react';
import { BRANDING } from '../config/branding';
import { useT } from '../lib/i18n';

interface TopbarProps {
  onOpenWallet: () => void;
  onNewChat: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenWallet, onNewChat, isDark, onToggleTheme }) => {
  const t = useT();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white rounded-b-[22px] shadow-lg select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenWallet}
          title={`${BRANDING.appName} Wallet`}
          aria-label="Open wallet"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gold/15 border border-gold/40 hover:bg-gold/25 active:scale-95 transition-all text-gold cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          <h1 className="font-serif-brand italic font-semibold text-2xl tracking-tight">{BRANDING.appName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all border border-white/10 cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-200" />}
        </button>
        <button
          onClick={onNewChat}
          title={t('newChat')}
          aria-label={t('newChat')}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-brand hover:bg-brand-strong active:scale-90 transition-all shadow-md cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
