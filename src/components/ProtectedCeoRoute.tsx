import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft, RefreshCw, AlertCircle, Settings2 } from 'lucide-react';
import { verifyCeoAccess, type CeoAccess } from '../services/admin';
import { AdminDashboard } from './AdminDashboard';

/**
 * Renders the CEO dashboard only after the server verifies the caller's Firebase ID token.
 * Data inside the dashboard is additionally protected by Firestore rules requiring the `ceo` claim.
 */
export const ProtectedCeoRoute: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [access, setAccess] = useState<CeoAccess | null>(null);

  const check = (force = false) => {
    setAccess(null);
    verifyCeoAccess(force).then(setAccess);
  };

  useEffect(() => check(), []);

  if (!access) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-base">Verifying access…</h3>
        <p className="text-xs text-ink-soft dark:text-mist-soft max-w-xs">Your sign-in token is being verified by the server.</p>
      </div>
    );
  }

  if (access.authorized && access.claimsActive) {
    return <AdminDashboard onBack={onBack} />;
  }

  const setup = access.authorized && !access.claimsActive;

  return (
    <div className="min-h-[75vh] flex flex-col justify-center p-6">
      <div className="bg-white dark:bg-night-card border border-red-500/20 rounded-3xl p-6 shadow-xl space-y-5 text-center">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${setup ? 'bg-gold/15 text-gold' : 'bg-red-500/10 text-red-500'}`}>
          {setup ? <Settings2 className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
        </div>
        <div>
          <h2 className="font-bold text-lg">{setup ? 'One more setup step' : 'CEO access required'}</h2>
          <p className="text-xs text-ink-soft dark:text-mist-soft mt-1.5 leading-relaxed">
            {setup
              ? access.setupRequired ||
                'Your account is designated as CEO, but the "ceo" claim is not active on your sign-in yet. Sign out and back in, then retry.'
              : 'This dashboard is only available to accounts with the server-assigned CEO claim.'}
          </p>
        </div>
        {access.error && !setup && (
          <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-2xl flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" /> {access.error}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={onBack} className="flex-1 py-3 rounded-2xl bg-line dark:bg-night-raised text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={() => check(true)} className="px-4 py-3 rounded-2xl bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    </div>
  );
};
