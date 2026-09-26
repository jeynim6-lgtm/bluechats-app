import React from 'react';
import { Settings2, AlertTriangle, RefreshCw } from 'lucide-react';
import { BRANDING } from '../config/branding';
import { Spinner } from './ui';

export const SplashScreen: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
      <span className="font-serif-brand italic font-semibold text-3xl tracking-tight">{BRANDING.appName}</span>
    </div>
    <Spinner className="w-6 h-6 text-accent" />
    {message && <p className="text-xs text-haze">{message}</p>}
  </div>
);

interface SetupRequiredProps {
  missing?: string[];
  error?: string;
}

/** Shown when the server has no Firebase configuration (instead of silently failing). */
export const SetupRequired: React.FC<SetupRequiredProps> = ({ missing = [], error }) => (
  <div className="min-h-screen bg-paper dark:bg-night flex items-center justify-center p-5">
    <div className="max-w-md w-full bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gold/15 text-gold flex items-center justify-center">
          {error ? <AlertTriangle className="w-6 h-6" /> : <Settings2 className="w-6 h-6" />}
        </div>
        <div>
          <h1 className="font-bold text-base text-ink dark:text-mist">{error ? `${BRANDING.appName} can't start` : 'Finish setting up'}</h1>
          <p className="text-xs text-ink-soft dark:text-mist-soft">{error ? 'The server could not be reached.' : 'Firebase is not configured on the server yet.'}</p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded-xl p-3">{error}</p>
      ) : (
        <>
          <p className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
            Add these environment variables (Firebase console → Project settings → Your apps → Web app config), then restart the server:
          </p>
          <ul className="bg-paper dark:bg-night rounded-xl p-3 space-y-1 font-mono text-[11px] text-ink dark:text-mist">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-faint leading-relaxed">
            Also enable <strong>Authentication → Sign-in method → Phone</strong>, add your domain under <strong>Authorized domains</strong>,
            and deploy the security rules with <code>npm run deploy:rules</code>. See <code>.env.example</code> for everything else.
          </p>
        </>
      )}

      <button
        onClick={() => window.location.reload()}
        className="w-full py-3 rounded-full bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  </div>
);
