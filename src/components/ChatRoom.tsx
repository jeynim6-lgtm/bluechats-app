import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  Send,
  Mic,
  Paperclip,
  Camera,
  Smile,
  X,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  MapPin,
  User,
  Copy,
  Trash2,
  Reply,
  ArrowDown,
  SwitchCamera,
  Download,
  LogOut,
  Ban,
  Search,
} from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData, useNow } from '../context/AppDataContext';
import { useCalls } from '../context/CallContext';
import { useChatTitle } from './ChatList';
import {
  subscribeMessages,
  sendMessage,
  markChatRead,
  setTyping,
  setReaction,
  deleteForEveryone,
  leaveGroup,
  previewText,
  type OutgoingMessage,
} from '../services/chats';
import { setBlocked } from '../services/users';
import { uploadMedia, compressImage, deleteMedia, pickRecorderMimeType, baseMime, type MediaFolder } from '../lib/media';
import { formatDayLabel, isSameDay, formatLastSeen, formatDuration, formatFileSize, pickAvatarColor } from '../lib/format';
import { useT } from '../lib/i18n';
import { BRANDING } from '../config/branding';
import { MessageBubble } from './MessageBubble';
import { MediaViewer } from './MediaViewer';
import { Avatar, Sheet, Spinner, toast } from './ui';
import type { Chat, ChatMessage, Contact, ReplyRef } from '../types';
import type { ProfileTarget } from './ContactProfileModal';

interface ChatRoomProps {
  chat: Chat;
  onBack: () => void;
  onOpenProfile: (target: ProfileTarget) => void;
}

const TYPING_WINDOW_MS = 8000;
const MAX_VOICE_SECONDS = 300;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🤔', '😅', '😭', '😢', '😡',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋', '✌️', '🤞', '👌', '🔥', '✨', '🎉', '💯', '❤️',
  '💙', '💚', '💛', '💜', '🖤', '🌍', '🇿🇦', '🚀', '⚽', '🎵', '☕', '🍕', '🌞', '🌧️', '📸', '💼',
];
const STICKERS = ['💙', '🦁', '🇿🇦', '🚀', '✨', '👑', '🔥', '✌️', '🎉', '🥳', '😂', '🙏'];
const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.rtf,.txt,.csv,.zip';

type PendingMedia = { file: Blob; name: string; previewUrl: string; kind: 'image' | 'video' | 'file' };

function kindForFile(file: Blob): PendingMedia['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function replyRefFor(msg: ChatMessage): ReplyRef {
  return {
    id: msg.id,
    senderName: msg.senderName,
    text: msg.type === 'text' ? (msg.text || '').slice(0, 140) : previewText(msg),
    type: msg.type,
  };
}

// ---------- camera capture ----------
const CameraCapture: React.FC<{ onCapture: (blob: Blob) => void; onClose: () => void }> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    (async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setError('');
      } catch {
        setError('Camera unavailable. Allow camera access, or pick a photo from your device.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, shot]);

  useEffect(
    () => () => {
      if (shot) URL.revokeObjectURL(shot.url);
    },
    [shot]
  );

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && setShot({ blob, url: URL.createObjectURL(blob) }), 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col max-w-[480px] mx-auto animate-fade-in">
      <div className="p-4 flex items-center justify-between text-white">
        <span className="font-bold text-xs flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-accent" /> Camera
        </span>
        <button onClick={onClose} aria-label="Close camera" className="p-2 text-white/80 hover:text-white cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {shot ? (
          <img src={shot.url} alt="Captured" className="w-full h-full object-contain" />
        ) : error ? (
          <p className="text-white/80 text-sm text-center px-8">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        )}
      </div>
      <div className="p-6 bg-black/80 flex items-center justify-around">
        {shot ? (
          <>
            <button onClick={() => setShot(null)} className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold cursor-pointer">
              Retake
            </button>
            <a href={shot.url} download={`bluechats-${Date.now()}.jpg`} className="p-3 rounded-full bg-white/20 text-white" aria-label="Save to device">
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => onCapture(shot.blob)}
              className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Send className="w-4 h-4" /> Use photo
            </button>
          </>
        ) : (
          <>
            <label className="p-3 rounded-full bg-white/10 text-white cursor-pointer" aria-label="Pick from device">
              <ImageIcon className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onCapture(file);
                }}
              />
            </label>
            <button
              onClick={snap}
              disabled={Boolean(error)}
              aria-label="Take photo"
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform cursor-pointer disabled:opacity-40"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
            <button
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              aria-label="Switch camera"
              className="p-3 rounded-full bg-white/10 text-white cursor-pointer"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ---------- contact picker ----------
const ContactPicker: React.FC<{ contacts: Contact[]; onPick: (c: Contact) => void; onClose: () => void }> = ({ contacts, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const list = contacts.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title="Share a contact" onClose={onClose} z="z-[60]">
      <div className="p-4 space-y-3">
        <label className="flex items-center gap-2 bg-paper dark:bg-night border border-line dark:border-night-line rounded-full px-3 py-2">
          <Search className="w-4 h-4 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" className="bg-transparent text-sm flex-1 focus:outline-none" autoFocus />
        </label>
        {list.length === 0 ? (
          <p className="text-xs text-ink-faint text-center py-6">No contacts yet. Add some in the Contacts tab.</p>
        ) : (
          list.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer">
              <Avatar name={c.name} color={c.avatarColor} size={36} shape="circle" />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{c.name}</p>
                <p className="text-xs text-ink-faint">{c.phone}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </Sheet>
  );
};

// ---------- main component ----------
export const ChatRoom: React.FC<ChatRoomProps> = ({ chat, onBack, onOpenProfile }) => {
  const me = useMe();
  const t = useT();
  const now = useNow(3000);
  const { contacts, blocked, openDirectChat } = useAppData();
  const { startCall, call } = useCalls();
  const { partnerUid, partner, title, avatarColor, avatarUrl } = useChatTitle(chat, me.uid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [panel, setPanel] = useState<'none' | 'emoji' | 'attach'>('none');
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers'>('emoji');
  const [showInfo, setShowInfo] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [upload, setUpload] = useState<{ label: string; progress: number; controller: AbortController } | null>(null);
  const [menu, setMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; type: 'image' | 'video'; caption?: string | null } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [recording, setRecording] = useState<{ startedAt: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastTypingSent = useRef(0);
  const typingStopTimer = useRef<number | undefined>(undefined);
  const prevCount = useRef(0);

  const isGroup = chat.type === 'group';
  const isBlocked = Boolean(partnerUid && blocked.has(partnerUid));
  const otherIds = chat.participants.filter((p) => p !== me.uid);

  // Live messages
  useEffect(() => {
    setLoaded(false);
    return subscribeMessages(chat.id, (list) => {
      setMessages(list);
      setLoaded(true);
    });
  }, [chat.id]);

  // Read receipts: mark read while this chat is open and visible
  const lastMessage = messages[messages.length - 1];
  const myUnread = chat.unread[me.uid] || 0;
  const myReadAt = chat.readAt[me.uid] || 0;
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      const needs = myUnread > 0 || (lastMessage && lastMessage.senderId !== me.uid && !lastMessage.pending && lastMessage.createdAt > myReadAt);
      if (needs) markChatRead(chat.id, me.uid).catch(() => {});
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [chat.id, me.uid, lastMessage?.id, lastMessage?.pending, myUnread, myReadAt]);

  // Stop "typing…" when leaving the chat
  useEffect(
    () => () => {
      window.clearTimeout(typingStopTimer.current);
      if (lastTypingSent.current) void setTyping(chat.id, me.uid, false).catch(() => {});
    },
    [chat.id, me.uid]
  );

  // Scrolling: stick to the bottom for new messages when already there (or when I sent it)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const grew = messages.length > prevCount.current;
    const firstLoad = prevCount.current === 0;
    prevCount.current = messages.length;
    if (firstLoad || (grew && (atBottom || lastMessage?.senderId === me.uid))) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return toast('Original message is no longer loaded');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1600);
  };

  const typingNames = Object.entries(chat.typing)
    .filter(([uid, at]) => uid !== me.uid && now - at < TYPING_WINDOW_MS)
    .map(([uid]) => chat.members[uid]?.name?.split(' ')[0] || 'Someone');

  const subtitle = typingNames.length
    ? isGroup
      ? `${typingNames.join(', ')} ${t('typing')}`
      : t('typing')
    : isGroup
    ? otherIds.map((id) => chat.members[id]?.name?.split(' ')[0]).filter(Boolean).join(', ') || 'Group'
    : formatLastSeen(partner?.lastSeen);

  // ---------- sending ----------
  const send = useCallback(
    (msg: OutgoingMessage) => {
      const withReply = { ...msg, replyTo: replyTo ? replyRefFor(replyTo) : null };
      setReplyTo(null);
      sendMessage(chat, me, withReply).catch((err) => toast(`Message not sent: ${err.message}`));
    },
    [chat, me, replyTo]
  );

  const notifyTyping = (value: string) => {
    if (!value.trim()) return;
    const ts = Date.now();
    if (ts - lastTypingSent.current > 4000) {
      lastTypingSent.current = ts;
      setTyping(chat.id, me.uid, true).catch(() => {});
    }
    window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => {
      lastTypingSent.current = 0;
      setTyping(chat.id, me.uid, false).catch(() => {});
    }, 5000);
  };

  const sendText = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    lastTypingSent.current = 0;
    window.clearTimeout(typingStopTimer.current);
    send({ type: 'text', text: value.slice(0, 4000) });
    setPanel('none');
    textRef.current?.focus();
  };

  const uploadAndSend = async (file: Blob, kind: 'image' | 'video' | 'file' | 'voice', opts: { name?: string; caption?: string; duration?: number }) => {
    const folder: MediaFolder = kind === 'image' ? 'photos' : kind === 'video' ? 'videos' : kind === 'voice' ? 'voice' : 'docs';
    const controller = new AbortController();
    const label = { image: 'photo', video: 'video', file: 'document', voice: 'voice note' }[kind];
    setUpload({ label, progress: 0, controller });
    const reply = replyTo;
    try {
      const body = kind === 'image' ? await compressImage(file) : file;
      const result = await uploadMedia(body, folder, {
        fileName: opts.name,
        signal: controller.signal,
        onProgress: (progress) => setUpload((u) => (u ? { ...u, progress } : u)),
      });
      setReplyTo(null);
      await sendMessage(chat, me, {
        type: kind,
        text: opts.caption?.trim() || null,
        replyTo: reply ? replyRefFor(reply) : null,
        media: {
          url: result.url,
          path: result.path,
          size: result.size,
          mime: result.contentType,
          name: opts.name || result.fileName,
          duration: opts.duration ?? null,
        },
      });
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') toast(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUpload(null);
    }
  };

  const queueFile = (file: File | Blob, name?: string) => {
    const kind = kindForFile(file);
    setPendingMedia({ file, name: name || (file instanceof File ? file.name : `photo-${Date.now()}.jpg`), previewUrl: URL.createObjectURL(file), kind });
    setCaption('');
    setPanel('none');
  };

  const confirmPending = () => {
    if (!pendingMedia) return;
    const { file, name, kind, previewUrl } = pendingMedia;
    URL.revokeObjectURL(previewUrl);
    setPendingMedia(null);
    void uploadAndSend(file, kind, { name, caption });
  };

  const shareLocation = () => {
    setPanel('none');
    if (!('geolocation' in navigator)) return toast('Location is not available on this device.');
    toast('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        send({
          type: 'location',
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }),
      (err) => toast(err.code === err.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ---------- voice notes ----------
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return toast('Voice notes are not supported in this browser.');
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast('Microphone access is needed to record voice notes.');
    }
    const mimeType = pickRecorderMimeType('audio');
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording({ startedAt: Date.now() });
  };

  const stopRecording = (sendIt: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder || !recording) return;
    const duration = (Date.now() - recording.startedAt) / 1000;
    recorderRef.current = null;
    setRecording(null);
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((tr) => tr.stop());
      if (!sendIt) return;
      if (duration < 1) return toast('Hold on — voice note too short.');
      const type = baseMime(recorder.mimeType) || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      void uploadAndSend(blob, 'voice', { name: `voice-${Date.now()}.${ext}`, duration: Math.round(duration) });
    };
    recorder.stop();
  };

  // Recording timer (re-renders twice a second) with an automatic stop at the length limit.
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!recording) return setLiveSeconds(0);
    const id = window.setInterval(() => setLiveSeconds(Math.floor((Date.now() - recording.startedAt) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [recording]);
  useEffect(() => {
    if (recording && liveSeconds >= MAX_VOICE_SECONDS) stopRecording(true);
  }, [liveSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
    },
    []
  );

  // ---------- message actions ----------
  const react = (msg: ChatMessage, emoji: string) => {
    const current = msg.reactions[me.uid];
    setReaction(chat.id, msg.id, me.uid, current === emoji ? null : emoji).catch((err) => toast(err.message));
    setMenu(null);
  };

  const removeForEveryone = async (msg: ChatMessage) => {
    setMenu(null);
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await deleteForEveryone(chat.id, msg.id);
      if (msg.media?.path) void deleteMedia(msg.media.path);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const readByAll = (msg: ChatMessage) => otherIds.length > 0 && otherIds.every((uid) => (chat.readAt[uid] || 0) >= msg.createdAt);

  const sharedMedia = useMemo(() => messages.filter((m) => !m.deleted && m.media && (m.type === 'image' || m.type === 'video')), [messages]);
  const sharedDocs = useMemo(() => messages.filter((m) => !m.deleted && m.media && m.type === 'file'), [messages]);

  const openProfile = () => {
    if (isGroup) return setShowInfo(true);
    if (partnerUid) onOpenProfile({ uid: partnerUid, name: title, avatarColor, avatarUrl });
  };

  const canCall = !isGroup && partnerUid && !isBlocked;

  return (
    <div
      className="fixed inset-0 z-40 bg-paper dark:bg-night flex flex-col max-w-[480px] mx-auto overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !isBlocked) queueFile(file);
      }}
    >
      <input
        type="file"
        ref={galleryRef}
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueFile(file);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={docRef}
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueFile(file);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2.5 bg-navy-950 text-white shadow-md rounded-b-2xl flex-shrink-0 z-20">
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={onBack} aria-label="Back" className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={openProfile} className="flex items-center gap-2.5 hover:opacity-90 min-w-0 text-left cursor-pointer">
            <Avatar name={title} color={avatarColor} url={avatarUrl} size={40} />
            <div className="min-w-0">
              <h2 className="font-bold text-sm truncate">{title}</h2>
              <p className={`text-[11px] truncate ${typingNames.length ? 'text-success font-semibold' : 'text-accent'}`}>{subtitle}</p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canCall && (
            <>
              <button
                onClick={() => startCall({ uid: partnerUid!, name: title, avatarColor, avatarUrl }, 'voice')}
                disabled={Boolean(call)}
                title={t('voiceCall')}
                aria-label={t('voiceCall')}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                onClick={() => startCall({ uid: partnerUid!, name: title, avatarColor, avatarUrl }, 'video')}
                disabled={Boolean(call)}
                title={t('videoCall')}
                aria-label={t('videoCall')}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
              >
                <Video className="w-4 h-4 text-cyan-400" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowInfo(true)}
            title="Chat info & shared media"
            aria-label="Chat info"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-brand/30 hover:bg-brand text-accent hover:text-white transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {upload && (
        <div className="bg-brand text-white text-xs px-4 py-1.5 flex items-center gap-2 font-semibold">
          <Spinner className="w-3.5 h-3.5 text-white" />
          <span className="flex-1">
            Uploading {upload.label}… {upload.progress}%
          </span>
          <button onClick={() => upload.controller.abort()} className="underline cursor-pointer">
            Cancel
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 140);
        }}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2 relative"
      >
        <div className="text-center mb-2">
          <span className="bg-line/70 dark:bg-night-card/80 text-ink-soft dark:text-mist-soft text-[10px] px-3 py-1 rounded-full font-medium">
            🔒 Messages sync via Firebase · media stored on Bunny.net
          </span>
        </div>

        {!loaded && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Avatar name={title} color={avatarColor} url={avatarUrl} size={64} className="mx-auto" />
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs text-ink-faint">Say hello 👋</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);
          if (!msg.senderId) return null;
          if (msg.type !== 'system' && blocked.has(msg.senderId) && isGroup) return null;
          return (
            <React.Fragment key={msg.id}>
              {showDay && (
                <div className="flex justify-center py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint bg-white/70 dark:bg-night-card/70 px-2.5 py-0.5 rounded-full">
                    {formatDayLabel(msg.createdAt)}
                  </span>
                </div>
              )}
              <MessageBubble
                msg={msg}
                mine={msg.senderId === me.uid}
                isGroup={isGroup}
                senderColor={pickAvatarColor(msg.senderId, BRANDING.avatarPalette)}
                readByAll={readByAll(msg)}
                highlighted={highlightId === msg.id}
                onOpenMedia={(m) => m.media && setViewer({ url: m.media.url, type: m.type === 'video' ? 'video' : 'image', caption: m.text })}
                onMenu={(m, pos) => setMenu({ msg: m, ...pos })}
                onReply={(m) => {
                  setReplyTo(m);
                  textRef.current?.focus();
                }}
                onJumpTo={jumpTo}
                onMessageContact={(uid) => openDirectChat(uid).catch((err) => toast(err.message))}
              />
            </React.Fragment>
          );
        })}
      </div>

      {!atBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to latest"
          className="absolute right-4 bottom-24 z-20 w-10 h-10 rounded-full bg-white dark:bg-night-card border border-line dark:border-night-line shadow-lg flex items-center justify-center text-brand cursor-pointer"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {/* Attachment sheet */}
      {panel === 'attach' && (
        <div className="p-3 bg-white dark:bg-night-card border-t border-line dark:border-night-line grid grid-cols-4 gap-2 animate-slide-up">
          {[
            { label: 'Gallery', icon: ImageIcon, tint: 'bg-purple-500/10 text-purple-600', action: () => galleryRef.current?.click() },
            { label: 'Document', icon: FileText, tint: 'bg-blue-500/10 text-blue-600', action: () => docRef.current?.click() },
            { label: 'Location', icon: MapPin, tint: 'bg-emerald-500/10 text-emerald-600', action: shareLocation },
            { label: 'Contact', icon: User, tint: 'bg-amber-500/10 text-amber-600', action: () => setShowContactPicker(true) },
          ].map(({ label, icon: Icon, tint, action }) => (
            <button
              key={label}
              onClick={() => {
                setPanel('none');
                action();
              }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-paper dark:bg-night hover:bg-brand/10 transition-colors cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji & sticker picker */}
      {panel === 'emoji' && (
        <div className="p-3 bg-white dark:bg-night-card border-t border-line dark:border-night-line max-h-56 overflow-y-auto">
          <div className="flex gap-4 pb-2 mb-2 border-b border-line dark:border-night-line text-xs font-bold">
            {(['emoji', 'stickers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPickerTab(tab)}
                className={`pb-1 cursor-pointer ${pickerTab === tab ? 'text-brand border-b-2 border-brand' : 'text-ink-faint'}`}
              >
                {tab === 'emoji' ? 'Emojis' : 'Stickers'}
              </button>
            ))}
          </div>
          {pickerTab === 'emoji' ? (
            <div className="grid grid-cols-8 gap-1 text-2xl">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => setText((p) => p + em)} className="hover:scale-125 transition-transform p-1 cursor-pointer">
                  {em}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {STICKERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    send({ type: 'text', text: st });
                    setPanel('none');
                  }}
                  className="p-2 rounded-xl bg-paper dark:bg-night hover:bg-brand/10 text-4xl cursor-pointer"
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="p-2.5 bg-white dark:bg-night-card border-t border-line dark:border-night-line flex-shrink-0 pb-safe">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 border-l-4 border-brand">
            <Reply className="w-4 h-4 text-brand flex-shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold text-brand truncate">{replyTo.senderId === me.uid ? 'You' : replyTo.senderName}</p>
              <p className="truncate text-ink-soft dark:text-mist-soft">{replyRefFor(replyTo).text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-ink-faint cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isBlocked ? (
          <div className="text-center text-xs py-2 space-y-1.5">
            <p className="text-ink-soft dark:text-mist-soft">You blocked {title}. Unblock to send messages or call.</p>
            <button
              onClick={() => partnerUid && setBlocked(me.uid, partnerUid, false).catch((err) => toast(err.message))}
              className="font-bold text-brand cursor-pointer"
            >
              Unblock
            </button>
          </div>
        ) : recording ? (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">Recording {formatDuration(liveSeconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stopRecording(false)}
                aria-label="Discard voice note"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-line dark:bg-night-line cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => stopRecording(true)}
                aria-label="Send voice note"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-brand text-white cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText();
            }}
            className="flex items-end gap-1"
          >
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'attach' ? 'none' : 'attach'))}
              aria-label="Attach"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-faint hover:text-brand cursor-pointer flex-shrink-0"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              aria-label="Camera"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-faint hover:text-brand cursor-pointer flex-shrink-0"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'emoji' ? 'none' : 'emoji'))}
              aria-label="Emoji and stickers"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-faint hover:text-brand cursor-pointer flex-shrink-0"
            >
              <Smile className="w-5 h-5" />
            </button>
            <textarea
              ref={textRef}
              rows={1}
              value={text}
              maxLength={4000}
              placeholder={t('typeMessage')}
              aria-label="Message"
              onChange={(e) => {
                setText(e.target.value);
                notifyTyping(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                  e.preventDefault();
                  sendText();
                }
              }}
              onPaste={(e) => {
                const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
                if (file) {
                  e.preventDefault();
                  queueFile(file);
                }
              }}
              className="flex-1 resize-none bg-paper dark:bg-night border border-line dark:border-night-line rounded-2xl px-4 py-2 text-sm text-ink dark:text-mist placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-brand max-h-[120px]"
            />
            {text.trim() ? (
              <button type="submit" aria-label="Send" className="w-10 h-10 rounded-full flex items-center justify-center bg-brand hover:bg-brand-strong active:scale-90 transition-all text-white shadow-md cursor-pointer flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={Boolean(upload)}
                aria-label="Record voice note"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-brand hover:bg-brand-strong active:scale-90 transition-all text-white shadow-md cursor-pointer flex-shrink-0 disabled:opacity-50"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Drag & drop hint */}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-brand/20 border-4 border-dashed border-brand flex items-center justify-center pointer-events-none">
          <span className="bg-white dark:bg-night-card px-4 py-2 rounded-full font-bold text-sm text-brand">Drop to send</span>
        </div>
      )}

      {/* Media preview before sending */}
      {pendingMedia && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col max-w-[480px] mx-auto animate-fade-in">
          <div className="p-3 flex items-center justify-between text-white">
            <button
              onClick={() => {
                URL.revokeObjectURL(pendingMedia.previewUrl);
                setPendingMedia(null);
              }}
              aria-label="Cancel"
              className="p-2 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <span className="text-sm font-semibold truncate">Send to {title}</span>
            <span className="w-10" />
          </div>
          <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
            {pendingMedia.kind === 'image' && <img src={pendingMedia.previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl" />}
            {pendingMedia.kind === 'video' && <video src={pendingMedia.previewUrl} controls className="max-w-full max-h-full rounded-xl" />}
            {pendingMedia.kind === 'file' && (
              <div className="bg-white/10 rounded-2xl p-6 text-center text-white space-y-2">
                <FileText className="w-12 h-12 mx-auto text-accent" />
                <p className="font-bold text-sm break-all">{pendingMedia.name}</p>
                <p className="text-xs text-white/70">{formatFileSize(pendingMedia.file.size)}</p>
              </div>
            )}
          </div>
          <div className="p-3 flex items-center gap-2 pb-safe">
            {pendingMedia.kind !== 'file' && (
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption…"
                maxLength={1000}
                className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => e.key === 'Enter' && confirmPending()}
                autoFocus
              />
            )}
            <button
              onClick={confirmPending}
              aria-label="Send media"
              className="ml-auto w-12 h-12 rounded-full bg-brand hover:bg-brand-strong text-white flex items-center justify-center shadow-lg cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Message action menu */}
      {menu && (
        <div className="fixed inset-0 z-[55]" onClick={() => setMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div
            className="absolute bg-white dark:bg-night-raised border border-line dark:border-night-line rounded-2xl shadow-2xl p-1.5 w-56 animate-pop-in"
            style={{ left: Math.min(menu.x, window.innerWidth - 232), top: Math.min(menu.y, window.innerHeight - 260) }}
            onClick={(e) => e.stopPropagation()}
          >
            {!menu.msg.deleted && (
              <div className="flex justify-between px-1 pb-1.5 mb-1 border-b border-line dark:border-night-line">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => react(menu.msg, emoji)}
                    className={`text-xl p-1 rounded-full hover:scale-125 transition-transform cursor-pointer ${menu.msg.reactions[me.uid] === emoji ? 'bg-brand/15' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {!menu.msg.deleted && (
              <button
                onClick={() => {
                  setReplyTo(menu.msg);
                  setMenu(null);
                  textRef.current?.focus();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <Reply className="w-4 h-4" /> Reply
              </button>
            )}
            {menu.msg.text && !menu.msg.deleted && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(menu.msg.text || '').then(() => toast('Copied'), () => toast('Copy failed'));
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copy text
              </button>
            )}
            {menu.msg.media && !menu.msg.deleted && (
              <a
                href={menu.msg.media.url}
                download={menu.msg.media.name || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenu(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Download className="w-4 h-4" /> Save
              </a>
            )}
            {menu.msg.senderId === me.uid && !menu.msg.deleted && (
              <button
                onClick={() => removeForEveryone(menu.msg)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete for everyone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info panel */}
      {showInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in" onClick={() => setShowInfo(false)}>
          <div
            className="w-full max-w-xs bg-white dark:bg-night-card h-full shadow-2xl flex flex-col p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-line dark:border-night-line">
              <h3 className="font-bold text-sm">{isGroup ? 'Group info' : 'Chat details'}</h3>
              <button onClick={() => setShowInfo(false)} aria-label="Close" className="p-1 rounded-full text-ink-faint hover:text-ink cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-5">
              <Avatar name={title} color={avatarColor} url={avatarUrl} size={72} className="mx-auto mb-2" />
              <h4 className="font-bold text-base">{title}</h4>
              <p className="text-xs text-ink-soft dark:text-mist-soft">{isGroup ? `${chat.participants.length} members` : partner?.bio || partner?.country}</p>
              {!isGroup && partnerUid && (
                <button
                  onClick={() => {
                    setShowInfo(false);
                    openProfile();
                  }}
                  className="mt-3 px-4 py-1.5 rounded-full bg-brand/10 hover:bg-brand hover:text-white text-brand font-bold text-xs transition-colors cursor-pointer"
                >
                  View full profile
                </button>
              )}
            </div>

            {isGroup && (
              <div className="py-3 border-t border-line dark:border-night-line space-y-2">
                <h5 className="font-bold text-xs text-ink-soft dark:text-mist-soft uppercase tracking-wider">Members</h5>
                {chat.participants.map((uid) => {
                  const m = chat.members[uid];
                  return (
                    <button
                      key={uid}
                      disabled={uid === me.uid}
                      onClick={() => {
                        setShowInfo(false);
                        onOpenProfile({ uid, name: m?.name || 'Member', avatarColor: m?.avatarColor, avatarUrl: m?.avatarUrl });
                      }}
                      className="w-full flex items-center gap-2.5 text-left p-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:cursor-default"
                    >
                      <Avatar name={m?.name || '?'} color={m?.avatarColor} url={m?.avatarUrl} size={32} shape="circle" />
                      <span className="text-xs font-semibold truncate">{uid === me.uid ? 'You' : m?.name || 'Member'}</span>
                      {uid === chat.createdBy && <span className="ml-auto text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full">Admin</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="py-3 border-t border-line dark:border-night-line">
              <h5 className="font-bold text-xs text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-2.5">Media ({sharedMedia.length})</h5>
              {sharedMedia.length === 0 ? (
                <p className="text-xs text-ink-faint text-center py-3">No photos or videos yet</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {sharedMedia.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setViewer({ url: m.media!.url, type: m.type === 'video' ? 'video' : 'image', caption: m.text })}
                      className="aspect-square rounded-lg bg-black overflow-hidden cursor-pointer hover:opacity-85"
                    >
                      {m.type === 'video' ? (
                        <video src={m.media!.url} preload="metadata" className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.media!.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sharedDocs.length > 0 && (
              <div className="py-3 border-t border-line dark:border-night-line space-y-1.5">
                <h5 className="font-bold text-xs text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1">Documents ({sharedDocs.length})</h5>
                {sharedDocs.map((m) => (
                  <a key={m.id} href={m.media!.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-xl bg-paper dark:bg-night text-xs">
                    <FileText className="w-4 h-4 text-brand" />
                    <span className="truncate flex-1">{m.media!.name || 'Document'}</span>
                    <span className="text-ink-faint">{formatFileSize(m.media!.size)}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-line dark:border-night-line space-y-2">
              {isGroup ? (
                <button
                  onClick={async () => {
                    if (!window.confirm(`Leave “${title}”?`)) return;
                    try {
                      await leaveGroup(chat.id, me);
                      onBack();
                    } catch (err) {
                      toast((err as Error).message);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Leave group
                </button>
              ) : (
                partnerUid && (
                  <button
                    onClick={() => setBlocked(me.uid, partnerUid, !isBlocked).catch((err) => toast(err.message))}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" /> {isBlocked ? `Unblock ${title}` : `Block ${title}`}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={(blob) => {
            setShowCamera(false);
            queueFile(blob, `camera-${Date.now()}.jpg`);
          }}
        />
      )}

      {showContactPicker && (
        <ContactPicker
          contacts={contacts}
          onClose={() => setShowContactPicker(false)}
          onPick={(c) => {
            setShowContactPicker(false);
            send({ type: 'contact', contact: { name: c.name, phone: c.phone, uid: c.uid } });
          }}
        />
      )}

      {viewer && <MediaViewer url={viewer.url} type={viewer.type} caption={viewer.caption} title={title} onClose={() => setViewer(null)} />}
    </div>
  );
};
