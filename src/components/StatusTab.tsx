import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Camera } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { subscribeStatuses } from '../services/status';
import { formatRelative } from '../lib/format';
import { useT } from '../lib/i18n';
import { Avatar } from './ui';
import { StatusViewer } from './StatusViewer';
import { StatusComposer } from './StatusComposer';
import type { StatusGroup, StatusItem } from '../types';

export interface StatusFeed {
  mine: StatusGroup | null;
  others: StatusGroup[];
  hasUnseen: boolean;
}

/** Live statuses from me, my contacts and people I chat with. */
export function useStatusFeed(): StatusFeed {
  const me = useMe();
  const { contacts, chats, blocked, displayName } = useAppData();
  const [items, setItems] = useState<StatusItem[]>([]);

  const authorKey = useMemo(() => {
    const ids = new Set<string>([me.uid]);
    contacts.forEach((c) => c.uid && ids.add(c.uid));
    chats.forEach((c) => c.type === 'direct' && c.participants.forEach((p) => ids.add(p)));
    return [...ids].sort().join(',');
  }, [me.uid, contacts, chats]);

  useEffect(() => subscribeStatuses(authorKey.split(','), setItems), [authorKey]);

  return useMemo(() => {
    const byAuthor = new Map<string, StatusItem[]>();
    for (const item of items) {
      if (blocked.has(item.authorId)) continue;
      const list = byAuthor.get(item.authorId) || [];
      list.push(item);
      byAuthor.set(item.authorId, list);
    }
    const groups: StatusGroup[] = [...byAuthor.entries()].map(([authorId, list]) => {
      list.sort((a, b) => a.createdAt - b.createdAt);
      const latest = list[list.length - 1];
      const isMine = authorId === me.uid;
      return {
        authorId,
        name: isMine ? 'My status' : displayName(authorId, latest.author?.name || 'Blue Chats user'),
        avatarColor: latest.author?.avatarColor || '#3B6BFA',
        avatarUrl: latest.author?.avatarUrl || null,
        items: list,
        seen: isMine || list.every((s) => s.viewers.includes(me.uid)),
        isMine,
      };
    });
    const mine = groups.find((g) => g.isMine) || null;
    const others = groups
      .filter((g) => !g.isMine)
      .sort((a, b) => Number(a.seen) - Number(b.seen) || b.items[b.items.length - 1].createdAt - a.items[a.items.length - 1].createdAt);
    return { mine, others, hasUnseen: others.some((g) => !g.seen) };
  }, [items, blocked, me.uid, displayName]);
}

const StoryRing: React.FC<{ group: StatusGroup; size?: number }> = ({ group, size = 52 }) => (
  <div
    className={`rounded-full p-[2.5px] ${group.seen ? 'bg-line dark:bg-night-line' : 'bg-gradient-to-tr from-accent via-brand to-brand-soft'}`}
    style={{ width: size + 5, height: size + 5 }}
  >
    <div className="rounded-full border-2 border-white dark:border-night overflow-hidden">
      <Avatar name={group.name} color={group.avatarColor} url={group.avatarUrl} size={size - 4} shape="circle" />
    </div>
  </div>
);

export const StatusTab: React.FC<{ feed: StatusFeed }> = ({ feed }) => {
  const me = useMe();
  const t = useT();
  const [viewer, setViewer] = useState<{ groups: StatusGroup[]; index: number } | null>(null);
  const [composer, setComposer] = useState<null | 'text' | 'media'>(null);

  const unseen = feed.others.filter((g) => !g.seen);
  const seen = feed.others.filter((g) => g.seen);
  const latestMine = feed.mine?.items[feed.mine.items.length - 1];

  const row = (group: StatusGroup, list: StatusGroup[]) => {
    const latest = group.items[group.items.length - 1];
    return (
      <button
        key={group.authorId}
        onClick={() => setViewer({ groups: list, index: list.indexOf(group) })}
        className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/5 text-left cursor-pointer"
      >
        <StoryRing group={group} />
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-ink dark:text-mist truncate">{group.name}</h4>
          <p className="text-[11px] text-ink-soft dark:text-mist-soft truncate">
            {formatRelative(latest.createdAt)} · {group.items.length} update{group.items.length > 1 ? 's' : ''}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center gap-3.5">
        <button
          onClick={() => (feed.mine ? setViewer({ groups: [feed.mine], index: 0 }) : setComposer('text'))}
          className="relative cursor-pointer"
          aria-label={feed.mine ? 'View my status' : 'Add status'}
        >
          {feed.mine ? (
            <StoryRing group={{ ...feed.mine, name: me.name, seen: false }} />
          ) : (
            <Avatar name={me.name} color={me.avatarColor} url={me.avatarUrl} size={56} shape="circle" />
          )}
          <span
            onClick={(e) => {
              e.stopPropagation();
              setComposer('text');
            }}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center border-2 border-white dark:border-night"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-ink dark:text-mist">{t('myStatus')}</h3>
          <p className="text-xs text-ink-soft dark:text-mist-soft truncate">
            {latestMine
              ? `${formatRelative(latestMine.createdAt)} · ${feed.mine!.items.length} update${feed.mine!.items.length > 1 ? 's' : ''}`
              : 'Tap to share a text, photo or video for 24 hours'}
          </p>
        </div>
        <button
          onClick={() => setComposer('media')}
          aria-label="Photo or video status"
          className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center cursor-pointer hover:bg-brand/20"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      {feed.others.length === 0 ? (
        <div className="mx-4 mt-3 p-5 bg-white dark:bg-night-card border border-line dark:border-night-line rounded-2xl text-center text-xs text-ink-soft dark:text-mist-soft">
          No status updates yet. Updates from your contacts and people you chat with appear here and disappear after 24 hours.
        </div>
      ) : (
        <>
          {unseen.length > 0 && (
            <>
              <h2 className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{t('recentUpdates')}</h2>
              {unseen.map((g) => row(g, unseen))}
            </>
          )}
          {seen.length > 0 && (
            <>
              <h2 className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Viewed updates</h2>
              {seen.map((g) => row(g, seen))}
            </>
          )}
        </>
      )}

      {viewer && <StatusViewer groups={viewer.groups} initialIndex={viewer.index} onClose={() => setViewer(null)} />}
      {composer && <StatusComposer initialMode={composer} onClose={() => setComposer(null)} />}
    </div>
  );
};
