import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { initials } from '../lib/format';

interface AvatarProps {
  name: string;
  color?: string;
  url?: string | null;
  size?: number;
  shape?: 'circle' | 'rounded';
  online?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, color = '#3B6BFA', url, size = 44, shape = 'rounded', online, className = '' }) => {
  const [broken, setBroken] = useState(false);
  const radius = shape === 'circle' ? 'rounded-full' : size >= 64 ? 'rounded-3xl' : 'rounded-2xl';
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {url && !broken ? (
        <img
          src={url}
          alt={name}
          onError={() => setBroken(true)}
          className={`w-full h-full object-cover ${radius} shadow-xs`}
        />
      ) : (
        <div
          className={`w-full h-full ${radius} flex items-center justify-center font-bold text-white shadow-xs select-none`}
          style={{ backgroundColor: color, fontSize: Math.max(11, Math.round(size * 0.34)) }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-success border-2 border-white dark:border-night-card"
          style={{ width: Math.max(10, size * 0.27), height: Math.max(10, size * 0.27) }}
          aria-label="online"
        />
      )}
    </div>
  );
};

interface SheetProps {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  z?: string;
}

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and backdrop tap. */
export const Sheet: React.FC<SheetProps> = ({ title, onClose, children, footer, wide, z = 'z-50' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${z} bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center animate-fade-in`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} max-w-[480px] bg-white dark:bg-night-card border border-line dark:border-night-line rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-slide-up`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-line dark:border-night-line flex-shrink-0">
            <h2 className="font-bold text-sm text-ink dark:text-mist flex items-center gap-2">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line dark:border-night-line flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export const Spinner: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={`animate-spin text-brand ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const ErrorBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
    <span className="flex-1 leading-relaxed">{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} aria-label="Dismiss" className="cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ---------- toast ----------
type ToastListener = (message: string | null) => void;
const toastListeners = new Set<ToastListener>();
let toastTimer: number | undefined;

export function toast(message: string) {
  toastListeners.forEach((l) => l(message));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastListeners.forEach((l) => l(null)), 3200);
}

export const ToastHost: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    toastListeners.add(setMessage);
    return () => {
      toastListeners.delete(setMessage);
    };
  }, []);
  if (!message) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] max-w-[90vw] px-4 py-2.5 rounded-full bg-navy-950/95 text-white text-xs font-semibold shadow-xl animate-slide-up" role="status">
      {message}
    </div>
  );
};

/** Shares an invite link via the native share sheet, falling back to copying it. */
export async function shareInvite(text: string, url: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Blue Chats', text, url });
      return;
    }
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text}`);
    toast('Invite link copied to clipboard');
  } catch {
    window.prompt('Copy this invite:', text);
  }
}
