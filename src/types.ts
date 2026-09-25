export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  country?: string;
  avatar?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
  role?: 'user' | 'admin' | 'ceo';
  blockedUsers?: string[]; // IDs of blocked users
}

export type MessageType = 'text' | 'voice' | 'image' | 'video' | 'file' | 'location' | 'contact' | 'system' | 'call';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string; // Bunny.net storage URL
  mediaDirectUrl?: string;
  mediaSize?: number;
  mediaDuration?: number; // for audio/video in seconds
  mimeType?: string;
  location?: { lat: number; lng: number; address?: string };
  contactCard?: { name: string; phone: string };
  timestamp: number;
  timeFormatted: string;
  status: 'sent' | 'delivered' | 'read';
  mine: boolean;
  reactions?: Record<string, string>; // userId -> emoji
}

export interface ChatSummary {
  id: string;
  name: string;
  isGroup: boolean;
  participants: string[];
  avatar?: string;
  avatarColor: string;
  lastMessage?: string;
  lastMessageType?: MessageType;
  lastMessageTime: string;
  lastMessageTimestamp: number;
  unreadCount: number;
  mine: boolean;
  online?: boolean;
  about?: string;
  country?: string;
}

export interface StatusItem {
  id: string;
  type: 'text' | 'image' | 'video';
  text?: string;
  mediaUrl?: string;
  bg: string;
  timestamp: number;
  timeFormatted: string;
  views: number;
  starred?: boolean;
  sponsored?: boolean;
  sponsor?: string;
  cta?: string;
}

export interface StatusContact {
  id: string;
  name: string;
  avatarColor: string;
  items: StatusItem[];
  seen?: boolean;
}

export interface CallRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  avatarColor: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: number;
  timeFormatted: string;
  durationSeconds: number;
  recordingUrl?: string; // Stored in Bunny.net
}

export interface WalletTransaction {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'credit' | 'debit';
  timestamp: number;
  timeFormatted: string;
  category: 'transfer' | 'deposit' | 'payment' | 'reward';
}

export interface BunnyUploadResponse {
  success: boolean;
  storage: string;
  storageZone: string;
  storagePath: string;
  url: string;
  directBunnyUrl?: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

// 1. Discover Feed Types
export interface DiscoverPost {
  id: string;
  uid: string;
  authorName: string;
  authorAvatar?: string;
  authorColor: string;
  country: string;
  countryCode: string;
  mediaUrl: string; // Stored in Bunny.net
  mediaType: 'image' | 'video';
  caption: string;
  commentCount: number;
  viewCount: number;
  starCount: number;
  starred?: boolean;
  isFollowing?: boolean;
  createdAt: number;
  timeFormatted: string;
}

export interface DiscoverComment {
  id: string;
  postId: string;
  uid: string;
  authorName: string;
  authorAvatar?: string;
  authorColor?: string;
  text: string;
  createdAt: number;
  timeFormatted: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatarColor: string;
  fromCountry?: string;
  toUid: string;
  toName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  timeFormatted: string;
}

// 2. Wallet Applicant pre-registration
export type DocType = 'id' | 'passport' | 'drivers_licence' | 'asylum_doc';

export interface WalletApplicant {
  id: string;
  uid: string;
  name: string;
  email?: string;
  phone: string;
  docType: DocType;
  docNumberMasked: string;
  termsAccepted: boolean;
  status: 'pre-registered';
  appliedAt: number;
}

// 3. Bug Report
export interface BugReport {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  description: string;
  screen: string;
  appVersion: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: number;
  timeFormatted: string;
}

// 4. Admin & CEO Dashboard
export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  joinDate: string;
  role: 'user' | 'admin' | 'ceo';
  walletRegistered: boolean;
}

export interface AdRevenueBreakdown {
  monthly: Array<{
    month: string;
    year: number;
    impressions: number;
    clicks: number;
    revenueZAR: number;
  }>;
  yearly: Array<{
    year: number;
    impressions: number;
    clicks: number;
    revenueZAR: number;
  }>;
}

export interface HealthCheckResult {
  auth: { status: 'healthy' | 'degraded' | 'failing'; message: string };
  firestore: { status: 'healthy' | 'degraded' | 'failing'; message: string };
  server: { status: 'healthy' | 'degraded' | 'failing'; message: string };
  bunny: { status: 'healthy' | 'degraded' | 'failing'; message: string };
  timestamp: string;
}
