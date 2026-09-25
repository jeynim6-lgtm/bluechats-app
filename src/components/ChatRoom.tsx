import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Download,
  Loader2,
  Play,
  Pause,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, ChatSummary } from '../types';
import { uploadToBunny } from '../services/bunnyStorage';

interface ChatRoomProps {
  chat: ChatSummary;
  messages: ChatMessage[];
  currentUserId: string;
  onBack: () => void;
  onSendMessage: (message: Partial<ChatMessage>) => void;
  onStartVoiceCall: (partnerId: string, partnerName: string) => void;
  onStartVideoCall: (partnerId: string, partnerName: string) => void;
  onOpenProfile?: (contact: {
    id: string;
    name: string;
    avatar?: string;
    avatarColor?: string;
    country?: string;
  }) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  messages,
  currentUserId,
  onBack,
  onSendMessage,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenProfile,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Pickers & Panels
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activePickerTab, setActivePickerTab] = useState<'emoji' | 'stickers'>('emoji');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Camera capture state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const emojiList = ['😀', '😂', '😍', '🔥', '👏', '🙏', '❤️', '🎉', '🇿🇦', '🚀', '💯', '✨', '😎', '👍', '💪', '💙'];
  const stickerList = [
    { label: 'Blue Heart', emoji: '💙', text: 'Blue Love' },
    { label: 'African Lion', emoji: '🦁', text: 'Simba Vibe' },
    { label: 'SA Flag', emoji: '🇿🇦', text: 'Proudly South African' },
    { label: 'Rocket', emoji: '🚀', text: 'To The Moon' },
    { label: 'Sparkles', emoji: '✨', text: 'Pure Magic' },
    { label: 'Crown', emoji: '👑', text: 'Royalty' },
    { label: 'Fire', emoji: '🔥', text: 'Hot & Trendy' },
    { label: 'Peace', emoji: '✌️', text: 'Good Vibes Only' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Handle Text Submission
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage({
      type: 'text',
      text: inputText.trim(),
    });
    setInputText('');
    setShowEmojiPicker(false);
  };

  // Copy message text
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Start voice note recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access is required to record voice notes.');
    }
  };

  // Stop voice recording and upload to Bunny.net
  const stopRecording = (discard = false) => {
    if (!mediaRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const duration = recordingDuration;
    setIsRecording(false);

    if (discard) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      return;
    }

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (audioBlob.size === 0) return;

      setIsUploading(true);
      setUploadStatus('Uploading voice note to Bunny.net...');

      try {
        const bunnyResult = await uploadToBunny(audioBlob, 'voice');
        onSendMessage({
          type: 'voice',
          text: `Voice note (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
          mediaUrl: bunnyResult.url,
          mediaDuration: duration,
          mediaSize: bunnyResult.size,
          mimeType: 'audio/webm',
        });
      } catch (err) {
        console.error('Voice upload failed:', err);
      } finally {
        setIsUploading(false);
        setUploadStatus('');
      }
    };

    mediaRecorderRef.current.stop();
  };

  // Handle Photo/Video Upload from gallery
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const folder = isVideo ? 'videos' : 'photos';

    setIsUploading(true);
    setUploadStatus(`Uploading ${isVideo ? 'video' : 'photo'} to Bunny.net...`);

    try {
      const bunnyResult = await uploadToBunny(file, folder);
      onSendMessage({
        type: isVideo ? 'video' : 'image',
        text: file.name,
        mediaUrl: bunnyResult.url,
        mediaSize: bunnyResult.size,
        mimeType: file.type,
      });
    } catch (err) {
      alert('Failed to upload media to Bunny.net');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Document Upload
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Uploading document to Bunny.net...`);

    try {
      const bunnyResult = await uploadToBunny(file, 'photos', file.name);
      onSendMessage({
        type: 'file',
        text: file.name,
        mediaUrl: bunnyResult.url,
        mediaSize: bunnyResult.size,
        mimeType: file.type || 'application/pdf',
      });
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (docInputRef.current) docInputRef.current.value = '';
      setShowAttachMenu(false);
    }
  };

  // Send current location
  const handleSendLocation = () => {
    setShowAttachMenu(false);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSendMessage({
            type: 'location',
            text: '📍 Current Location',
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: 'Cape Town, South Africa (GPS verified)',
            },
          });
        },
        () => {
          // Fallback location
          onSendMessage({
            type: 'location',
            text: '📍 Location: Cape Town, South Africa',
            location: {
              lat: -33.9249,
              lng: 18.4241,
              address: 'Cape Town City Centre, South Africa',
            },
          });
        }
      );
    }
  };

  // Send contact card
  const handleSendContact = () => {
    setShowAttachMenu(false);
    onSendMessage({
      type: 'contact',
      text: '👤 Contact Card: Sarah Ndlovu',
      contactCard: {
        name: 'Sarah Ndlovu',
        phone: '+27 72 345 6789',
      },
    });
  };

  // Camera direct capture: Open camera stream
  const openCameraModal = async () => {
    setShowCameraModal(true);
    setCapturedPhoto(null);
    setCapturedBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      });
      setCameraStream(stream);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
    } catch (err) {
      console.warn('Direct webcam access unavailable, fallback to file capture:', err);
    }
  };

  // Snap photo from live stream
  const takeSnapshot = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedPhoto(URL.createObjectURL(blob));
        // Stop stream
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
        }
      }
    }, 'image/jpeg');
  };

  // Send captured photo to Bunny.net
  const sendCapturedPhoto = async () => {
    if (!capturedBlob) return;
    setShowCameraModal(false);
    setIsUploading(true);
    setUploadStatus('Uploading camera capture to Bunny.net...');

    try {
      const isVideo = capturedBlob.type.startsWith('video');
      const ext = isVideo ? 'mp4' : 'jpg';
      const snapName = `camera_${Date.now()}.${ext}`;
      const res = await uploadToBunny(capturedBlob, isVideo ? 'videos' : 'photos', snapName);
      onSendMessage({
        type: isVideo ? 'video' : 'image',
        text: isVideo ? 'Video captured via Camera' : 'Photo captured via Camera',
        mediaUrl: res.url,
        mediaSize: res.size,
        mimeType: capturedBlob.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      });
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setCapturedPhoto(null);
      setCapturedBlob(null);
    }
  };

  // Save captured photo to device gallery
  const saveCapturedPhotoToDevice = () => {
    if (!capturedPhoto) return;
    const a = document.createElement('a');
    a.href = capturedPhoto;
    a.download = `bluechats_snap_${Date.now()}.jpg`;
    a.click();
  };

  // Audio player toggle
  const togglePlayAudio = (messageId: string, url?: string) => {
    if (!url) return;
    if (activeAudioId === messageId && isPlayingAudio) {
      audioPlayerRef.current?.pause();
      setIsPlayingAudio(false);
      return;
    }
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setActiveAudioId(messageId);
    setIsPlayingAudio(true);

    audio.onended = () => {
      setIsPlayingAudio(false);
      setActiveAudioId(null);
    };
    audio.play().catch(() => {});
  };

  // Filter shared media gallery for side panel
  const sharedMedia = messages.filter((m) => m.mediaUrl && (m.type === 'image' || m.type === 'video' || m.type === 'file'));

  return (
    <div className="fixed inset-0 z-40 bg-[#F4F6FC] dark:bg-[#0B1130] flex flex-col max-w-[480px] mx-auto select-none overflow-hidden">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocUpload}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 bg-[#0B1330] text-white shadow-md rounded-b-2xl flex-shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() =>
              onOpenProfile?.({
                id: chat.id,
                name: chat.name,
                avatar: chat.avatar,
                avatarColor: chat.avatarColor,
                country: chat.country,
              })
            }
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 min-w-0"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-xs flex-shrink-0"
              style={{ backgroundColor: chat.avatarColor }}
            >
              {chat.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-white truncate">{chat.name}</h2>
              <p className="text-[11px] text-[#4DD8E8] flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4DD8E8]"></span>
                {chat.online ? 'Online' : 'Active recently'}
              </p>
            </div>
          </div>
        </div>

        {/* Call triggers + Expandable "›" info button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStartVoiceCall(chat.id, chat.name)}
            title="Start Voice Call"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={() => onStartVideoCall(chat.id, chat.name)}
            title="Start Video Call"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
          >
            <Video className="w-4 h-4 text-cyan-400" />
          </button>

          {/* "›" Expandable Panel Button */}
          <button
            onClick={() => setShowSidePanel(true)}
            title="Chat info & shared media"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#3B6BFA]/30 hover:bg-[#3B6BFA] text-[#4DD8E8] hover:text-white transition-all cursor-pointer font-bold text-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Upload progress banner */}
      {isUploading && (
        <div className="bg-[#3B6BFA] text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 font-semibold shadow-xs animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center my-2">
          <span className="bg-[#E4E8F7]/70 dark:bg-[#131B3E]/80 text-[#5A6182] dark:text-[#AEB4DA] text-[10px] px-3 py-1 rounded-full font-medium shadow-2xs">
            🔒 All texts in Firebase · Media in Bunny.net
          </span>
        </div>

        {messages.map((msg) => {
          const isMine = msg.mine;

          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}>
              <div
                className={`max-w-[82%] rounded-2xl p-3 shadow-xs relative transition-all ${
                  isMine
                    ? 'bg-[#3B6BFA] text-white rounded-tr-xs'
                    : 'bg-white dark:bg-[#131B3E] text-[#0E1430] dark:text-[#EEF1FF] border border-[#E4E8F7]/70 dark:border-[#242D57] rounded-tl-xs'
                }`}
              >
                {/* Voice Note */}
                {msg.type === 'voice' && (
                  <div className="flex items-center gap-3 pr-2 min-w-[190px]">
                    <button
                      onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer ${
                        isMine ? 'bg-white text-[#3B6BFA]' : 'bg-[#3B6BFA] text-white'
                      }`}
                    >
                      {activeAudioId === msg.id && isPlayingAudio ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-0.5 h-6">
                        {[14, 22, 10, 26, 18, 12, 28, 20, 16, 24, 10, 18, 15].map((h, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full ${isMine ? 'bg-white/70' : 'bg-[#3B6BFA]/60'}`}
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[10px] mt-0.5 opacity-80">
                        <span>{msg.text || 'Voice note'}</span>
                        <span className="text-[9px] uppercase tracking-wider font-mono">Bunny Audio</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo */}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="space-y-1.5">
                    <img
                      src={msg.mediaUrl}
                      alt="Shared media"
                      className="rounded-xl max-h-60 w-full object-cover cursor-pointer hover:opacity-95"
                      onClick={() => window.open(msg.mediaUrl, '_blank')}
                    />
                    <div className="flex items-center justify-between text-[10px] opacity-80 px-0.5">
                      <span className="font-mono text-[9px] bg-black/20 px-1.5 py-0.5 rounded-full">
                        🐰 Bunny.net CDN
                      </span>
                    </div>
                  </div>
                )}

                {/* Video */}
                {msg.type === 'video' && msg.mediaUrl && (
                  <div className="space-y-1.5">
                    <video src={msg.mediaUrl} controls className="rounded-xl max-h-60 w-full bg-black" />
                    <div className="flex items-center justify-between text-[10px] opacity-80 px-0.5">
                      <span className="font-mono text-[9px] bg-black/20 px-1.5 py-0.5 rounded-full">
                        🐰 Bunny Video Stream
                      </span>
                    </div>
                  </div>
                )}

                {/* Location */}
                {msg.type === 'location' && msg.location && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span>{msg.text}</span>
                    </div>
                    <p className="text-[11px] opacity-90">{msg.location.address}</p>
                    <div className="text-[10px] font-mono opacity-80">
                      Coordinates: {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                    </div>
                  </div>
                )}

                {/* Contact Card */}
                {msg.type === 'contact' && msg.contactCard && (
                  <div className="flex items-center gap-3 p-2 bg-black/10 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-[#4DD8E8] text-[#0B1330] flex items-center justify-center font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs">{msg.contactCard.name}</p>
                      <p className="text-[11px] opacity-85">{msg.contactCard.phone}</p>
                    </div>
                  </div>
                )}

                {/* Document File */}
                {msg.type === 'file' && (
                  <div className="flex items-center gap-2.5 p-2 bg-black/10 rounded-xl">
                    <FileText className="w-5 h-5 text-[#4DD8E8]" />
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate">{msg.text}</p>
                      <span className="text-[10px] opacity-75">Document</span>
                    </div>
                  </div>
                )}

                {/* Text Message */}
                {msg.type === 'text' && (
                  <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>
                )}

                {/* Meta: Time, checkmarks, and copy button */}
                <div
                  className={`flex items-center justify-between gap-2 mt-1 text-[10px] ${
                    isMine ? 'text-white/80' : 'text-[#9AA1C4] dark:text-[#7A81A8]'
                  }`}
                >
                  {/* Copy message button */}
                  <button
                    onClick={() => handleCopyText(msg.text || '', msg.id)}
                    title="Copy message text"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-white cursor-pointer"
                  >
                    {copiedMessageId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-300" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex items-center gap-1 ml-auto">
                    <span>{msg.timeFormatted}</span>
                    {isMine && <CheckCheck className="w-3.5 h-3.5 text-[#4DD8E8]" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ATTACHMENT ACTION SHEET */}
      {showAttachMenu && (
        <div className="p-3 bg-white dark:bg-[#131B3E] border-t border-[#E4E8F7] dark:border-[#242D57] grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] hover:bg-[#3B6BFA]/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#0E1430] dark:text-[#EEF1FF]">Gallery</span>
          </button>

          <button
            onClick={() => {
              setShowAttachMenu(false);
              docInputRef.current?.click();
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] hover:bg-[#3B6BFA]/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#0E1430] dark:text-[#EEF1FF]">Document</span>
          </button>

          <button
            onClick={handleSendLocation}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] hover:bg-[#3B6BFA]/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#0E1430] dark:text-[#EEF1FF]">Location</span>
          </button>

          <button
            onClick={handleSendContact}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#F4F6FC] dark:bg-[#0B1130] hover:bg-[#3B6BFA]/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#0E1430] dark:text-[#EEF1FF]">Contact</span>
          </button>
        </div>
      )}

      {/* EMOJI & STICKER PICKER */}
      {showEmojiPicker && (
        <div className="p-3 bg-white dark:bg-[#131B3E] border-t border-[#E4E8F7] dark:border-[#242D57] max-h-48 overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-4 pb-2 mb-2 border-b border-[#E4E8F7] dark:border-[#242D57] text-xs font-bold">
            <button
              onClick={() => setActivePickerTab('emoji')}
              className={`pb-1 cursor-pointer ${
                activePickerTab === 'emoji' ? 'text-[#3B6BFA] border-b-2 border-[#3B6BFA]' : 'text-[#9AA1C4]'
              }`}
            >
              Emojis
            </button>
            <button
              onClick={() => setActivePickerTab('stickers')}
              className={`pb-1 cursor-pointer ${
                activePickerTab === 'stickers' ? 'text-[#3B6BFA] border-b-2 border-[#3B6BFA]' : 'text-[#9AA1C4]'
              }`}
            >
              Blue Stickers
            </button>
          </div>

          {activePickerTab === 'emoji' ? (
            <div className="grid grid-cols-8 gap-2 text-xl">
              {emojiList.map((em, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText((prev) => prev + em)}
                  className="hover:scale-125 transition-transform p-1 cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {stickerList.map((st, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSendMessage({
                      type: 'text',
                      text: `${st.emoji} ${st.text}`,
                    });
                    setShowEmojiPicker(false);
                  }}
                  className="flex flex-col items-center p-2 rounded-xl bg-[#F4F6FC] dark:bg-[#0B1130] hover:bg-[#3B6BFA]/10 text-center cursor-pointer transition-all"
                >
                  <span className="text-2xl mb-1">{st.emoji}</span>
                  <span className="text-[9px] font-bold text-[#5A6182] dark:text-[#AEB4DA] truncate w-full">
                    {st.text}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-white dark:bg-[#131B3E] border-t border-[#E4E8F7] dark:border-[#242D57] flex-shrink-0">
        {isRecording ? (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">
                Recording Voice Note... {Math.floor(recordingDuration / 60)}:
                {(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => stopRecording(true)}
                title="Discard"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <button
                onClick={() => stopRecording(false)}
                title="Send Voice Note to Bunny.net"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-1.5">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(!showAttachMenu);
                setShowEmojiPicker(false);
              }}
              title="Attachments"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9AA1C4] hover:text-[#3B6BFA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Direct Camera Button (WhatsApp style) */}
            <button
              type="button"
              onClick={openCameraModal}
              title="Camera Capture"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9AA1C4] hover:text-[#3B6BFA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Emoji & Sticker Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowAttachMenu(false);
              }}
              title="Emoji and stickers"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9AA1C4] hover:text-[#3B6BFA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-full px-4 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
            />

            {/* Send or Voice Note button */}
            {inputText.trim().length > 0 ? (
              <button
                type="submit"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-90 transition-all text-white shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                title="Record voice note"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[#3B6BFA] hover:bg-[#2453D6] active:scale-90 transition-all text-white shadow-md cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* "›" EXPANDABLE SIDE PANEL */}
      {showSidePanel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-white dark:bg-[#131B3E] h-full shadow-2xl flex flex-col p-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E4E8F7] dark:border-[#242D57]">
              <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF]">Chat Details</h3>
              <button
                onClick={() => setShowSidePanel(false)}
                className="p-1 rounded-full text-[#9AA1C4] hover:text-[#0E1430]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="text-center py-5">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-bold text-white text-xl shadow-md mb-2"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {chat.name.substring(0, 2).toUpperCase()}
              </div>
              <h4 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">{chat.name}</h4>
              <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA]">{chat.country || 'South Africa'}</p>

              <button
                onClick={() => {
                  setShowSidePanel(false);
                  onOpenProfile?.({
                    id: chat.id,
                    name: chat.name,
                    avatar: chat.avatar,
                    avatarColor: chat.avatarColor,
                    country: chat.country,
                  });
                }}
                className="mt-3 px-4 py-1.5 rounded-full bg-[#3B6BFA]/10 hover:bg-[#3B6BFA] hover:text-white text-[#3B6BFA] font-bold text-xs transition-colors cursor-pointer"
              >
                View Full Profile
              </button>
            </div>

            {/* Shared Media Gallery */}
            <div className="py-3 border-t border-[#E4E8F7] dark:border-[#242D57] flex-1">
              <h5 className="font-bold text-xs text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-2.5">
                Shared Media ({sharedMedia.length})
              </h5>

              {sharedMedia.length === 0 ? (
                <p className="text-xs text-[#9AA1C4] text-center py-4">No shared media yet in this chat</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sharedMedia.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => m.mediaUrl && window.open(m.mediaUrl, '_blank')}
                      className="aspect-square rounded-xl bg-black overflow-hidden relative cursor-pointer hover:opacity-85"
                    >
                      {m.type === 'video' ? (
                        <video src={m.mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.mediaUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 rounded">
                        Bunny
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Copy Any Message Action */}
            <div className="pt-3 border-t border-[#E4E8F7] dark:border-[#242D57] space-y-2">
              <h5 className="font-bold text-xs text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider">
                Recent Message Snippets
              </h5>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {messages.slice(-5).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleCopyText(m.text || '', m.id)}
                    className="p-2 rounded-xl bg-[#F4F6FC] dark:bg-[#0B1130] text-xs flex items-center justify-between cursor-pointer hover:bg-[#3B6BFA]/10"
                  >
                    <span className="truncate max-w-[190px] text-[#0E1430] dark:text-[#EEF1FF]">
                      {m.text || m.type}
                    </span>
                    <Copy className="w-3.5 h-3.5 text-[#9AA1C4]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA DIRECT CAPTURE MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col max-w-[480px] mx-auto animate-in fade-in duration-200">
          <div className="p-4 flex items-center justify-between text-white z-10">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#4DD8E8]" />
              <span>Blue Chats Camera</span>
            </span>
            <button
              onClick={() => {
                if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
                setShowCameraModal(false);
              }}
              className="p-2 text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
          </div>

          {/* Camera Controls */}
          <div className="p-6 bg-black/80 flex items-center justify-around z-10">
            {capturedPhoto ? (
              <>
                <button
                  onClick={openCameraModal}
                  className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold"
                >
                  Retake
                </button>
                <button
                  onClick={saveCapturedPhotoToDevice}
                  className="p-3 rounded-full bg-white/20 text-white"
                  title="Save to Gallery"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={sendCapturedPhoto}
                  className="px-5 py-2.5 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>Send to Bunny</span>
                </button>
              </>
            ) : (
              <>
                <label className="p-3 rounded-full bg-white/10 text-white cursor-pointer" title="Pick from device">
                  <ImageIcon className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCapturedBlob(file);
                        setCapturedPhoto(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </label>

                {/* Shutter Button */}
                <button
                  onClick={takeSnapshot}
                  className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-white"></div>
                </button>

                <div className="w-11"></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
