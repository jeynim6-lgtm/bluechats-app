import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Send, Palette, Type } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { postStatus } from '../services/status';
import { uploadMedia, compressImage } from '../lib/media';
import { BRANDING } from '../config/branding';
import { Sheet, Spinner, ErrorBanner, toast } from './ui';

interface StatusComposerProps {
  initialMode: 'text' | 'media';
  onClose: () => void;
}

export const StatusComposer: React.FC<StatusComposerProps> = ({ initialMode, onClose }) => {
  const me = useMe();
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BRANDING.statusBackgrounds[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMode === 'media') fileRef.current?.click();
  }, [initialMode]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) return setError('Choose a photo or video.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode('media');
    setError('');
  };

  const submit = async () => {
    setError('');
    try {
      if (mode === 'media' && file) {
        setProgress(0);
        const isVideo = file.type.startsWith('video/');
        const body = isVideo ? file : await compressImage(file, 1440);
        const res = await uploadMedia(body, 'status', { onProgress: setProgress });
        await postStatus(me, { type: isVideo ? 'video' : 'image', mediaUrl: res.url, mediaPath: res.path, text, bg: '#000000' });
      } else {
        if (!text.trim()) return;
        await postStatus(me, { type: 'text', text, bg });
      }
      toast('Status posted · visible for 24 hours');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <Sheet title="New status update" onClose={onClose}>
      <div className="p-4 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <input type="file" ref={fileRef} accept="image/*,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

        {mode === 'text' ? (
          <div className="w-full h-56 rounded-2xl p-4 flex items-center justify-center relative shadow-inner transition-colors" style={{ backgroundColor: bg }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              aria-label="Status text"
              className="w-full h-full bg-transparent text-white font-serif-brand text-xl text-center resize-none focus:outline-none placeholder-white/60"
              maxLength={700}
              autoFocus
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-white/70 font-mono">{text.length}/700</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-full h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {preview && file?.type.startsWith('video/') ? (
                <video src={preview} controls className="max-h-full max-w-full" />
              ) : (
                preview && <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
              )}
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a caption…"
              maxLength={700}
              className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        )}

        {mode === 'text' && (
          <div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-mist-soft mb-2 font-semibold">
              <Palette className="w-3.5 h-3.5 text-brand" /> Background
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              {BRANDING.statusBackgrounds.map((c) => (
                <button
                  key={c}
                  onClick={() => setBg(c)}
                  aria-label={`Background ${c}`}
                  className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${bg === c ? 'border-brand scale-110 shadow-md' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line dark:border-night-line">
          {mode === 'text' ? (
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold text-brand cursor-pointer">
              <ImageIcon className="w-4 h-4" /> Photo / video
            </button>
          ) : (
            <button
              onClick={() => {
                setMode('text');
                setFile(null);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-brand cursor-pointer"
            >
              <Type className="w-4 h-4" /> Text instead
            </button>
          )}
          <button
            onClick={submit}
            disabled={busy || (mode === 'text' ? !text.trim() : !file)}
            className="bg-brand hover:bg-brand-strong disabled:opacity-50 text-white px-5 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            {busy ? <Spinner className="w-3.5 h-3.5 text-white" /> : <Send className="w-3.5 h-3.5" />}
            {busy ? `Uploading ${progress}%` : 'Post status'}
          </button>
        </div>
      </div>
    </Sheet>
  );
};
