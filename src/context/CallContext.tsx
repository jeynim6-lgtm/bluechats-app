import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMe } from './AuthContext';
import { useAppData } from './AppDataContext';
import { CallSession, type CallView } from '../lib/callSession';
import { getIceServers, subscribeIncomingCalls } from '../services/calls';
import { startRingtone, startRingback, playHangupSound, showSystemNotification } from '../lib/notify';
import type { CallType, PersonRef } from '../types';

interface CallContextValue {
  call: CallView | null;
  startCall: (partner: PersonRef, type: CallType) => void;
  accept: () => void;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  toggleRecording: () => void;
  dismiss: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const STALE_RING_MS = 60_000;

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const me = useMe();
  const { blocked } = useAppData();
  const [call, setCall] = useState<CallView | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const handledIds = useRef<Set<string>>(new Set());
  const blockedRef = useRef(blocked);
  const meRef = useRef<PersonRef>(me);

  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);

  useEffect(() => {
    meRef.current = { uid: me.uid, name: me.name, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl };
  }, [me.uid, me.name, me.avatarColor, me.avatarUrl]);

  // Warm the ICE server cache so calls start instantly.
  useEffect(() => {
    void getIceServers();
  }, []);

  const attach = useCallback((session: CallSession) => {
    unsubRef.current?.();
    sessionRef.current = session;
    unsubRef.current = session.subscribe((view) => setCall({ ...view }));
  }, []);

  const isBusy = () => Boolean(sessionRef.current?.isActive);

  // Incoming calls.
  useEffect(() => {
    return subscribeIncomingCalls(me.uid, async (ringing) => {
      for (const incoming of ringing) {
        if (handledIds.current.has(incoming.id)) continue;
        handledIds.current.add(incoming.id);

        if (Date.now() - incoming.createdAt > STALE_RING_MS) {
          void CallSession.markMissed(incoming.id); // caller's tab closed while ringing
          continue;
        }
        if (blockedRef.current.has(incoming.callerId) || isBusy()) {
          void CallSession.rejectBusy(incoming.id);
          continue;
        }
        const ice = await getIceServers();
        if (isBusy()) {
          void CallSession.rejectBusy(incoming.id);
          continue;
        }
        attach(CallSession.fromIncoming(meRef.current, incoming, ice));
        showSystemNotification(
          `Incoming ${incoming.type} call`,
          `${incoming.caller.name} is calling you`,
          undefined,
          `call-${incoming.id}`
        );
      }
    });
  }, [me.uid, attach]);

  // Ringtone / ringback / hang-up tones.
  const phase = call?.phase;
  useEffect(() => {
    if (phase === 'incoming') return startRingtone();
    if (phase === 'outgoing') return startRingback();
    if (phase === 'ended') playHangupSound();
  }, [phase]);

  // Clear the ended screen after a moment.
  useEffect(() => {
    if (phase !== 'ended' || call?.savingRecording) return;
    const id = window.setTimeout(() => {
      if (sessionRef.current && !sessionRef.current.isActive) {
        unsubRef.current?.();
        sessionRef.current = null;
        setCall(null);
      }
    }, 2500);
    return () => window.clearTimeout(id);
  }, [phase, call?.savingRecording]);

  // Best effort: end the call if the tab is closed.
  useEffect(() => {
    const onUnload = () => void sessionRef.current?.hangup();
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  const startCall = useCallback(
    (partner: PersonRef, type: CallType) => {
      if (isBusy()) return;
      if (blockedRef.current.has(partner.uid)) {
        window.alert(`Unblock ${partner.name} to call them.`);
        return;
      }
      // Kick off immediately (keeps the click's user-activation for getUserMedia/audio).
      void getIceServers().then((ice) => attach(CallSession.placeCall(meRef.current, partner, type, ice)));
    },
    [attach]
  );

  const value: CallContextValue = {
    call,
    startCall,
    accept: () => void sessionRef.current?.accept(),
    decline: () => sessionRef.current?.decline(),
    hangup: () => void sessionRef.current?.hangup(),
    toggleMute: () => sessionRef.current?.toggleMute(),
    toggleCamera: () => sessionRef.current?.toggleCamera(),
    switchCamera: () => void sessionRef.current?.switchCamera().catch((e) => console.warn('[call] switch camera', e)),
    toggleRecording: () => {
      const s = sessionRef.current;
      if (!s) return;
      void (s.state.recording ? s.stopRecording() : s.startRecording());
    },
    dismiss: () => {
      if (sessionRef.current?.isActive) return;
      unsubRef.current?.();
      sessionRef.current = null;
      setCall(null);
    },
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export function useCalls(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used inside <CallProvider>');
  return ctx;
}
