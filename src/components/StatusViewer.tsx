import React, { useState, useEffect, useRef } from 'react';
import { X, Star, ExternalLink } from 'lucide-react';
import { StatusContact, StatusItem } from '../types';
import { SPONSORED_ADS } from '../services/mockInitialData';

interface StatusViewerProps {
  contacts: StatusContact[];
  initialContactIndex: number;
  onClose: () => void;
  onStarStatus?: (contactId: string, itemId: string) => void;
}

export const StatusViewer: React.FC<StatusViewerProps> = ({
  contacts,
  initialContactIndex,
  onClose,
  onStarStatus,
}) => {
  const [contactIndex, setContactIndex] = useState(initialContactIndex);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [stars, setStars] = useState<Record<string, boolean>>({});

  const SEGMENT_DURATION = 4500; // 4.5 seconds per slide
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());

  const currentContact = contacts[contactIndex];

  // Interleave sponsored item if appropriate matching design
  const items: StatusItem[] = React.useMemo(() => {
    if (!currentContact) return [];
    const list: StatusItem[] = [...currentContact.items];
    if (list.length >= 2) {
      const ad = SPONSORED_ADS[contactIndex % SPONSORED_ADS.length];
      list.splice(2, 0, {
        id: `ad-${ad.sponsor}`,
        type: 'text',
        text: ad.text,
        bg: ad.bg,
        timestamp: Date.now(),
        timeFormatted: 'Sponsored',
        views: 0,
        sponsored: true,
        sponsor: ad.sponsor,
        cta: ad.cta,
      });
    }
    return list;
  }, [currentContact, contactIndex]);

  const currentItem = items[segmentIndex];

  // Advance to next segment
  const nextSegment = () => {
    if (segmentIndex < items.length - 1) {
      setSegmentIndex((prev) => prev + 1);
      setProgress(0);
    } else if (contactIndex < contacts.length - 1) {
      setContactIndex((prev) => prev + 1);
      setSegmentIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  // Back to previous segment
  const prevSegment = () => {
    if (segmentIndex > 0) {
      setSegmentIndex((prev) => prev - 1);
      setProgress(0);
    } else if (contactIndex > 0) {
      setContactIndex((prev) => prev - 1);
      setSegmentIndex(0);
      setProgress(0);
    }
  };

  // Progress timer loop
  useEffect(() => {
    if (isPaused || !currentItem) return;

    startRef.current = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / SEGMENT_DURATION) * 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        nextSegment();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [segmentIndex, contactIndex, isPaused, items.length]);

  const toggleStar = () => {
    if (!currentItem) return;
    setStars((prev) => ({
      ...prev,
      [currentItem.id]: !prev[currentItem.id],
    }));
    if (onStarStatus && currentContact) {
      onStarStatus(currentContact.id, currentItem.id);
    }
  };

  if (!currentContact || !currentItem) return null;

  const isStarred = stars[currentItem.id] || currentItem.starred;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05070F] text-white flex flex-col max-w-[480px] mx-auto select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Top Progress Bars */}
      <div className="flex gap-1 px-3 pt-3 pb-2 z-20">
        {items.map((it, idx) => {
          let fillWidth = '0%';
          if (idx < segmentIndex) fillWidth = '100%';
          else if (idx === segmentIndex) fillWidth = `${progress}%`;

          return (
            <div
              key={it.id || idx}
              className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{ width: fillWidth }}
              ></div>
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 z-20">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs border border-white/20 shadow-xs"
            style={{
              backgroundColor: currentItem.sponsored ? '#E8A23B' : currentContact.avatarColor,
            }}
          >
            {currentItem.sponsored ? '$' : currentContact.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">
              {currentItem.sponsored ? currentItem.sponsor : currentContact.name}
            </h3>
            <span className="text-[11px] text-[#B9C0E6]">
              {currentItem.sponsored ? 'Sponsored' : currentItem.timeFormatted}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Story Center Body with Tap Zones */}
      <div
        className="flex-1 relative flex items-center justify-center px-6 text-center overflow-hidden"
        style={{ backgroundColor: currentItem.bg || '#152657' }}
      >
        {/* Left Tap Zone */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            prevSegment();
          }}
          className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
        ></div>

        {/* Right Tap Zone */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            nextSegment();
          }}
          className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer"
        ></div>

        {/* Sponsor Pill */}
        {currentItem.sponsored && (
          <div className="absolute top-4 bg-[#E8A23B]/25 border border-[#E8A23B] text-[#E8A23B] text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider z-20">
            Sponsored Partner
          </div>
        )}

        {/* Content */}
        {currentItem.type === 'text' && (
          <p className="font-serif-brand font-semibold text-2xl md:text-3xl leading-snug text-white max-w-sm drop-shadow-md z-10">
            {currentItem.text}
          </p>
        )}

        {currentItem.type === 'image' && currentItem.mediaUrl && (
          <img
            src={currentItem.mediaUrl}
            alt="Status"
            className="w-full h-full object-cover z-10"
          />
        )}

        {currentItem.type === 'video' && currentItem.mediaUrl && (
          <video
            src={currentItem.mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover z-10"
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-black/40 backdrop-blur-md flex items-center justify-between z-20">
        {!currentItem.sponsored ? (
          <>
            <button
              onClick={toggleStar}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isStarred
                  ? 'bg-[#E8A23B]/20 border border-[#E8A23B] text-[#E8A23B] scale-110'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}
            >
              <Star className={`w-5 h-5 ${isStarred ? 'fill-current' : ''}`} />
            </button>

            <span className="text-xs text-[#B9C0E6]">
              <strong className="text-white">{currentItem.views + (isStarred ? 1 : 0)}</strong> views
              {isStarred && ' · ★ starred'}
            </span>
          </>
        ) : (
          <button
            onClick={() => alert(`Opening sponsor link for: ${currentItem.sponsor}`)}
            className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white font-bold py-3 rounded-full text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <span>{currentItem.cta || 'Learn more'}</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
