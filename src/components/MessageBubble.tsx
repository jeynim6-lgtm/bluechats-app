import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, FileText, MapPin, User, Check, CheckCheck, Clock, Download, Ban, Reply, MessageSquare, MoreHorizontal } from 'lucide-react';
import { formatClock, formatDuration, formatFileSize } from '../lib/format';
import type { ChatMessage } from '../types';

// Only one voice note plays at a time.
let activeAudio: HTMLAudioElement | null = null;

export const VoicePlayer: React.FC<{ url: string; duration?: number | null; mine: boolean }> = ({ url, duration, mine }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => Number.isFinite(audio.duration) && setTotal(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPause = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) return audio.pause();
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    try {
      await audio.play();
      setPlaying(true);
      setError(false);
    } catch {
      setError(true);
    }
  };

  const pct = total ? Math.min(100, (progress / total) * 100) : 0;
  const bars = [10, 18, 8, 22, 14, 10, 24, 16, 12, 20, 8, 14, 18, 11, 21, 9];

  return (
    <div className="flex items-center gap-3 pr-1 min-w-[200px]">
      <audio ref={audioRef} src={url} preload="metadata" onError={() => setError(true)} />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 ${mine ? 'bg-white text-brand' : 'bg-brand text-white'}`}
      >
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1">
        <div
          className="relative flex items-center gap-0.5 h-6 cursor-pointer"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !total) return;
            const rect = e.currentTarget.getBoundingClientRect();
            audio.currentTime = ((e.clientX - rect.left) / rect.width) * total;
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors ${
                (i / bars.length) * 100 < pct ? (mine ? 'bg-white' : 'bg-brand') : mine ? 'bg-white/45' : 'bg-brand/35'
              }`}
              style={{ height: h }}
            />
          ))}
        </div>
        <div className="text-[10px] mt-0.5 opacity-80 font-mono">
          {error ? 'Could not play audio' : formatDuration(playing || progress ? progress : total)}
        </div>
      </div>
    </div>
  );
};

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

function isBigEmoji(text?: string | null) {
  if (!text || text.length > 16 || !EMOJI_ONLY.test(text)) return false;
  return [...text.replace(/\s/g, '')].filter((c) => /\p{Extended_Pictographic}/u.test(c)).length <= 3;
}

interface BubbleProps {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
  senderColor?: string;
  readByAll: boolean;
  onOpenMedia: (msg: ChatMessage) => void;
  onMenu: (msg: ChatMessage, anchor: { x: number; y: number }) => void;
  onReply: (msg: ChatMessage) => void;
  onJumpTo: (messageId: string) => void;
  onMessageContact: (uid: string) => void;
  highlighted: boolean;
}

export const MessageBubble: React.FC<BubbleProps> = ({
  msg,
  mine,
  isGroup,
  senderColor,
  readByAll,
  onOpenMedia,
  onMenu,
  onReply,
  onJumpTo,
  onMessageContact,
  highlighted,
}) => {
  const pressTimer = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-1">
        <span className="bg-line/70 dark:bg-night-card/80 text-ink-soft dark:text-mist-soft text-[10px] px-3 py-1 rounded-full font-medium">
          {msg.text}
        </span>
      </div>
    );
  }

  const reactions = Object.values(msg.reactions || {});
  const reactionSummary = [...new Set(reactions)].slice(0, 4);
  const bigEmoji = msg.type === 'text' && isBigEmoji(msg.text);

  const openMenu = (x: number, y: number) => !msg.pending && onMenu(msg, { x, y });

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group ${reactions.length ? 'mb-3' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        const { clientX, clientY } = e.touches[0];
        pressTimer.current = window.setTimeout(() => openMenu(clientX, clientY), 450);
      }}
      onTouchMove={(e) => {
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        // swipe right to reply
        if (touchStartX.current !== null && e.touches[0].clientX - touchStartX.current > 70 && !msg.deleted) {
          touchStartX.current = null;
          onReply(msg);
        }
      }}
      onTouchEnd={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
    >
      <div className={`relative max-w-[82%] flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
        <div
          className={`relative rounded-2xl shadow-xs transition-all ${bigEmoji ? 'bg-transparent shadow-none px-1' : 'p-2.5'} ${
            bigEmoji
              ? ''
              : mine
              ? 'bg-brand text-white rounded-tr-md'
              : 'bg-white dark:bg-night-card text-ink dark:text-mist border border-line/70 dark:border-night-line rounded-tl-md'
          } ${highlighted ? 'ring-2 ring-accent' : ''}`}
        >
          {isGroup && !mine && (
            <p className="text-[11px] font-bold mb-0.5" style={{ color: senderColor }}>
              {msg.senderName}
            </p>
          )}

          {msg.replyTo && !msg.deleted && (
            <button
              onClick={() => onJumpTo(msg.replyTo!.id)}
              className={`block w-full text-left mb-1.5 px-2 py-1 rounded-lg border-l-4 text-[11px] cursor-pointer ${
                mine ? 'bg-white/15 border-white/70' : 'bg-brand/10 border-brand'
              }`}
            >
              <span className="font-bold block truncate">{msg.replyTo.senderName}</span>
              <span className="opacity-80 line-clamp-2">{msg.replyTo.text}</span>
            </button>
          )}

          {msg.deleted ? (
            <p className="text-sm italic opacity-75 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" /> This message was deleted
            </p>
          ) : (
            <>
              {msg.type === 'voice' && msg.media && <VoicePlayer url={msg.media.url} duration={msg.media.duration} mine={mine} />}

              {msg.type === 'image' && msg.media && (
                <button onClick={() => onOpenMedia(msg)} className="block cursor-zoom-in">
                  <img src={msg.media.url} alt={msg.text || 'Photo'} loading="lazy" className="rounded-xl max-h-72 w-full min-w-[160px] object-cover bg-black/10" />
                </button>
              )}

              {msg.type === 'video' && msg.media && (
                <video src={msg.media.url} controls playsInline preload="metadata" className="rounded-xl max-h-72 w-full min-w-[200px] bg-black" />
              )}

              {msg.type === 'file' && msg.media && (
                <a
                  href={msg.media.url}
                  target="_blank"
                  rel="noreferrer"
                  download={msg.media.name || undefined}
                  className={`flex items-center gap-2.5 p-2 rounded-xl min-w-[200px] ${mine ? 'bg-white/15' : 'bg-brand/10'}`}
                >
                  <FileText className={`w-8 h-8 flex-shrink-0 ${mine ? 'text-white' : 'text-brand'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs truncate">{msg.media.name || 'Document'}</p>
                    <span className="text-[10px] opacity-75">
                      {formatFileSize(msg.media.size)} · {(msg.media.name?.split('.').pop() || 'file').toUpperCase()}
                    </span>
                  </div>
                  <Download className="w-4 h-4 opacity-80" />
                </a>
              )}

              {msg.type === 'location' && msg.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${msg.location.lat},${msg.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-xl overflow-hidden min-w-[210px] ${mine ? 'bg-white/15' : 'bg-brand/10'}`}
                >
                  <div className="h-20 flex items-center justify-center bg-gradient-to-br from-emerald-400/30 via-sky-400/20 to-brand/30">
                    <MapPin className="w-8 h-8 text-red-500 drop-shadow" />
                  </div>
                  <div className="p-2 text-xs">
                    <p className="font-bold">📍 Shared location</p>
                    <p className="opacity-80 font-mono text-[10px]">
                      {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}
                      {msg.location.accuracy ? ` · ±${Math.round(msg.location.accuracy)}m` : ''}
                    </p>
                    <p className="font-semibold mt-0.5 underline">Open in Maps</p>
                  </div>
                </a>
              )}

              {msg.type === 'contact' && msg.contact && (
                <div className={`p-2 rounded-xl min-w-[200px] ${mine ? 'bg-white/15' : 'bg-brand/10'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-accent text-navy-950 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate">{msg.contact.name}</p>
                      <a href={`tel:${msg.contact.phone}`} className="text-[11px] opacity-85 underline">
                        {msg.contact.phone}
                      </a>
                    </div>
                  </div>
                  {msg.contact.uid && (
                    <button
                      onClick={() => onMessageContact(msg.contact!.uid!)}
                      className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                        mine ? 'bg-white/20' : 'bg-brand text-white'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" /> Message
                    </button>
                  )}
                </div>
              )}

              {msg.text && msg.type !== 'voice' && msg.type !== 'contact' && msg.type !== 'location' && (
                <p
                  className={`${bigEmoji ? 'text-5xl leading-tight' : 'text-sm leading-relaxed'} whitespace-pre-wrap break-words ${
                    msg.type !== 'text' ? 'mt-1.5' : ''
                  }`}
                >
                  {msg.text}
                </p>
              )}
            </>
          )}

          <div
            className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${
              bigEmoji ? 'text-ink-faint' : mine ? 'text-white/75' : 'text-ink-faint dark:text-mist-faint'
            }`}
          >
            <span>{formatClock(msg.createdAt)}</span>
            {mine &&
              (msg.pending ? (
                <Clock className="w-3 h-3" aria-label="Sending" />
              ) : readByAll ? (
                <CheckCheck className="w-3.5 h-3.5 text-accent" aria-label="Read" />
              ) : (
                <Check className="w-3.5 h-3.5" aria-label="Sent" />
              ))}
          </div>

          {reactionSummary.length > 0 && (
            <div
              className={`absolute -bottom-3.5 ${mine ? 'right-2' : 'left-2'} bg-white dark:bg-night-raised border border-line dark:border-night-line rounded-full px-1.5 py-0.5 text-xs shadow-xs flex items-center gap-0.5`}
            >
              {reactionSummary.join('')}
              {reactions.length > 1 && <span className="text-[10px] text-ink-soft dark:text-mist-soft ml-0.5">{reactions.length}</span>}
            </div>
          )}
        </div>

        {!msg.pending && (
          <div className={`flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${mine ? 'flex-row-reverse' : ''}`}>
            {!msg.deleted && (
              <button
                onClick={() => onReply(msg)}
                aria-label="Reply"
                className="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-brand hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openMenu(r.left, r.bottom);
              }}
              aria-label="Message options"
              className="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-brand hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
