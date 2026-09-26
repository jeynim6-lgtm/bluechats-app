import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MediaViewerProps {
  url: string;
  type: 'image' | 'video';
  caption?: string | null;
  title?: string;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ url, type, caption, title, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-fade-in" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-semibold truncate">{title}</span>
        <div className="flex items-center gap-1">
          <a
            href={url}
            download
            target="_blank"
            rel="noreferrer"
            aria-label="Download"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10"
          >
            <Download className="w-5 h-5" />
          </a>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2" onClick={onClose}>
        {type === 'image' ? (
          <img src={url} alt={caption || ''} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        ) : (
          <video src={url} controls autoPlay playsInline className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
      {caption && <p className="p-4 text-center text-sm text-white/90 whitespace-pre-wrap">{caption}</p>}
    </div>
  );
};
