import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  CircleDot,
  Loader2,
} from 'lucide-react';
import { CallRecord } from '../types';
import { uploadToBunny } from '../services/bunnyStorage';

interface CallModalProps {
  partnerId: string;
  partnerName: string;
  callType: 'voice' | 'video';
  onEndCall: (callRecord: Partial<CallRecord>) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  partnerId,
  partnerName,
  callType,
  onEndCall,
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | undefined>(undefined);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Initialize camera and mic
  useEffect(() => {
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { facingMode } : false,
        });

        localStreamRef.current = stream;
        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Media devices notice (running in simulation/restricted mode):', err);
      }
    }

    startMedia();

    // Start duration timer
    timerRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [callType, facingMode]);

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = isVideoOff;
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  // Switch camera
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Toggle call recording to Bunny.net
  const toggleCallRecording = () => {
    if (!isRecording) {
      if (!localStreamRef.current) return;
      callChunksRef.current = [];
      const recorder = new MediaRecorder(localStreamRef.current);
      callRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) callChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
    } else {
      if (callRecorderRef.current) {
        callRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  // End Call
  const handleHangup = async () => {
    let finalRecUrl = recordingUrl;

    if (isRecording && callRecorderRef.current) {
      setIsSavingRecording(true);
      callRecorderRef.current.stop();

      await new Promise((r) => setTimeout(r, 500));
      const blob = new Blob(callChunksRef.current, { type: 'video/webm' });
      if (blob.size > 0) {
        try {
          const res = await uploadToBunny(blob, 'calls');
          finalRecUrl = res.url;
        } catch (e) {
          console.warn('Failed to upload call recording:', e);
        }
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    onEndCall({
      partnerId,
      partnerName,
      type: callType,
      direction: 'outgoing',
      durationSeconds: duration,
      recordingUrl: finalRecUrl,
    });
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1330] text-white flex flex-col justify-between max-w-[480px] mx-auto overflow-hidden select-none">
      {/* Top Header */}
      <div className="px-6 pt-10 pb-4 text-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="font-bold text-xl drop-shadow-md">{partnerName}</h2>
        <p className="text-xs text-[#4DD8E8] mt-1 font-mono tracking-wider font-semibold">
          {formatSecs(duration)} · {callType === 'video' ? 'HD Video Call' : 'Voice Call'}
        </p>

        {isRecording && (
          <div className="inline-flex items-center gap-1.5 bg-red-600/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            <span>Recording Call to Bunny.net</span>
          </div>
        )}
      </div>

      {/* Main Stream Display Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {callType === 'video' && !isVideoOff ? (
          <>
            {/* Main view (simulated partner feed) */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#101C42] via-[#1B2A5E] to-[#2453D6] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-28 h-28 rounded-full bg-[#3B6BFA] border-4 border-white/20 flex items-center justify-center font-bold text-3xl shadow-2xl mb-4 ring-pulse-active">
                {partnerName.substring(0, 2).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-white/90">Connected with {partnerName}</p>
              <span className="text-xs text-[#4DD8E8] mt-1">WebRTC Live Stream</span>
            </div>

            {/* PiP view for local user camera */}
            <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </>
        ) : (
          /* Voice Call Avatar display */
          <div className="flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="w-32 h-32 rounded-full bg-[#3B6BFA] border-4 border-[#4DD8E8]/40 flex items-center justify-center font-bold text-4xl shadow-2xl mb-6 ring-pulse-active">
              {partnerName.substring(0, 2).toUpperCase()}
            </div>
            <h3 className="font-bold text-lg">{partnerName}</h3>
            <span className="text-xs text-[#AEB6E8] mt-1">Encrypted Blue Chats Call</span>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-6 pb-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20">
        <div className="flex items-center justify-around max-w-xs mx-auto">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isVideoOff
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Switch Camera */}
          {callType === 'video' && (
            <button
              onClick={switchCamera}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 text-white hover:bg-white/25 transition-all cursor-pointer"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Call Recording */}
          <button
            onClick={toggleCallRecording}
            title={isRecording ? 'Stop Recording' : 'Record Call to Bunny.net'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isRecording
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            <CircleDot className="w-5 h-5" />
          </button>

          {/* Hang up */}
          <button
            onClick={handleHangup}
            disabled={isSavingRecording}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-xl transition-all cursor-pointer"
          >
            {isSavingRecording ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <PhoneOff className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
