/** Public profile — `users/{uid}`. Visible to signed-in users; contains no phone number. */
export interface UserProfile {
  uid: string;
  name: string;
  bio: string;
  avatarUrl?: string | null;
  avatarPath?: string | null;
  avatarColor: string;
  country?: string;
  createdAt?: number;
  lastSeen?: number;
}

/** Private account data — `users/{uid}/private/account`. Owner (and CEO) only. */
export interface PrivateAccount {
  phone: string;
  email?: string;
  blocked: string[];
}

/** Personal address book entry — `users/{uid}/contacts/{id}`. */
export interface Contact {
  id: string;
  uid: string | null; // null when the number is not on Blue Chats yet
  name: string;
  phone: string;
  avatarColor: string;
}

export interface PersonRef {
  uid: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export type MessageType = 'text' | 'voice' | 'image' | 'video' | 'file' | 'location' | 'contact' | 'system';

export interface MediaInfo {
  url: string;
  path?: string | null;
  size?: number | null;
  mime?: string | null;
  name?: string | null;
  duration?: number | null;
}

export interface ReplyRef {
  id: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text?: string | null;
  media?: MediaInfo | null;
  location?: { lat: number; lng: number; accuracy?: number | null } | null;
  contact?: { name: string; phone: string; uid?: string | null } | null;
  replyTo?: ReplyRef | null;
  reactions: Record<string, string>;
  createdAt: number;
  pending: boolean;
  deleted?: boolean;
}

export interface ChatMember {
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  members: Record<string, ChatMember>;
  name?: string;
  avatarColor?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: { text: string; type: MessageType; senderId: string; senderName: string; at: number } | null;
  unread: Record<string, number>;
  readAt: Record<string, number>;
  typing: Record<string, number>;
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed' | 'busy' | 'failed' | 'cancelled';

/** `calls/{id}` — WebRTC signaling document that doubles as call history. */
export interface CallDoc {
  id: string;
  callerId: string;
  calleeId: string;
  participants: string[];
  caller: ChatMember;
  callee: ChatMember;
  type: CallType;
  status: CallStatus;
  offer?: { type: RTCSdpType; sdp: string };
  answer?: { type: RTCSdpType; sdp: string };
  createdAt: number;
  answeredAt?: number | null;
  endedAt?: number | null;
  endedBy?: string | null;
  duration?: number | null;
  recording?: Record<string, boolean>;
  recordings?: Record<string, string>;
}

/** History row as shown in the Calls tab. */
export interface CallRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  type: CallType;
  direction: 'incoming' | 'outgoing' | 'missed';
  status: CallStatus;
  timestamp: number;
  durationSeconds: number;
  recordingUrl?: string;
}

export interface StatusItem {
  id: string;
  authorId: string;
  author: ChatMember;
  type: 'text' | 'image' | 'video';
  text?: string | null;
  mediaUrl?: string | null;
  mediaPath?: string | null;
  bg: string;
  createdAt: number;
  expiresAt: number;
  viewers: string[];
  // sponsored cards injected by the viewer
  sponsored?: boolean;
  sponsorId?: string;
  sponsor?: string;
  cta?: string;
  ctaUrl?: string;
}

export interface StatusGroup {
  authorId: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
  items: StatusItem[];
  seen: boolean;
  isMine: boolean;
}

export interface DiscoverPost {
  id: string;
  uid: string;
  author: ChatMember;
  country: string;
  countryCode: string;
  mediaUrl: string;
  mediaPath?: string | null;
  mediaType: 'image' | 'video';
  caption: string;
  commentCount: number;
  viewCount: number;
  starCount: number;
  createdAt: number;
}

export interface DiscoverComment {
  id: string;
  postId: string;
  uid: string;
  author: ChatMember;
  text: string;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  from: ChatMember & { country?: string };
  to: ChatMember;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export type DocType = 'id' | 'passport' | 'drivers_licence' | 'asylum_doc';

export interface WalletApplicant {
  uid: string;
  name: string;
  email?: string;
  phone: string;
  docType: DocType;
  docNumberMasked: string;
  docHash?: string;
  termsAccepted: boolean;
  status: 'pre-registered';
  appliedAt: number;
}

export interface BugReport {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  description: string;
  screen: string;
  appVersion: string;
  userAgent?: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: number;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetUid: string;
  targetName: string;
  reason: string;
  status: 'open' | 'reviewed';
  createdAt: number;
}

export interface AdminUserRecord {
  uid: string;
  name: string;
  phone?: string;
  country?: string;
  createdAt?: number;
  lastSeen?: number;
}

export interface AdStat {
  id: string;
  adId: string;
  month: string;
  impressions: number;
  clicks: number;
}

type HealthEntry = { status: 'healthy' | 'degraded' | 'failing'; message: string };

export interface HealthCheckResult {
  auth: HealthEntry;
  firestore: HealthEntry;
  server: HealthEntry;
  bunny: HealthEntry;
  webrtc: HealthEntry;
  timestamp: string;
}
