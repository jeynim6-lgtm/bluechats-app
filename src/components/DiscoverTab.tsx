import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Star, MessageCircle, UserPlus, Check, X, Send, Image as ImageIcon, Bell, Trash2, Eye } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import {
  subscribeFeed,
  subscribeMyStars,
  subscribeFollowing,
  subscribeOutgoingRequests,
  subscribeComments,
  setStar,
  setFollowing,
  sendFriendRequest,
  respondToFriendRequest,
  createPost,
  deletePost,
  addComment,
  deleteComment,
  registerView,
} from '../services/discover';
import { uploadMedia, compressImage } from '../lib/media';
import { COUNTRIES } from '../lib/phone';
import { formatRelative } from '../lib/format';
import { Avatar, Sheet, Spinner, ErrorBanner, toast } from './ui';
import type { DiscoverComment, DiscoverPost, FriendRequest } from '../types';
import type { ProfileTarget } from './ContactProfileModal';

interface DiscoverTabProps {
  onOpenProfile: (target: ProfileTarget) => void;
}

// ---------- composer ----------
const PostComposer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const me = useMe();
  const defaultCountry = COUNTRIES.find((c) => c.name === me.country) || COUNTRIES[0];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [countryIso, setCountryIso] = useState(defaultCountry.iso);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !caption.trim()) return;
    setError('');
    setProgress(0);
    try {
      const isVideo = file.type.startsWith('video/');
      const body = isVideo ? file : await compressImage(file);
      const res = await uploadMedia(body, 'discover', { onProgress: setProgress });
      const country = COUNTRIES.find((c) => c.iso === countryIso)!;
      await createPost(me, {
        caption,
        country: country.name,
        countryCode: country.flag,
        mediaUrl: res.url,
        mediaPath: res.path,
        mediaType: isVideo ? 'video' : 'image',
      });
      toast('Posted to Discover');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Sheet
      title={
        <>
          <Sparkles className="w-4 h-4 text-brand" /> Post to Discover
        </>
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <input
          type="file"
          ref={fileRef}
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setPreview(URL.createObjectURL(f));
          }}
        />
        {preview && file ? (
          <div className="relative rounded-2xl overflow-hidden bg-black max-h-64 flex items-center justify-center">
            {file.type.startsWith('video/') ? (
              <video src={preview} controls className="max-h-64 w-full object-contain" />
            ) : (
              <img src={preview} alt="Preview" className="max-h-64 w-full object-contain" />
            )}
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              aria-label="Remove media"
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-line dark:border-night-line rounded-2xl p-6 text-center hover:border-brand cursor-pointer space-y-2 bg-paper/50 dark:bg-night/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold">Select a photo or video</p>
            <p className="text-[10px] text-ink-faint">Up to 100 MB · hosted on Bunny.net CDN</p>
          </button>
        )}
        <div>
          <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={2200}
            placeholder="Share a thought, place or story…"
            className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-2xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-ink-soft dark:text-mist-soft uppercase tracking-wider mb-1">Country</label>
          <select
            value={countryIso}
            onChange={(e) => setCountryIso(e.target.value)}
            className="w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!file || !caption.trim() || progress !== null}
          className="w-full py-3 rounded-full bg-brand hover:bg-brand-strong disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
        >
          {progress !== null && <Spinner className="w-4 h-4 text-white" />}
          {progress !== null ? `Uploading ${progress}%…` : 'Publish post'}
        </button>
      </form>
    </Sheet>
  );
};

// ---------- post detail with live comments ----------
const PostDetail: React.FC<{
  post: DiscoverPost;
  starred: boolean;
  onStar: () => void;
  onClose: () => void;
  onOpenProfile: (t: ProfileTarget) => void;
}> = ({ post, starred, onStar, onClose, onOpenProfile }) => {
  const me = useMe();
  const { blocked } = useAppData();
  const [comments, setComments] = useState<DiscoverComment[] | null>(null);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void registerView(post.id);
    return subscribeComments(post.id, setComments);
  }, [post.id]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [comments?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      await addComment(post.id, me, value);
    } catch (err) {
      toast((err as Error).message);
      setText(value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col max-w-[480px] mx-auto animate-fade-in">
      <div className="p-3 bg-black/60 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => onOpenProfile({ uid: post.uid, name: post.author.name, avatarColor: post.author.avatarColor, avatarUrl: post.author.avatarUrl })}
            className="flex items-center gap-2 min-w-0 cursor-pointer text-left"
          >
            <Avatar name={post.author.name} color={post.author.avatarColor} url={post.author.avatarUrl} size={32} />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{post.author.name}</p>
              <p className="text-[10px] text-white/70">
                {post.countryCode} {post.country} · {formatRelative(post.createdAt)}
              </p>
            </div>
          </button>
        </div>
        <button onClick={onStar} aria-label={starred ? 'Unstar' : 'Star'} className={`p-2 rounded-full cursor-pointer flex items-center gap-1 ${starred ? 'text-amber-400' : 'text-white'}`}>
          <Star className={`w-5 h-5 ${starred ? 'fill-amber-400' : ''}`} />
          <span className="text-xs font-bold">{post.starCount}</span>
        </button>
      </div>

      <div className="max-h-[40vh] bg-black flex items-center justify-center flex-shrink-0">
        {post.mediaType === 'video' ? (
          <video src={post.mediaUrl} controls autoPlay playsInline className="max-h-[40vh] w-full object-contain" />
        ) : (
          <img src={post.mediaUrl} alt={post.caption} className="max-h-[40vh] w-full object-contain" />
        )}
      </div>

      <div className="px-4 py-2.5 bg-navy-950 text-white text-xs flex-shrink-0 border-b border-white/10">
        <p className="leading-relaxed whitespace-pre-wrap">
          <strong className="text-accent mr-1">{post.author.name}</strong>
          {post.caption}
        </p>
      </div>

      <div className="flex-1 bg-white dark:bg-night-card overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-ink-soft dark:text-mist-soft pb-1 border-b border-line dark:border-night-line">
          <span>Comments ({comments?.length ?? post.commentCount})</span>
          <span className="text-[10px] font-normal text-success">● Live</span>
        </div>
        {comments === null ? (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-ink-faint text-center py-6">No comments yet. Say something friendly!</p>
        ) : (
          comments
            .filter((c) => !blocked.has(c.uid))
            .map((c) => (
              <div key={c.id} className="flex gap-2.5 text-xs group">
                <Avatar name={c.author?.name || '?'} color={c.author?.avatarColor} url={c.author?.avatarUrl} size={28} />
                <div className="flex-1 bg-paper dark:bg-night p-2.5 rounded-2xl">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold">{c.author?.name}</span>
                    <span className="text-[9px] text-ink-faint">{formatRelative(c.createdAt)}</span>
                  </div>
                  <p className="text-ink-soft dark:text-mist-soft leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
                </div>
                {(c.uid === me.uid || post.uid === me.uid) && (
                  <button
                    onClick={() => deleteComment(post.id, c.id).catch((err) => toast(err.message))}
                    aria-label="Delete comment"
                    className="self-center opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="p-3 bg-white dark:bg-night-card border-t border-line dark:border-night-line flex items-center gap-2 flex-shrink-0 pb-safe">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          aria-label="Comment"
          className="flex-1 bg-paper dark:bg-night border border-line dark:border-night-line rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send comment" className="w-9 h-9 rounded-full bg-brand disabled:opacity-40 text-white flex items-center justify-center cursor-pointer">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

// ---------- tab ----------
export const DiscoverTab: React.FC<DiscoverTabProps> = ({ onOpenProfile }) => {
  const me = useMe();
  const { friendRequests, blocked, chats, openDirectChat } = useAppData();
  const [posts, setPosts] = useState<DiscoverPost[] | null>(null);
  const [feedError, setFeedError] = useState('');
  const [stars, setStars] = useState<Set<string>>(new Set());
  const [following, setFollowingSet] = useState<Set<string>>(new Set());
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [view, setView] = useState<'forYou' | 'following'>('forYou');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => subscribeFeed(setPosts, (err) => setFeedError(err.message)), []);
  useEffect(() => subscribeMyStars(me.uid, setStars), [me.uid]);
  useEffect(() => subscribeFollowing(me.uid, setFollowingSet), [me.uid]);
  useEffect(() => subscribeOutgoingRequests(me.uid, setOutgoing), [me.uid]);

  const chatPartners = useMemo(() => new Set(chats.filter((c) => c.type === 'direct').flatMap((c) => c.participants)), [chats]);
  const requestedIds = useMemo(() => new Set(outgoing.filter((r) => r.status !== 'declined').map((r) => r.toUid)), [outgoing]);

  const visible = (posts || []).filter((p) => !blocked.has(p.uid) && (view === 'forYou' || following.has(p.uid)));
  const activePost = posts?.find((p) => p.id === activeId) || null;

  const toggleStar = async (post: DiscoverPost) => {
    const starred = stars.has(post.id);
    try {
      await setStar(post.id, me.uid, !starred);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const toggleFollow = (uid: string) => setFollowing(me.uid, uid, !following.has(uid)).catch((err) => toast(err.message));

  const requestFriend = (post: DiscoverPost) =>
    sendFriendRequest(me, { uid: post.uid, ...post.author })
      .then(() => toast(`Friend request sent to ${post.author.name}`))
      .catch((err) => toast(err.message));

  const respond = async (req: FriendRequest, accept: boolean) => {
    try {
      await respondToFriendRequest(req.id, accept);
      if (accept) {
        await openDirectChat(req.fromUid);
        setShowRequests(false);
      }
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const removePost = async (post: DiscoverPost) => {
    if (!window.confirm('Delete this post?')) return;
    await deletePost(post).catch((err) => toast(err.message));
  };

  const tab = (active: boolean) =>
    `px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${active ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`;

  return (
    <div className="pb-4 min-h-screen">
      <div className="sticky top-[68px] z-20 bg-white/95 dark:bg-night-card/95 backdrop-blur-md px-4 py-3 border-b border-line dark:border-night-line flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand" />
          <h1 className="font-bold text-base mr-1">Discover</h1>
          <button onClick={() => setView('forYou')} className={tab(view === 'forYou')}>
            For you
          </button>
          <button onClick={() => setView('following')} className={tab(view === 'following')}>
            Following
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRequests(true)}
            aria-label={`Friend requests (${friendRequests.length})`}
            className="relative w-9 h-9 rounded-full bg-paper dark:bg-night border border-line dark:border-night-line flex items-center justify-center text-ink-soft dark:text-mist-soft hover:text-brand cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {friendRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-1 bg-brand hover:bg-brand-strong text-white text-xs font-bold px-3 py-2 rounded-full shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Post
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {feedError && <ErrorBanner message={`Could not load Discover: ${feedError}`} />}
        {posts === null && !feedError ? (
          <div className="py-20 flex justify-center">
            <Spinner className="w-7 h-7" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-sm">{view === 'following' ? 'Nothing from people you follow yet' : 'Be the first to post on Discover!'}</h3>
            <p className="text-xs text-ink-soft dark:text-mist-soft max-w-xs mx-auto">
              {view === 'following' ? 'Follow creators from the For You feed to see their posts here.' : 'Share a photo or short video with the Blue Chats community.'}
            </p>
            {view === 'forYou' && (
              <button onClick={() => setShowComposer(true)} className="px-5 py-2.5 rounded-full bg-brand text-white font-bold text-xs shadow-md cursor-pointer">
                Create post
              </button>
            )}
          </div>
        ) : (
          visible.map((post) => {
            const mine = post.uid === me.uid;
            const starred = stars.has(post.id);
            const canRequest = !mine && !chatPartners.has(post.uid) && !requestedIds.has(post.uid);
            return (
              <article key={post.id} className="bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl overflow-hidden shadow-xs">
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenProfile({ uid: post.uid, name: post.author.name, avatarColor: post.author.avatarColor, avatarUrl: post.author.avatarUrl })}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <Avatar name={post.author.name} color={post.author.avatarColor} url={post.author.avatarUrl} size={40} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">{post.author.name}</span>
                        <span className="text-xs">{post.countryCode}</span>
                      </div>
                      <span className="text-[10px] text-ink-faint">
                        {post.country} · {formatRelative(post.createdAt)}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {mine ? (
                      <button onClick={() => removePost(post)} aria-label="Delete post" className="p-1.5 rounded-full text-ink-faint hover:text-red-500 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleFollow(post.uid)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            following.has(post.uid) ? 'bg-line dark:bg-night-line text-ink-soft dark:text-mist-soft' : 'bg-brand/10 text-brand hover:bg-brand hover:text-white'
                          }`}
                        >
                          {following.has(post.uid) ? 'Following' : 'Follow'}
                        </button>
                        {!chatPartners.has(post.uid) && (
                          <button
                            onClick={() => canRequest && requestFriend(post)}
                            disabled={!canRequest}
                            title={canRequest ? 'Send friend request' : 'Friend request sent'}
                            aria-label={canRequest ? 'Send friend request' : 'Friend request sent'}
                            className={`p-1.5 rounded-full cursor-pointer ${canRequest ? 'bg-black/5 dark:bg-white/10 hover:bg-brand hover:text-white' : 'bg-emerald-500/15 text-emerald-600'}`}
                          >
                            {canRequest ? <UserPlus className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <button onClick={() => setActiveId(post.id)} className="relative bg-black w-full max-h-[440px] flex items-center justify-center overflow-hidden cursor-pointer">
                  {post.mediaType === 'video' ? (
                    <video src={post.mediaUrl} muted playsInline preload="metadata" className="w-full max-h-[440px] object-contain" />
                  ) : (
                    <img src={post.mediaUrl} alt={post.caption} loading="lazy" className="w-full max-h-[440px] object-cover" />
                  )}
                  {post.mediaType === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center text-white text-2xl">▶</span>
                    </span>
                  )}
                </button>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleStar(post)}
                        aria-label={starred ? 'Unstar' : 'Star'}
                        className={`flex items-center gap-1.5 text-xs font-bold active:scale-125 transition-transform cursor-pointer ${starred ? 'text-amber-500' : 'text-ink-soft dark:text-mist-soft'}`}
                      >
                        <Star className={`w-4 h-4 ${starred ? 'fill-amber-500' : ''}`} /> {post.starCount}
                      </button>
                      <button onClick={() => setActiveId(post.id)} className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft dark:text-mist-soft cursor-pointer">
                        <MessageCircle className="w-4 h-4" /> {post.commentCount}
                      </button>
                    </div>
                    <span className="text-[10px] text-ink-faint flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {post.viewCount}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    <span className="font-bold mr-1.5">{post.author.name}</span>
                    {post.caption}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>

      {showRequests && (
        <Sheet
          title={
            <>
              <UserPlus className="w-4 h-4 text-brand" /> Friend requests ({friendRequests.length})
            </>
          }
          onClose={() => setShowRequests(false)}
        >
          <div className="p-4 space-y-2.5">
            {friendRequests.length === 0 ? (
              <p className="text-xs text-ink-faint text-center py-6">No pending friend requests</p>
            ) : (
              friendRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-2.5 rounded-xl bg-paper dark:bg-night">
                  <button
                    onClick={() => onOpenProfile({ uid: req.fromUid, name: req.from.name, avatarColor: req.from.avatarColor, avatarUrl: req.from.avatarUrl })}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <Avatar name={req.from.name} color={req.from.avatarColor} url={req.from.avatarUrl} size={36} shape="circle" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{req.from.name}</p>
                      <p className="text-[10px] text-ink-soft dark:text-mist-soft">
                        {req.from.country || 'Blue Chats'} · {formatRelative(req.createdAt)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => respond(req, true)} className="px-3 py-1 bg-success hover:opacity-90 text-white text-[11px] font-bold rounded-lg cursor-pointer">
                      Accept
                    </button>
                    <button onClick={() => respond(req, false)} aria-label="Decline" className="p-1 text-ink-faint hover:text-red-500 rounded-lg cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Sheet>
      )}

      {activePost && (
        <PostDetail
          post={activePost}
          starred={stars.has(activePost.id)}
          onStar={() => toggleStar(activePost)}
          onClose={() => setActiveId(null)}
          onOpenProfile={onOpenProfile}
        />
      )}
      {showComposer && <PostComposer onClose={() => setShowComposer(false)} />}
    </div>
  );
};
