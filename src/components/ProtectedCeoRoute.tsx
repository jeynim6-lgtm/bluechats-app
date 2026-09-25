import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { verifyCeoClaimsOncePerSession, getCachedCeoStatus } from '../services/adminAuth';
import { ShieldAlert, ShieldCheck, Lock, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

interface ProtectedCeoRouteProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const ProtectedCeoRoute: React.FC<ProtectedCeoRouteProps> = ({ currentUser, onBack }) => {
  const initialCache = getCachedCeoStatus(currentUser.email);
  const [verificationState, setVerificationState] = useState<'verifying' | 'granted' | 'denied'>(() => {
    if (initialCache) {
      return initialCache.authorized && initialCache.claims?.role === 'ceo' ? 'granted' : 'denied';
    }
    return 'verifying';
  });
  const [errorMsg, setErrorMsg] = useState<string>(() => (initialCache && !initialCache.authorized ? (initialCache.error || 'Access denied.') : ''));
  const [claimsDetails, setClaimsDetails] = useState<{ role?: string; admin?: boolean } | null>(() => (initialCache?.claims || null));

  const runServerVerification = async () => {
    // If already verified in this session, return immediately without network call
    const currentCached = getCachedCeoStatus(currentUser.email);
    if (currentCached) {
      if (currentCached.authorized && currentCached.claims?.role === 'ceo') {
        setClaimsDetails(currentCached.claims);
        setVerificationState('granted');
        return;
      } else {
        setVerificationState('denied');
        setErrorMsg(currentCached.error || 'Access denied: Requires verified CEO custom claim.');
        return;
      }
    }

    setVerificationState('verifying');
    setErrorMsg('');

    try {
      // Query the server-side Cloud Function / Admin endpoint to verify Firebase Custom Claims
      const result = await verifyCeoClaimsOncePerSession(currentUser.email);

      if (result.authorized && result.claims?.role === 'ceo') {
        setClaimsDetails(result.claims);
        setVerificationState('granted');
      } else {
        setVerificationState('denied');
        setErrorMsg(result.error || 'Access denied: Requires verified CEO custom claim.');
      }
    } catch (err: any) {
      setVerificationState('denied');
      setErrorMsg(err.message || 'Server connection failed while verifying security claims.');
    }
  };

  useEffect(() => {
    runServerVerification();
  }, [currentUser.email]);

  // 1. Verifying State (Server verification in flight)
  if (verificationState === 'verifying') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-[480px] mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-[#3B6BFA]/10 text-[#3B6BFA] flex items-center justify-center animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">
            Verifying CEO Custom Claims
          </h3>
          <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] mt-1 max-w-xs leading-relaxed">
            Contacting the backend server to cryptographically confirm Firebase custom claims for your account...
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#3B6BFA] font-medium pt-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Server-side claim verification in progress</span>
        </div>
      </div>
    );
  }

  // 2. Denied State: The CEO Dashboard is NOT rendered
  if (verificationState === 'denied') {
    return (
      <div className="min-h-[75vh] flex flex-col justify-center p-6 max-w-[480px] mx-auto">
        <div className="bg-white dark:bg-[#131B3E] border border-red-500/20 rounded-3xl p-6 shadow-xl space-y-5 text-center">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-mono font-bold bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full uppercase tracking-wider">
              HTTP 403 Forbidden · Route Protected
            </span>
            <h2 className="font-bold text-lg text-[#0E1430] dark:text-[#EEF1FF] mt-2">
              CEO Authorization Required
            </h2>
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] mt-1.5 leading-relaxed">
              The CEO Dashboard route only renders if the server confirms the Firebase custom claim:{' '}
              <code className="text-red-500 font-mono text-[11px] bg-red-500/5 px-1 py-0.5 rounded">
                role == 'ceo'
              </code>
              .
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-2xl font-medium flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-gray-500/5 rounded-2xl text-[11px] text-[#5A6182] dark:text-[#AEB4DA] text-left space-y-1">
            <p className="font-semibold text-[#0E1430] dark:text-[#EEF1FF]">
              🔒 Security Architecture:
            </p>
            <p>• Admin access is not based on client-side state or public database fields.</p>
            <p>• Custom claims are set and checked server-side in a Cloud Function.</p>
            <p>• The CEO route view is withheld until the server cryptographically validates access.</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-2xl bg-gray-200 dark:bg-[#1E274D] text-[#0E1430] dark:text-[#EEF1FF] text-xs font-bold hover:bg-gray-300 dark:hover:bg-[#2A3568] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Settings</span>
            </button>
            <button
              onClick={runServerVerification}
              className="px-4 py-3 rounded-2xl bg-[#3B6BFA] text-white text-xs font-bold hover:bg-[#2453D6] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Granted State: Server confirmed the claims, render the CEO Dashboard
  return (
    <AdminDashboard
      currentUser={currentUser}
      onBack={onBack}
      claimsInfo={claimsDetails}
    />
  );
};
