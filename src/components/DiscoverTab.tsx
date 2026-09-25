import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Star,
  MessageCircle,
  Share2,
  UserPlus,
  Check,
  X,
  Send,
  Loader2,
  Image as ImageIcon,
  Video,
  MapPin,
  Bell,
  Heart,
} from 'lucide-react';
import { DiscoverPost, DiscoverComment, FriendRequest, UserProfile } from '../types';
import { uploadToBunny } from '../services/bunnyStorage';

interface DiscoverTabProps {
  currentUser: UserProfile;
  onOpenProfile: (user: {
    id: string;
    name: string;
    avatar?: string;
    avatarColor?: string;
    country?: string;
  }) => void;
  onFriendRequestAccepted: (friend: { id: string; name: string; avatarColor: string }) => void;
}

export const DiscoverTab: React.FC<DiscoverTabProps> = ({
  currentUser,
  onOpenProfile,
  onFriendRequestAccepted,
}) => {
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<DiscoverPost | null>(null);
  const [comments, setComments] = useState<DiscoverComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  // Friend requests drawer & tracking
  const [showNotifications, setShowNotifications] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<Record<string, boolean>>({});
  const [followedUsers, setFollowedUsers] = useState<Record<string, boolean>>({});

  // Post composer state
  const [postCaption, setPostCaption] = useState('');
  const [postCountry, setPostCountry] = useState('South Africa');
  const [postCountryCode, setPostCountryCode] = useState('🇿🇦');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Discover Posts
  const fetchPosts = async () => {
    try {
      const res = await fetch(`/api/discover/posts?uid=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.warn('Error fetching posts:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Friend Requests
  const fetchFriendRequests = async () => {
    try {
      const res = await fetch('/api/friend-requests?toUid=current_user');
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data.requests || []);
      }
    } catch (e) {
      console.warn('Error fetching friend requests:', e);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchFriendRequests();
  }, [currentUser.id]);

  // Handle Star (view + like mechanic)
  const handleToggleStar = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const wasStarred = p.starred;
          return {
            ...p,
            starred: !wasStarred,
            starCount: wasStarred ? Math.max(0, p.starCount - 1) : p.starCount + 1,
            viewCount: p.viewCount + 1,
          };
        }
        return p;
      })
    );

    if (activePost && activePost.id === postId) {
      setActivePost((prev) =>
        prev
          ? {
              ...prev,
              starred: !prev.starred,
              starCount: prev.starred ? Math.max(0, prev.starCount - 1) : prev.starCount + 1,
              viewCount: prev.viewCount + 1,
            }
          : null
      );
    }

    try {
      await fetch(`/api/discover/star/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.id }),
      });
    } catch (err) {
      console.warn('Star sync error:', err);
    }
  };

  // Open Full Screen Post Modal & load comments
  const handleOpenPost = async (post: DiscoverPost) => {
    setActivePost(post);
    setLoadingComments(true);
    // Register view count
    handleToggleStar(post.id);

    try {
      const res = await fetch(`/api/discover/comments/${post.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (e) {
      console.warn('Comments error:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  // Send a comment
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activePost) return;

    const payload = {
      uid: currentUser.id,
      authorName: currentUser.name,
      authorColor: '#3B6BFA',
      text: commentText.trim(),
    };

    // Optimistic update
    const tempComment: DiscoverComment = {
      id: `c_${Date.now()}`,
      postId: activePost.id,
      uid: currentUser.id,
      authorName: currentUser.name,
      authorColor: '#3B6BFA',
      text: commentText.trim(),
      createdAt: Date.now(),
      timeFormatted: 'Just now',
    };
    setComments((prev) => [...prev, tempComment]);
    setCommentText('');

    // Update commentCount on post
    setPosts((prev) =>
      prev.map((p) => (p.id === activePost.id ? { ...p, commentCount: p.commentCount + 1 } : p))
    );

    try {
      await fetch(`/api/discover/comments/${activePost.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Comment post error:', err);
    }
  };

  // Follow author
  const handleToggleFollow = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowedUsers((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  // Send Friend Request
  const handleSendFriendRequest = async (post: DiscoverPost, e: React.MouseEvent) => {
    e.stopPropagation();
    setSentRequests((prev) => ({ ...prev, [post.uid]: true }));

    try {
      await fetch('/api/friend-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUid: currentUser.id,
          fromName: currentUser.name,
          fromAvatarColor: '#3B6BFA',
          fromCountry: currentUser.country || 'South Africa',
          toUid: post.uid,
          toName: post.authorName,
        }),
      });
    } catch (e) {
      console.warn('Friend request error:', e);
    }
  };

  // Accept Friend Request -> create 1-on-1 chat in Chats tab!
  const handleAcceptRequest = async (req: FriendRequest) => {
    try {
      await fetch(`/api/friend-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });

      setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));

      // Trigger 1-on-1 chat creation
      onFriendRequestAccepted({
        id: req.fromUid,
        name: req.fromName,
        avatarColor: req.fromAvatarColor || '#10B981',
      });
    } catch (e) {
      console.warn('Accept request error:', e);
    }
  };

  // Handle media selection for post
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  // Submit new post to Discover
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || !postCaption.trim()) return;

    setIsUploading(true);
    try {
      const isVid = mediaFile.type.startsWith('video');
      const folder = isVid ? 'videos' : 'photos';

      // Upload media to Bunny.net storage zone
      const uploadRes = await uploadToBunny(mediaFile, folder);

      const postData = {
        uid: currentUser.id,
        authorName: currentUser.name,
        authorColor: '#3B6BFA',
        country: postCountry,
        countryCode: postCountryCode,
        mediaUrl: uploadRes.url,
        mediaType: isVid ? 'video' : 'image',
        caption: postCaption.trim(),
      };

      const res = await fetch('/api/discover/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post, ...prev]);
        setShowComposer(false);
        setPostCaption('');
        setMediaFile(null);
        setMediaPreview(null);
      }
    } catch (err) {
      console.error('Create post error:', err);
      alert('Failed to upload post to Bunny.net');
    } finally {
      setIsUploading(false);
    }
  };

  const pendingRequestsCount = friendRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="pb-24 min-h-screen">
      {/* Discover Sub-header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#131B3E]/95 backdrop-blur-md px-4 py-3 border-b border-[#E4E8F7] dark:border-[#242D57] flex items-center justify-between shadow-2xs">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#3B6BFA]" />
            <h1 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">
              Discover
            </h1>
            <span className="text-[10px] font-bold bg-[#3B6BFA]/10 text-[#3B6BFA] px-2 py-0.5 rounded-full">
              For You
            </span>
          </div>
          <p className="text-[11px] text-[#5A6182] dark:text-[#AEB4DA]">
            Public posts from Blue Chats users worldwide
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications button for friend requests */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 rounded-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] flex items-center justify-center text-[#5A6182] dark:text-[#AEB4DA] hover:text-[#3B6BFA] transition-colors cursor-pointer"
            title="Friend Requests"
          >
            <Bell className="w-4 h-4" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Create Post Button */}
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-1.5 bg-[#3B6BFA] hover:bg-[#2453D6] text-white text-xs font-bold px-3 py-2 rounded-full shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Friend Requests Drawer */}
      {showNotifications && (
        <div className="mx-4 mt-3 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-2xl p-4 shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF] flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#3B6BFA]" />
              <span>Friend Requests ({friendRequests.length})</span>
            </h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-[#9AA1C4] hover:text-[#0E1430] p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {friendRequests.length === 0 ? (
            <p className="text-xs text-[#9AA1C4] text-center py-3">No pending friend requests</p>
          ) : (
            <div className="space-y-2.5">
              {friendRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7]/70 dark:border-[#242D57]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                      style={{ backgroundColor: req.fromAvatarColor }}
                    >
                      {req.fromName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF] truncate">
                        {req.fromName}
                      </p>
                      <p className="text-[10px] text-[#5A6182] dark:text-[#AEB4DA]">
                        {req.fromCountry || 'Global'} · {req.timeFormatted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="px-3 py-1 bg-[#2FBE8F] hover:bg-[#259B74] text-white text-[11px] font-bold rounded-lg shadow-xs cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        setFriendRequests((prev) => prev.filter((r) => r.id !== req.id))
                      }
                      className="p-1 text-[#9AA1C4] hover:text-red-500 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed Content */}
      <div className="p-4 space-y-5">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-[#3B6BFA] animate-spin mx-auto" />
            <p className="text-xs text-[#5A6182]">Loading global Discover posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-[#3B6BFA]/10 text-[#3B6BFA] flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF]">
              Be the first to post on Discover!
            </h3>
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] max-w-xs mx-auto">
              Share a photo or short video to connect with Blue Chats users across South Africa and the globe.
            </p>
            <button
              onClick={() => setShowComposer(true)}
              className="mt-3 px-5 py-2.5 rounded-full bg-[#3B6BFA] text-white font-bold text-xs shadow-md"
            >
              Create Post
            </button>
          </div>
        ) : (
          posts.map((post) => {
            const isFollowed = followedUsers[post.uid];
            const isRequested = sentRequests[post.uid];

            return (
              <div
                key={post.id}
                onClick={() => handleOpenPost(post)}
                className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Post Header */}
                <div className="p-3.5 flex items-center justify-between">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile({
                        id: post.uid,
                        name: post.authorName,
                        avatar: post.authorAvatar,
                        avatarColor: post.authorColor,
                        country: post.country,
                      });
                    }}
                    className="flex items-center gap-2.5 cursor-pointer hover:opacity-85"
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-xs shadow-xs"
                      style={{ backgroundColor: post.authorColor }}
                    >
                      {post.authorName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF]">
                          {post.authorName}
                        </span>
                        <span className="text-xs">{post.countryCode}</span>
                      </div>
                      <span className="text-[10px] text-[#9AA1C4]">
                        {post.country} · {post.timeFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Follow & Friend Request buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleToggleFollow(post.uid, e)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        isFollowed
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                          : 'bg-[#3B6BFA]/10 text-[#3B6BFA] hover:bg-[#3B6BFA] hover:text-white'
                      }`}
                    >
                      {isFollowed ? 'Following' : 'Follow'}
                    </button>

                    <button
                      onClick={(e) => handleSendFriendRequest(post, e)}
                      disabled={isRequested}
                      title="Send friend request"
                      className={`p-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        isRequested
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-black/5 dark:bg-white/10 hover:bg-[#3B6BFA] hover:text-white text-[#5A6182] dark:text-[#AEB4DA]'
                      }`}
                    >
                      {isRequested ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Media Item */}
                <div className="relative bg-black w-full overflow-hidden max-h-[420px] flex items-center justify-center">
                  {post.mediaType === 'video' ? (
                    <video
                      src={post.mediaUrl}
                      controls
                      className="w-full max-h-[420px] object-contain"
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.caption}
                      className="w-full max-h-[420px] object-cover hover:scale-[1.01] transition-transform duration-300"
                    />
                  )}
                  <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-0.5 rounded-full pointer-events-none">
                    🐰 Bunny CDN
                  </span>
                </div>

                {/* Post Footer & Actions */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Star (view + like mechanic) */}
                      <button
                        onClick={(e) => handleToggleStar(post.id, e)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-125 cursor-pointer ${
                          post.starred ? 'text-amber-500' : 'text-[#5A6182] dark:text-[#AEB4DA]'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${post.starred ? 'fill-amber-500' : ''}`} />
                        <span>{post.starCount}</span>
                      </button>

                      {/* Comments */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A6182] dark:text-[#AEB4DA]">
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.commentCount}</span>
                      </div>
                    </div>

                    <span className="text-[10px] text-[#9AA1C4]">
                      {post.viewCount} views
                    </span>
                  </div>

                  {/* Caption */}
                  <p className="text-xs text-[#0E1430] dark:text-[#EEF1FF] leading-relaxed">
                    <span className="font-bold mr-1.5">{post.authorName}</span>
                    {post.caption}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FULLSCREEN POST & REALTIME COMMENTS MODAL */}
      {activePost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col max-w-[480px] mx-auto animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="p-3 bg-black/60 text-white flex items-center justify-between flex-shrink-0 z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActivePost(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs"
                style={{ backgroundColor: activePost.authorColor }}
              >
                {activePost.authorName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{activePost.authorName}</p>
                <p className="text-[10px] text-white/70">{activePost.country} · {activePost.timeFormatted}</p>
              </div>
            </div>

            <button
              onClick={() => handleToggleStar(activePost.id)}
              className={`p-2 rounded-full cursor-pointer ${
                activePost.starred ? 'text-amber-400' : 'text-white'
              }`}
            >
              <Star className={`w-5 h-5 ${activePost.starred ? 'fill-amber-400' : ''}`} />
            </button>
          </div>

          {/* Media Full Display */}
          <div className="max-h-[38vh] bg-black flex items-center justify-center flex-shrink-0">
            {activePost.mediaType === 'video' ? (
              <video src={activePost.mediaUrl} controls autoPlay className="max-h-[38vh] w-full object-contain" />
            ) : (
              <img src={activePost.mediaUrl} alt={activePost.caption} className="max-h-[38vh] w-full object-contain" />
            )}
          </div>

          {/* Caption banner */}
          <div className="px-4 py-2.5 bg-[#0B1330] text-white text-xs flex-shrink-0 border-b border-white/10">
            <p className="leading-relaxed">
              <strong className="text-[#4DD8E8] mr-1">{activePost.authorName}</strong>
              {activePost.caption}
            </p>
          </div>

          {/* Comments Thread (Realtime) */}
          <div className="flex-1 bg-white dark:bg-[#131B3E] overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] pb-1 border-b border-[#E4E8F7] dark:border-[#242D57]">
              <span>Comments ({comments.length})</span>
              <span className="text-[10px] font-normal text-emerald-500">Live thread</span>
            </div>

            {loadingComments ? (
              <div className="py-8 text-center">
                <Loader2 className="w-5 h-5 text-[#3B6BFA] animate-spin mx-auto" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-[#9AA1C4] text-center py-6">
                No comments yet. Say something friendly!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 text-xs">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-white text-[10px] flex-shrink-0"
                    style={{ backgroundColor: c.authorColor || '#3B6BFA' }}
                  >
                    {c.authorName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-[#F4F6FC] dark:bg-[#0B1130] p-2.5 rounded-2xl border border-[#E4E8F7]/60 dark:border-[#242D57]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-[#0E1430] dark:text-[#EEF1FF]">
                        {c.authorName}
                      </span>
                      <span className="text-[9px] text-[#9AA1C4]">{c.timeFormatted}</span>
                    </div>
                    <p className="text-[#5A6182] dark:text-[#AEB4DA] leading-relaxed break-words">
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Composer Input */}
          <form
            onSubmit={handleSendComment}
            className="p-3 bg-white dark:bg-[#131B3E] border-t border-[#E4E8F7] dark:border-[#242D57] flex items-center gap-2 flex-shrink-0"
          >
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-full px-4 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-40 text-white flex items-center justify-center shadow-md cursor-pointer transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* POST COMPOSER MODAL (Upload to Bunny.net) */}
      {showComposer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E8F7] dark:border-[#242D57]">
              <h2 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3B6BFA]" />
                <span>Post to Discover Feed</span>
              </h2>
              <button
                onClick={() => setShowComposer(false)}
                className="text-[#9AA1C4] hover:text-[#0E1430] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4 pt-4 overflow-y-auto">
              {/* Media Picker */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />

              {mediaPreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-black max-h-56 flex items-center justify-center">
                  {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview} controls className="max-h-56 w-full object-contain" />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="max-h-56 w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFile(null);
                      setMediaPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#E4E8F7] dark:border-[#242D57] rounded-2xl p-6 text-center hover:border-[#3B6BFA] cursor-pointer transition-colors space-y-2 bg-[#F4F6FC]/50 dark:bg-[#0B1130]/50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#3B6BFA]/10 text-[#3B6BFA] flex items-center justify-center mx-auto">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF]">
                      Select photo or video
                    </p>
                    <p className="text-[10px] text-[#9AA1C4]">
                      Stored on Bunny.net Edge Zone
                    </p>
                  </div>
                </div>
              )}

              {/* Caption */}
              <div>
                <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1">
                  Caption
                </label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  rows={3}
                  placeholder="Share a thought, location, or story..."
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-2xl p-3 text-xs text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1">
                  Country
                </label>
                <select
                  value={`${postCountryCode}|${postCountry}`}
                  onChange={(e) => {
                    const [code, name] = e.target.value.split('|');
                    setPostCountryCode(code);
                    setPostCountry(name);
                  }}
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs font-medium text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
                >
                  <option value="🇿🇦|South Africa">🇿🇦 South Africa</option>
                  <option value="🇿🇼|Zimbabwe">🇿🇼 Zimbabwe</option>
                  <option value="🇲🇿|Mozambique">🇲🇿 Mozambique</option>
                  <option value="🇧🇼|Botswana">🇧🇼 Botswana</option>
                  <option value="🇳🇬|Nigeria">🇳🇬 Nigeria</option>
                  <option value="🇰🇪|Kenya">🇰🇪 Kenya</option>
                  <option value="🇬🇭|Ghana">🇬🇭 Ghana</option>
                  <option value="🇬🇧|United Kingdom">🇬🇧 United Kingdom</option>
                  <option value="🇺🇸|United States">🇺🇸 United States</option>
                </select>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E4E8F7] dark:border-[#242D57] text-[#5A6182] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!mediaFile || !postCaption.trim() || isUploading}
                  className="px-6 py-2.5 rounded-xl bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to Bunny.net...</span>
                    </>
                  ) : (
                    <span>Publish Post</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
