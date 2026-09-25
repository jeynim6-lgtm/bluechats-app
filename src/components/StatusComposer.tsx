import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Send, Palette, Loader2 } from 'lucide-react';
import { uploadToBunny } from '../services/bunnyStorage';
import { StatusItem } from '../types';

interface StatusComposerProps {
  onClose: () => void;
  onPostStatus: (item: Partial<StatusItem>) => void;
}

const COLOR_PALETTES = [
  '#2453D6',
  '#8A6CF2',
  '#34B3A0',
  '#E8A23B',
  '#101C42',
  '#E15B5B',
  '#0B1330',
];

export const StatusComposer: React.FC<StatusComposerProps> = ({ onClose, onPostStatus }) => {
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState(COLOR_PALETTES[0]);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      setMediaPreview(URL.createObjectURL(file));
      setMode('media');
    }
  };

  const handleSubmit = async () => {
    if (mode === 'text' && !statusText.trim()) return;

    if (mode === 'media' && selectedMedia) {
      setIsUploading(true);
      try {
        const isVideo = selectedMedia.type.startsWith('video');
        const res = await uploadToBunny(selectedMedia, 'status');
        onPostStatus({
          type: isVideo ? 'video' : 'image',
          mediaUrl: res.url,
          text: statusText.trim() || undefined,
          bg: '#000000',
        });
        onClose();
      } catch (err) {
        console.error(err);
        alert('Failed to upload status media to Bunny.net');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    onPostStatus({
      type: 'text',
      text: statusText.trim(),
      bg: selectedBg,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1330]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-[#F4F6FC] dark:bg-[#131B3E] border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E8F7] dark:border-[#242D57]">
          <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF]">New Status Update</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9AA1C4] hover:text-[#0E1430] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 space-y-4">
          {mode === 'text' ? (
            <div
              className="w-full h-52 rounded-2xl p-4 flex items-center justify-center transition-colors relative shadow-inner"
              style={{ backgroundColor: selectedBg }}
            >
              <textarea
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="What's on your mind?..."
                className="w-full h-full bg-transparent text-white font-serif-brand text-xl text-center resize-none focus:outline-none placeholder-white/60 drop-shadow-xs"
                maxLength={180}
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-white/70 font-mono">
                {statusText.length}/180
              </span>
            </div>
          ) : (
            <div className="w-full h-52 rounded-2xl overflow-hidden bg-black relative flex items-center justify-center">
              {mediaPreview && selectedMedia?.type.startsWith('video') ? (
                <video src={mediaPreview} controls className="max-h-full max-w-full" />
              ) : (
                <img src={mediaPreview || ''} alt="Preview" className="max-h-full max-w-full object-cover" />
              )}
              <button
                onClick={() => {
                  setSelectedMedia(null);
                  setMediaPreview(null);
                  setMode('text');
                }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Color selector for text mode */}
          {mode === 'text' && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#5A6182] dark:text-[#AEB4DA] mb-2 font-semibold">
                <Palette className="w-3.5 h-3.5 text-[#3B6BFA]" /> Pick Background
              </div>
              <div className="flex gap-2 justify-center">
                {COLOR_PALETTES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedBg(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                      selectedBg === c ? 'border-white scale-115 shadow-md' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Mode switch & Upload trigger */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E4E8F7] dark:border-[#242D57]">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold text-[#3B6BFA] hover:text-[#2453D6] cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Add Photo/Video</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={isUploading || (mode === 'text' && !statusText.trim())}
              className="bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-50 text-white px-5 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to Bunny...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Status</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
