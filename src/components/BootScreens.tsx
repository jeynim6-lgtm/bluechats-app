import React from 'react';
import { Settings2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
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

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-3">
    <span className="w-6 h-6 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
    <div className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed space-y-1">
      <p className="font-bold text-ink dark:text-mist">{title}</p>
      {children}
    </div>
  </div>
);

/**
 * Shown when the server has no Firebase web config. This is about *which project* to use —
 * enabling Phone sign-in in the console is a separate step that cannot clear this screen.
 */
export const SetupRequired: React.FC<SetupRequiredProps> = ({ missing = [], error }) => (
  <div className="min-h-screen bg-paper dark:bg-night flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gold/15 text-gold flex items-center justify-center flex-shrink-0">
          {error ? <AlertTriangle className="w-6 h-6" /> : <Settings2 className="w-6 h-6" />}
        </div>
        <div>
          <h1 className="font-bold text-base text-ink dark:text-mist">{error ? `${BRANDING.appName} can't start` : 'Connect your Firebase project'}</h1>
          <p className="text-xs text-ink-soft dark:text-mist-soft">
            {error ? 'The server could not be reached.' : "The app hasn't been given your Firebase web config yet."}
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded-xl p-3">{error}</p>
      ) : (
        <>
          <div className="p-3 rounded-2xl bg-brand/10 text-xs text-ink dark:text-mist leading-relaxed">
            <strong>Why you're seeing this:</strong> the app doesn't know <em>which</em> Firebase project to sign people in to. Turning on
            Phone sign-in and adding test numbers in the Firebase console is still needed, but it can't clear this screen — only the
            web config can.
          </div>

          <div className="space-y-4">
            <Step n={1} title="Copy your web app config from Firebase">
              <p>
                Firebase console → ⚙ <strong>Project settings</strong> → <strong>General</strong> → scroll to <strong>Your apps</strong>.
                If there is no Web app yet, click <strong>Add app → Web (&lt;/&gt;)</strong>. Under <strong>SDK setup and configuration</strong>,
                choose <strong>Config</strong> and copy the <code>firebaseConfig</code> block.
              </p>
            </Step>
            <Step n={2} title="Give it to the app (either option)">
              <p>
                <strong>Easiest:</strong> paste it between the backticks in <code className="font-mono">src/config/firebase.ts</code>, commit, and
                redeploy. These values are public, so they are safe to commit.
              </p>
              <p>
                <strong>Or</strong> set environment variables on your server
                {missing.length > 0 && (
                  <>
                    {' '}
                    (<span className="font-mono">{missing.join(', ')}</span>)
                  </>
                )}
                , or one variable <code className="font-mono">FIREBASE_WEB_CONFIG</code> containing the whole block — then restart.
              </p>
            </Step>
            <Step n={3} title="Allow this website to use sign-in">
              <p>
                Firebase → <strong>Authentication → Settings → Authorized domains</strong> → add{' '}
                <code className="font-mono bg-paper dark:bg-night px-1 rounded">{window.location.hostname}</code>
              </p>
            </Step>
            <Step n={4} title="Deploy the security rules">
              <p>
                Run <code className="font-mono">npm run deploy:rules</code> once (after setting your project ID in <code>.firebaserc</code>), otherwise
                profiles and chats can't be saved.
              </p>
            </Step>
          </div>

          <p className="text-[11px] text-ink-faint flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0 mt-px" />
            The iOS (APNs) and Android (SHA fingerprint) steps in the Firebase docs are for native apps only — this web app doesn't need them.
          </p>
        </>
      )}

      <button
        onClick={() => window.location.reload()}
        className="w-full py-3 rounded-full bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" /> I've done this — retry
      </button>
    </div>
  </div>
);
