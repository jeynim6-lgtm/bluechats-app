import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ExternalLink, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { markStatusViewed, deleteStatus, trackSponsored } from '../services/status';
import { getUserProfile } from '../services/users';
import { formatRelative } from '../lib/format';
import { BRANDING } from '../config/branding';
import { Avatar, Sheet, toast } from './ui';
import type { StatusGroup, StatusItem } from '../types';

const IMAGE_DURATION = 5000;
const TEXT_DURATION = 5000;

interface StatusViewerProps {
  groups: StatusGroup[];
  initialIndex: number;
  onClose: () => void;
}

export const StatusViewer: React.FC<StatusViewerProps> = ({ groups, initialIndex, onClose }) => {
  const me = useMe();
  const [groupIndex, setGroupIndex] = useState(initialIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewerNames, setViewerNames] = useState<Array<{ uid: string; name: string; color: string; url?: string | null }>>([]);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(Date.now());
  const elapsedBeforePause = useRef(0);

  const group = groups[groupIndex];

  // Other people's stories get one sponsored card after the second update.
  const items: StatusItem[] = useMemo(() => {
    if (!group) return [];
    const list = group.items.filter((s) => !deleted.has(s.id));
    const cards = BRANDING.sponsoredCards;
    if (!group.isMine && list.length >= 2 && cards.length) {
      const card = cards[groupIndex % cards.length];
      list.splice(2, 0, {
        id: `sponsored-${card.id}-${group.authorId}`,
        authorId: 'sponsored',
        author: { name: card.sponsor, avatarColor: BRANDING.colors.gold },
        type: 'text',
        text: card.text,
        bg: card.bg,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1,
        viewers: [],
        sponsored: true,
        sponsorId: card.id,
        sponsor: card.sponsor,
        cta: card.cta,
        ctaUrl: card.url,
      });
    }
    return list;
  }, [group, groupIndex, deleted]);

  const item = items[itemIndex];

  const next = useCallback(() => {
    setProgress(0);
    elapsedBeforePause.current = 0;
    if (itemIndex < items.length - 1) setItemIndex((i) => i + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setItemIndex(0);
    } else onClose();
  }, [itemIndex, items.length, groupIndex, groups.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    elapsedBeforePause.current = 0;
    if (itemIndex > 0) setItemIndex((i) => i - 1);
    else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setItemIndex(0);
    }
  }, [itemIndex, groupIndex]);

  // Record views / impressions
  useEffect(() => {
    if (!item) return;
    if (item.sponsored && item.sponsorId) void trackSponsored(item.sponsorId, 'impressions');
    else if (!group.isMine && !item.viewers.includes(me.uid)) void markStatusViewed(item.id, me.uid);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for text/image items (videos drive progress from playback)
  useEffect(() => {
    if (!item || item.type === 'video' || paused || viewersOpen) return;
    const duration = item.type === 'image' ? IMAGE_DURATION : TEXT_DURATION;
    startedAt.current = Date.now() - elapsedBeforePause.current;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      elapsedBeforePause.current = elapsed;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(id);
        next();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [item?.id, paused, viewersOpen, next]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || viewersOpen) v.pause();
    else void v.play().catch(() => {});
  }, [paused, viewersOpen, item?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const openViewers = async () => {
    if (!item) return;
    setViewersOpen(true);
    const profiles = await Promise.all(item.viewers.map((uid) => getUserProfile(uid).catch(() => null)));
    setViewerNames(
      profiles.filter(Boolean).map((p) => ({ uid: p!.uid, name: p!.name, color: p!.avatarColor, url: p!.avatarUrl }))
    );
  };

  const remove = async () => {
    if (!item || !window.confirm('Delete this status update?')) return;
    try {
      await deleteStatus(item);
      setDeleted((d) => new Set(d).add(item.id));
      if (items.length <= 1) onClose();
      else if (itemIndex >= items.length - 1) setItemIndex((i) => Math.max(0, i - 1));
      toast('Status deleted');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  if (!group || !item) return null;

  const hold = { onPointerDown: () => setPaused(true), onPointerUp: () => setPaused(false), onPointerLeave: () => setPaused(false) };

  return (
    <div className="fixed inset-0 z-[60] bg-[#05070F] text-white flex flex-col max-w-[480px] mx-auto select-none" role="dialog" aria-label="Status viewer">
      <div className="flex gap-1 px-3 pt-3 pb-2 z-20">
        {items.map((it, idx) => (
          <div key={it.id} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white" style={{ width: idx < itemIndex ? '100%' : idx === itemIndex ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          {item.sponsored ? (
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center font-bold">★</div>
          ) : (
            <Avatar name={group.isMine ? me.name : group.name} color={group.avatarColor} url={group.avatarUrl} size={36} shape="circle" />
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{item.sponsored ? item.sponsor : group.isMine ? 'My status' : group.name}</h3>
            <span className="text-[11px] text-haze">{item.sponsored ? 'Sponsored' : formatRelative(item.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {group.isMine && !item.sponsored && (
            <button onClick={remove} aria-label="Delete status" className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center text-center overflow-hidden" style={{ backgroundColor: item.type === 'text' ? item.bg : '#000' }} {...hold}>
        <button onClick={prev} aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer flex items-center justify-start pl-1 opacity-0 hover:opacity-60">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={next} aria-label="Next" className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer flex items-center justify-end pr-1 opacity-0 hover:opacity-60">
          <ChevronRight className="w-6 h-6" />
        </button>

        {item.sponsored && (
          <div className="absolute top-4 bg-gold/25 border border-gold text-gold text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider z-20">
            Sponsored
          </div>
        )}

        {item.type === 'text' && (
          <p className="font-serif-brand font-semibold text-2xl leading-snug max-w-sm px-6 drop-shadow-md whitespace-pre-wrap break-words">{item.text}</p>
        )}
        {item.type === 'image' && item.mediaUrl && <img src={item.mediaUrl} alt="Status" className="w-full h-full object-contain" />}
        {item.type === 'video' && item.mediaUrl && (
          <video
            key={item.id}
            ref={videoRef}
            src={item.mediaUrl}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(Math.min(100, (v.currentTime / Math.min(v.duration, 60)) * 100));
              if (v.currentTime >= 60) next();
            }}
            onEnded={next}
          />
        )}
        {item.type !== 'text' && item.text && (
          <p className="absolute bottom-4 left-4 right-4 z-10 text-sm bg-black/50 rounded-xl px-3 py-2 whitespace-pre-wrap">{item.text}</p>
        )}
      </div>

      <div className="px-5 py-4 bg-black/40 backdrop-blur-md flex items-center justify-center z-20 min-h-[68px]">
        {item.sponsored ? (
          item.ctaUrl ? (
            <button
              onClick={() => {
                void trackSponsored(item.sponsorId!, 'clicks');
                window.open(item.ctaUrl, '_blank', 'noopener');
              }}
              className="w-full bg-brand hover:bg-brand-strong text-white font-bold py-3 rounded-full text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {item.cta || 'Learn more'} <ExternalLink className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-xs text-haze">{item.sponsor}</span>
          )
        ) : group.isMine ? (
          <button onClick={openViewers} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <Eye className="w-4 h-4" /> {item.viewers.length} view{item.viewers.length === 1 ? '' : 's'}
          </button>
        ) : (
          <span className="text-xs text-haze">Tap left/right to navigate · hold to pause</span>
        )}
      </div>

      {viewersOpen && (
        <Sheet title={`Viewed by ${item.viewers.length}`} onClose={() => setViewersOpen(false)} z="z-[70]">
          <div className="p-4 space-y-2 text-ink dark:text-mist">
            {item.viewers.length === 0 && <p className="text-xs text-ink-faint text-center py-4">No views yet</p>}
            {viewerNames.map((v) => (
              <div key={v.uid} className="flex items-center gap-3">
                <Avatar name={v.name} color={v.color} url={v.url} size={36} shape="circle" />
                <span className="text-sm font-semibold">{v.name}</span>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
};
