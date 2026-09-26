import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, SwitchCamera, CircleDot, Loader2, Lock, VolumeX } from 'lucide-react';
import { useCalls } from '../context/CallContext';
import { useAppData } from '../context/AppDataContext';
import { formatDuration } from '../lib/format';
import { Avatar } from './ui';

const StreamVideo: React.FC<{ stream: MediaStream | null; mirrored?: boolean; className?: string }> = ({ stream, mirrored, className }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={`${className} ${mirrored ? '-scale-x-100' : ''}`} />;
};

/** Remote audio always plays through a dedicated element (video elements stay muted). */
const RemoteAudio: React.FC<{ stream: MediaStream | null; onBlocked: (blocked: boolean) => void; retryKey: number }> = ({ stream, onBlocked, retryKey }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play()
      .then(() => onBlocked(false))
      .catch(() => onBlocked(true));
  }, [stream, retryKey, onBlocked]);
  return <audio ref={ref} autoPlay playsInline />;
};

export const CallModal: React.FC = () => {
  const { call, accept, decline, hangup, toggleMute, toggleCamera, switchCamera, toggleRecording, dismiss } = useCalls();
  const { displayName } = useAppData();
  const [, tick] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioRetry, setAudioRetry] = useState(0);

  useEffect(() => {
    if (call?.phase !== 'connected') return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [call?.phase]);

  if (!call) return null;

  const name = displayName(call.partner.uid, call.partner.name);
  const isVideo = call.type === 'video';
  const { phase } = call;
  const remoteHasVideo = Boolean(call.remoteStream?.getVideoTracks().length) && !call.partnerCameraOff;
  const localHasVideo = isVideo && !call.cameraOff && !call.videoUnavailable && Boolean(call.localStream?.getVideoTracks().length);
  const showRemoteVideo = isVideo && (phase === 'connected' || phase === 'reconnecting') && remoteHasVideo;

  const statusText =
    phase === 'incoming'
      ? `Incoming ${isVideo ? 'video' : 'voice'} call`
      : phase === 'outgoing'
      ? call.callId
        ? 'Ringing…'
        : 'Calling…'
      : phase === 'connecting'
      ? 'Connecting…'
      : phase === 'reconnecting'
      ? 'Reconnecting…'
      : phase === 'ended'
      ? call.endReason || 'Call ended'
      : formatDuration((Date.now() - (call.connectedAt || Date.now())) / 1000);

  const control = (active: boolean) =>
    `w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 ${
      active ? 'bg-white text-navy-950 shadow-lg' : 'bg-white/15 text-white hover:bg-white/25'
    }`;

  return (
    <div className="fixed inset-0 z-[65] bg-navy-950 text-white flex flex-col justify-between max-w-[480px] mx-auto overflow-hidden select-none" role="dialog" aria-label={`Call with ${name}`}>
      <RemoteAudio stream={call.remoteStream} onBlocked={setAudioBlocked} retryKey={audioRetry} />

      {/* Background: remote video, or my own preview while ringing */}
      <div className="absolute inset-0">
        {showRemoteVideo ? (
          <StreamVideo stream={call.remoteStream} className="w-full h-full object-cover" />
        ) : isVideo && localHasVideo && (phase === 'outgoing' || phase === 'connecting') ? (
          <StreamVideo stream={call.localStream} mirrored={call.facingMode === 'user'} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-navy-950 via-navy-900 to-brand-strong" />
        )}
      </div>

      {/* Header */}
      <div className="relative px-6 pt-10 pb-6 text-center z-10 bg-gradient-to-b from-black/70 to-transparent">
        {!showRemoteVideo && (
          <Avatar
            name={name}
            color={call.partner.avatarColor}
            url={call.partner.avatarUrl}
            size={112}
            shape="circle"
            className={`mx-auto mb-4 ${phase === 'incoming' || phase === 'outgoing' ? 'ring-pulse-active rounded-full' : ''}`}
          />
        )}
        <h2 className="font-bold text-xl drop-shadow-md">{name}</h2>
        <p className={`text-sm mt-1 font-semibold ${phase === 'ended' ? 'text-red-300' : 'text-accent'} ${phase === 'connected' ? 'font-mono' : ''}`}>{statusText}</p>
        {(phase === 'connected' || phase === 'reconnecting') && (
          <p className="text-[10px] text-white/60 mt-1 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> Encrypted peer-to-peer{call.relayed ? ' · via relay' : ''}
          </p>
        )}
        {call.partnerRecording && (
          <div className="inline-flex items-center gap-1.5 bg-red-600/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {name.split(' ')[0]} is recording this call
          </div>
        )}
        {call.recording && (
          <div className="inline-flex items-center gap-1.5 bg-red-600/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2 ml-1">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Recording
          </div>
        )}
        {call.savingRecording && (
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving recording…
          </div>
        )}
        {call.partnerMuted && phase === 'connected' && (
          <p className="text-[11px] text-white/70 mt-2 flex items-center justify-center gap-1">
            <MicOff className="w-3 h-3" /> {name.split(' ')[0]} is muted
          </p>
        )}
        {isVideo && call.partnerCameraOff && phase === 'connected' && (
          <p className="text-[11px] text-white/70 mt-1">{name.split(' ')[0]} turned their camera off</p>
        )}
        {call.videoUnavailable && isVideo && phase !== 'ended' && (
          <p className="text-[11px] text-amber-300 mt-1">Your camera is unavailable — continuing with audio only</p>
        )}
      </div>

      {/* Local picture-in-picture during the call */}
      {isVideo && localHasVideo && (phase === 'connected' || phase === 'reconnecting') && (
        <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black z-20">
          <StreamVideo stream={call.localStream} mirrored={call.facingMode === 'user'} className="w-full h-full object-cover" />
        </div>
      )}

      {audioBlocked && phase !== 'ended' && call.remoteStream && (
        <button
          onClick={() => setAudioRetry((n) => n + 1)}
          className="relative z-20 mx-auto px-4 py-2 rounded-full bg-white text-navy-950 text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <VolumeX className="w-4 h-4" /> Tap to enable sound
        </button>
      )}

      {/* Controls */}
      <div className="relative p-6 pb-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20">
        {phase === 'incoming' ? (
          <div className="flex items-center justify-around max-w-xs mx-auto">
            <div className="flex flex-col items-center gap-2">
              <button onClick={decline} aria-label="Decline call" className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-xl cursor-pointer active:scale-95">
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={accept} aria-label="Accept call" className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-xl cursor-pointer active:scale-95 animate-pulse">
                {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </button>
              <span className="text-xs">Accept</span>
            </div>
          </div>
        ) : phase === 'ended' ? (
          <div className="flex justify-center">
            <button onClick={dismiss} disabled={call.savingRecording} className="px-8 py-3 rounded-full bg-white/15 hover:bg-white/25 text-sm font-bold cursor-pointer disabled:opacity-50">
              Close
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <button onClick={toggleMute} aria-label={call.muted ? 'Unmute' : 'Mute'} aria-pressed={call.muted} className={control(call.muted)}>
              {call.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            {isVideo && (
              <button
                onClick={toggleCamera}
                disabled={call.videoUnavailable}
                aria-label={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}
                aria-pressed={call.cameraOff}
                className={control(call.cameraOff)}
              >
                {call.cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}
            {isVideo && (
              <button onClick={switchCamera} disabled={call.videoUnavailable || call.cameraOff} aria-label="Switch camera" className={control(false)}>
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleRecording}
              disabled={phase !== 'connected' || call.savingRecording}
              aria-label={call.recording ? 'Stop recording' : 'Record call'}
              title={call.recording ? 'Stop recording' : 'Record call (the other person is notified)'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 ${
                call.recording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <CircleDot className="w-5 h-5" />
            </button>
            <button onClick={hangup} aria-label="Hang up" className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 active:scale-95 shadow-xl transition-all cursor-pointer">
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
