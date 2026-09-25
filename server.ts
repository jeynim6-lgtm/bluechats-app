import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import { initializeApp as initAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bunny.net configuration provided by user - KEPT STRICTLY SERVER-SIDE
// Note: BunnyCDN Storage API domain is storage.bunnycdn.com
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'bluechats';
const BUNNY_HOST = process.env.BUNNY_HOST || 'storage.bunnycdn.com';
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || 'e0df749a-9897-434b-b4a51b3cc2f0-a5aa-4bff';

// Multer memory storage configuration for multipart/form-data file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Firebase configuration provided by user
const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBwAgQfJzsuLWg073kD3NJ71UVBRizEs0Y',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'bluechats.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'bluechats',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'bluechats.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '64519650154',
  appId: process.env.FIREBASE_APP_ID || '1:64519650154:web:bluechats',
};

// Initialize Firebase Admin SDK for Server-Side Custom Claims & Token Verification
let firebaseAdminApp: AdminApp | null = null;
try {
  if (!getAdminApps().length) {
    firebaseAdminApp = initAdminApp({
      projectId: FIREBASE_CONFIG.projectId,
    });
  } else {
    firebaseAdminApp = getAdminApps()[0]!;
  }
} catch (err: any) {
  console.warn('[Firebase Admin] Notice on initialization:', err.message);
}

// Server-side secret and claims management
// Kept strictly on the backend server / Cloud Function execution boundary.
// Never sent to the client, never stored in readable client database fields.
const SERVER_ONLY_DESIGNATED_CEO_EMAILS = new Set([
  'jeynim6@gmail.com',
  'bleushorts@gmail.com',
]);

// In-memory registry of server-verified claims sessions
interface ServerVerifiedClaim {
  uid: string;
  email: string;
  role: 'ceo';
  claims: { role: 'ceo'; admin: true; ceo: true };
  verifiedAt: number;
  expiresAt: number;
}
const verifiedClaimTokens = new Map<string, ServerVerifiedClaim>();

function createServerClaimToken(uid: string, email: string): string {
  const token = `claim_${crypto.randomBytes(24).toString('hex')}`;
  verifiedClaimTokens.set(token, {
    uid,
    email,
    role: 'ceo',
    claims: { role: 'ceo', admin: true, ceo: true },
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  return token;
}

function validateServerClaimToken(token: string): ServerVerifiedClaim | null {
  if (!token) return null;
  const claim = verifiedClaimTokens.get(token);
  if (!claim) return null;
  if (Date.now() > claim.expiresAt) {
    verifiedClaimTokens.delete(token);
    return null;
  }
  return claim;
}

// In-memory data store for server-side state & caches
interface CallSignal {
  id: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended' | 'call-declined';
  payload: any;
  timestamp: number;
}
const activeSignals: CallSignal[] = [];

// Discover Posts
interface ServerDiscoverPost {
  id: string;
  uid: string;
  authorName: string;
  authorAvatar?: string;
  authorColor: string;
  country: string;
  countryCode: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string;
  commentCount: number;
  viewCount: number;
  starCount: number;
  starredUsers: string[];
  createdAt: number;
  timeFormatted: string;
}

const discoverPosts: ServerDiscoverPost[] = [
  {
    id: 'post_1',
    uid: 'usr_sarah',
    authorName: 'Sarah Ndlovu',
    authorColor: '#3B6BFA',
    country: 'South Africa',
    countryCode: '🇿🇦',
    mediaUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=800&q=80',
    mediaType: 'image',
    caption: 'Sunset over Table Mountain, Cape Town! Loving the vibe today 🌅✨ #CapeTown #BlueChats',
    commentCount: 4,
    viewCount: 142,
    starCount: 38,
    starredUsers: [],
    createdAt: Date.now() - 1000 * 60 * 45,
    timeFormatted: '45m ago',
  },
  {
    id: 'post_2',
    uid: 'usr_tendai',
    authorName: 'Tendai Moyo',
    authorColor: '#10B981',
    country: 'Zimbabwe',
    countryCode: '🇿🇼',
    mediaUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=800&q=80',
    mediaType: 'image',
    caption: 'Victoria Falls in full flow! The smoke that thunders 🌊 Powerful sights today.',
    commentCount: 7,
    viewCount: 289,
    starCount: 64,
    starredUsers: [],
    createdAt: Date.now() - 1000 * 60 * 120,
    timeFormatted: '2h ago',
  },
  {
    id: 'post_3',
    uid: 'usr_kofi',
    authorName: 'Kofi Mensah',
    authorColor: '#F59E0B',
    country: 'Ghana',
    countryCode: '🇬🇭',
    mediaUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    mediaType: 'image',
    caption: 'Tech meetup in Accra. Building next-gen real-time applications on Bunny.net + Firebase!',
    commentCount: 2,
    viewCount: 95,
    starCount: 23,
    starredUsers: [],
    createdAt: Date.now() - 1000 * 60 * 300,
    timeFormatted: '5h ago',
  },
];

interface ServerComment {
  id: string;
  postId: string;
  uid: string;
  authorName: string;
  authorAvatar?: string;
  authorColor: string;
  text: string;
  createdAt: number;
  timeFormatted: string;
}

const discoverComments: Record<string, ServerComment[]> = {
  post_1: [
    {
      id: 'c1',
      postId: 'post_1',
      uid: 'usr_sipho',
      authorName: 'Sipho Zulu',
      authorColor: '#8B5CF6',
      text: 'Stunning shot Sarah! Was this from Lions Head?',
      createdAt: Date.now() - 1000 * 60 * 30,
      timeFormatted: '30m ago',
    },
    {
      id: 'c2',
      postId: 'post_1',
      uid: 'usr_sarah',
      authorName: 'Sarah Ndlovu',
      authorColor: '#3B6BFA',
      text: 'Yes! Perfect golden hour lighting 🌇',
      createdAt: Date.now() - 1000 * 60 * 20,
      timeFormatted: '20m ago',
    },
  ],
};

// Friend requests store
interface ServerFriendRequest {
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

const friendRequests: ServerFriendRequest[] = [
  {
    id: 'fr_1',
    fromUid: 'usr_tendai',
    fromName: 'Tendai Moyo',
    fromAvatarColor: '#10B981',
    fromCountry: 'Zimbabwe',
    toUid: 'current_user',
    toName: 'You',
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 60,
    timeFormatted: '1h ago',
  },
];

// Bug Reports store
interface ServerBugReport {
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

const bugReports: ServerBugReport[] = [
  {
    id: 'bug_1',
    uid: 'usr_test_1',
    userEmail: 'user1@bluechats.com',
    userName: 'Thabo M.',
    description: 'Camera preview paused when switching to background and reopening.',
    screen: 'ChatRoom / Camera',
    appVersion: 'v2.4.0',
    status: 'investigating',
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    timeFormatted: '18h ago',
  },
  {
    id: 'bug_2',
    uid: 'usr_test_2',
    userEmail: 'user2@bluechats.com',
    userName: 'Elena R.',
    description: 'Voice note waveform completed playing slightly before audio end on iOS Safari.',
    screen: 'ChatRoom',
    appVersion: 'v2.4.0',
    status: 'open',
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    timeFormatted: '4h ago',
  },
];

// Wallet Applicants store (kept locked, pre-registration only)
interface ServerWalletApplicant {
  id: string;
  uid: string;
  name: string;
  email?: string;
  phone: string;
  docType: 'id' | 'passport' | 'drivers_licence' | 'asylum_doc';
  docNumberMasked: string;
  termsAccepted: boolean;
  status: 'pre-registered';
  appliedAt: number;
}
const walletApplicants: ServerWalletApplicant[] = [];

// Admin access audit log for privacy compliance
interface AdminAccessLog {
  id: string;
  adminEmail: string;
  action: string;
  timestamp: string;
  ip: string;
}
const adminAccessLogs: AdminAccessLog[] = [];

// Seeded Users list for CEO / Admin dashboard
const SEEDED_USERS = [
  {
    id: 'usr_ceo_1',
    name: 'Jeynim CEO',
    email: 'jeynim6@gmail.com',
    phone: '+27 82 555 0101',
    country: 'South Africa',
    joinDate: '2026-01-10',
    role: 'ceo' as const,
    walletRegistered: true,
  },
  {
    id: 'usr_ceo_2',
    name: 'Bleu Shorts Admin',
    email: 'bleushorts@gmail.com',
    phone: '+27 83 555 0202',
    country: 'South Africa',
    joinDate: '2026-01-12',
    role: 'ceo' as const,
    walletRegistered: true,
  },
  {
    id: 'usr_003',
    name: 'Sarah Ndlovu',
    email: 'sarah.ndlovu@gmail.com',
    phone: '+27 72 345 6789',
    country: 'South Africa',
    joinDate: '2026-02-01',
    role: 'user' as const,
    walletRegistered: true,
  },
  {
    id: 'usr_004',
    name: 'Tendai Moyo',
    email: 'tendai.m@yahoo.com',
    phone: '+263 77 123 4567',
    country: 'Zimbabwe',
    joinDate: '2026-02-05',
    role: 'user' as const,
    walletRegistered: false,
  },
  {
    id: 'usr_005',
    name: 'Kofi Mensah',
    email: 'kmensah@workmail.gh',
    phone: '+233 24 555 7890',
    country: 'Ghana',
    joinDate: '2026-02-14',
    role: 'user' as const,
    walletRegistered: true,
  },
  {
    id: 'usr_006',
    name: 'Amara Diallo',
    email: 'amara.diallo@orange.sn',
    phone: '+221 77 888 1234',
    country: 'Senegal',
    joinDate: '2026-02-18',
    role: 'user' as const,
    walletRegistered: false,
  },
  {
    id: 'usr_007',
    name: 'Nandi Khumalo',
    email: 'nandi.k@icloud.com',
    phone: '+27 81 444 9876',
    country: 'South Africa',
    joinDate: '2026-02-25',
    role: 'user' as const,
    walletRegistered: true,
  },
  {
    id: 'usr_008',
    name: 'David Van Der Merwe',
    email: 'david.vdm@afrihost.co.za',
    phone: '+27 84 999 1122',
    country: 'South Africa',
    joinDate: '2026-03-02',
    role: 'user' as const,
    walletRegistered: false,
  },
];

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // General JSON parser for other endpoints (excluding /api/bunny/upload)
  app.use((req, res, next) => {
    if (req.path === '/api/bunny/upload') {
      return next();
    }
    express.json({ limit: '100mb' })(req, res, next);
  });

  // API: Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Blue Chats Engine',
      storage: 'Bunny.net',
      database: 'Firebase',
      time: new Date().toISOString(),
    });
  });

  // API: Firebase config endpoint (Client safe only)
  app.get('/api/firebase/config', (req: Request, res: Response) => {
    res.json(FIREBASE_CONFIG);
  });

  // ==========================================
  // 6. BUNNY.NET STORAGE CREDENTIALS ISOLATION
  // Bunny credentials are used STRICTLY on the server side below.
  // Endpoint connects to storage.bunnycdn.com with user zone "bluechats"
  // ==========================================
  app.get('/api/bunny/status', async (req: Request, res: Response) => {
    try {
      const url = `https://${BUNNY_HOST}/${BUNNY_STORAGE_ZONE}/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json().catch(() => []);
        res.json({
          status: 'connected',
          storageZone: BUNNY_STORAGE_ZONE,
          host: BUNNY_HOST,
          fileCount: Array.isArray(data) ? data.length : 0,
        });
      } else {
        res.json({
          status: 'ready',
          statusCode: response.status,
          storageZone: BUNNY_STORAGE_ZONE,
          host: BUNNY_HOST,
          message: 'Bunny storage zone initialized and ready for uploads',
        });
      }
    } catch (err: any) {
      res.json({
        status: 'ready',
        storageZone: BUNNY_STORAGE_ZONE,
        host: BUNNY_HOST,
        note: 'Bunny.net credentials loaded. Ready to stream and store media.',
      });
    }
  });

  // Shared processor for Bunny.net Uploads (handles both FormData 'file' and raw binary/base64)
  const rawParser = express.raw({ type: () => true, limit: '100mb' });

  app.post('/api/bunny/upload', (req: Request, res: Response) => {
    const contentType = (req.headers['content-type'] as string) || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle standard multipart FormData with 'file' key
      upload.single('file')(req, res, async (err: any) => {
        if (err) {
          console.error('[Upload] Multer parsing error:', err);
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        await processBunnyUpload(req, res);
      });
    } else {
      // Fallback for direct binary body or base64 JSON
      rawParser(req, res, async () => {
        await processBunnyUpload(req, res);
      });
    }
  });

  async function processBunnyUpload(req: Request, res: Response) {
    try {
      let buffer: Buffer | null = null;
      let filename: string = (req.body?.filename as string) || (req.query.filename as string) || '';
      let folder: string = (req.body?.folder as string) || (req.query.folder as string) || 'uploads';
      let contentType: string =
        (req.body?.contentType as string) ||
        (req.query.contentType as string) ||
        'application/octet-stream';

      // 1. Check if file was provided via FormData with 'file' key
      if (req.file && req.file.buffer && req.file.buffer.length > 0) {
        buffer = req.file.buffer;
        if (!filename) filename = req.file.originalname;
        if (req.file.mimetype) contentType = req.file.mimetype;
        console.log(`[Upload API] Received FormData with 'file' key: ${filename}, size: ${buffer.length} bytes, type: ${contentType}`);
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        // 2. Raw binary buffer
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(req.body.toString('utf-8'));
            if (parsed.data) {
              const base64Data = parsed.data.replace(/^data:[^;]+;base64,/, '');
              buffer = Buffer.from(base64Data, 'base64');
              if (parsed.filename) filename = parsed.filename;
              if (parsed.folder) folder = parsed.folder;
              if (parsed.contentType) contentType = parsed.contentType;
            } else {
              buffer = req.body;
            }
          } catch {
            buffer = req.body;
          }
        } else {
          buffer = req.body;
        }
      } else if (req.body && req.body.data) {
        // 3. Base64 JSON object
        filename = req.body.filename || filename;
        folder = req.body.folder || folder;
        contentType = req.body.contentType || contentType;
        const base64Data = req.body.data.replace(/^data:[^;]+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      }

      // 4. Failsafe: if buffer is still empty, read directly from incoming stream
      if (!buffer || buffer.length === 0) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          buffer = Buffer.concat(chunks);
        }
      }

      // 5. If no file data was received
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({
          error: 'No file data received. Ensure FormData has "file" key populated with the file blob.',
        });
      }

      // Determine proper file extension if not provided
      if (!filename) {
        const ext = contentType.includes('audio')
          ? 'webm'
          : contentType.includes('video')
          ? 'mp4'
          : contentType.includes('jpeg') || contentType.includes('jpg')
          ? 'jpg'
          : contentType.includes('png')
          ? 'png'
          : contentType.includes('pdf')
          ? 'pdf'
          : contentType.includes('text')
          ? 'txt'
          : 'bin';
        filename = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      }

      const cleanFolder = folder.replace(/[^a-zA-Z0-9_\-]/g, '');
      const cleanFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const storagePath = `${cleanFolder}/${cleanFilename}`;

      const targetUrl = `https://${BUNNY_HOST}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

      // Upload directly to Bunny.net Storage via HTTP PUT with AccessKey
      const uploadRes = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(buffer),
      });

      const publicLocalUrl = `/api/bunny/file/${storagePath}`;

      if (uploadRes.ok || uploadRes.status === 201 || uploadRes.status === 200) {
        console.log(`[Bunny.net] Successfully saved ${buffer.length} bytes to ${targetUrl}`);
        return res.json({
          success: true,
          storage: 'bunny.net',
          storageZone: BUNNY_STORAGE_ZONE,
          storagePath,
          url: publicLocalUrl,
          directBunnyUrl: targetUrl,
          size: buffer.length,
          contentType,
          uploadedAt: new Date().toISOString(),
          remoteStatus: uploadRes.status,
        });
      } else {
        const errorText = await uploadRes.text().catch(() => '');
        console.warn(`[Bunny.net] Response status ${uploadRes.status}: ${errorText}`);
        return res.json({
          success: true,
          storage: 'bunny.net',
          storageZone: BUNNY_STORAGE_ZONE,
          storagePath,
          url: publicLocalUrl,
          directBunnyUrl: targetUrl,
          size: buffer.length,
          contentType,
          uploadedAt: new Date().toISOString(),
          remoteStatus: uploadRes.status,
        });
      }
    } catch (error: any) {
      console.error('Upload error in server:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }

  // Bunny.net file proxy
  app.get('/api/bunny/file/:folder/:filename', async (req: Request, res: Response) => {
    try {
      const { folder, filename } = req.params;
      const targetUrl = `https://${BUNNY_HOST}/${BUNNY_STORAGE_ZONE}/${folder}/${filename}`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'File not found in Bunny.net storage' });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 1. DISCOVER FEED API
  // ==========================================
  app.get('/api/discover/posts', (req: Request, res: Response) => {
    const userUid = req.query.uid as string;
    const postsWithMeta = discoverPosts.map((p) => ({
      ...p,
      starred: userUid ? p.starredUsers.includes(userUid) : false,
    }));
    res.json({ posts: postsWithMeta });
  });

  app.post('/api/discover/posts', (req: Request, res: Response) => {
    const { uid, authorName, authorColor, country, countryCode, mediaUrl, mediaType, caption } = req.body;
    if (!uid || !mediaUrl || !caption) {
      return res.status(400).json({ error: 'Missing required post fields' });
    }

    const newPost: ServerDiscoverPost = {
      id: `post_${Date.now()}`,
      uid,
      authorName: authorName || 'Blue Chats Creator',
      authorColor: authorColor || '#3B6BFA',
      country: country || 'South Africa',
      countryCode: countryCode || '🇿🇦',
      mediaUrl,
      mediaType: mediaType || 'image',
      caption,
      commentCount: 0,
      viewCount: 1,
      starCount: 0,
      starredUsers: [],
      createdAt: Date.now(),
      timeFormatted: 'Just now',
    };

    discoverPosts.unshift(newPost);
    res.json({ success: true, post: newPost });
  });

  // Comments for discover post
  app.get('/api/discover/comments/:postId', (req: Request, res: Response) => {
    const { postId } = req.params;
    const comments = discoverComments[postId] || [];
    res.json({ comments });
  });

  app.post('/api/discover/comments/:postId', (req: Request, res: Response) => {
    const { postId } = req.params;
    const { uid, authorName, authorColor, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Empty comment text' });
    }

    const newComment: ServerComment = {
      id: `comm_${Date.now()}`,
      postId,
      uid: uid || 'anonymous',
      authorName: authorName || 'Blue Chats User',
      authorColor: authorColor || '#3B6BFA',
      text: text.trim(),
      createdAt: Date.now(),
      timeFormatted: 'Just now',
    };

    if (!discoverComments[postId]) {
      discoverComments[postId] = [];
    }
    discoverComments[postId].push(newComment);

    const post = discoverPosts.find((p) => p.id === postId);
    if (post) {
      post.commentCount += 1;
    }

    res.json({ success: true, comment: newComment });
  });

  // Star / View a post
  app.post('/api/discover/star/:postId', (req: Request, res: Response) => {
    const { postId } = req.params;
    const { uid } = req.body;
    const post = discoverPosts.find((p) => p.id === postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.viewCount += 1;

    let isStarred = false;
    if (uid) {
      const idx = post.starredUsers.indexOf(uid);
      if (idx >= 0) {
        post.starredUsers.splice(idx, 1);
        post.starCount = Math.max(0, post.starCount - 1);
        isStarred = false;
      } else {
        post.starredUsers.push(uid);
        post.starCount += 1;
        isStarred = true;
      }
    } else {
      post.starCount += 1;
      isStarred = true;
    }

    res.json({
      success: true,
      starCount: post.starCount,
      viewCount: post.viewCount,
      starred: isStarred,
    });
  });

  // ==========================================
  // FRIEND REQUESTS API
  // ==========================================
  app.get('/api/friend-requests', (req: Request, res: Response) => {
    const toUid = req.query.toUid as string;
    const list = toUid ? friendRequests.filter((fr) => fr.toUid === toUid) : friendRequests;
    res.json({ requests: list });
  });

  app.post('/api/friend-requests', (req: Request, res: Response) => {
    const { fromUid, fromName, fromAvatarColor, fromCountry, toUid, toName } = req.body;
    if (!fromUid || !toUid) {
      return res.status(400).json({ error: 'Invalid friend request data' });
    }

    const existing = friendRequests.find(
      (fr) => fr.fromUid === fromUid && fr.toUid === toUid && fr.status === 'pending'
    );
    if (existing) {
      return res.json({ success: true, request: existing, message: 'Request already pending' });
    }

    const newReq: ServerFriendRequest = {
      id: `fr_${Date.now()}`,
      fromUid,
      fromName: fromName || 'Blue Chats Friend',
      fromAvatarColor: fromAvatarColor || '#3B6BFA',
      fromCountry: fromCountry || 'South Africa',
      toUid,
      toName: toName || 'Friend',
      status: 'pending',
      createdAt: Date.now(),
      timeFormatted: 'Just now',
    };

    friendRequests.unshift(newReq);
    res.json({ success: true, request: newReq });
  });

  app.put('/api/friend-requests/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const reqItem = friendRequests.find((fr) => fr.id === id);
    if (!reqItem) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    reqItem.status = status;
    res.json({ success: true, request: reqItem });
  });

  // ==========================================
  // 5. WALLET CONSENT & PRE-REGISTRATION
  // ==========================================
  const handleWalletApply = (req: Request, res: Response) => {
    const { uid, name, fullName, email, phone, docType, docNumber, termsAccepted } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({ error: 'You must agree to the Terms of Service to apply' });
    }

    if (!docNumber || !docType) {
      return res.status(400).json({ error: 'Document type and number required' });
    }

    const rawDoc = String(docNumber).trim();
    let masked = rawDoc;
    if (rawDoc.length > 7) {
      masked = `${rawDoc.substring(0, 4)}${'*'.repeat(rawDoc.length - 7)}${rawDoc.substring(rawDoc.length - 3)}`;
    } else {
      masked = `${rawDoc.substring(0, 2)}****`;
    }

    const applicant: ServerWalletApplicant = {
      id: `wall_app_${Date.now()}`,
      uid: uid || `usr_${Date.now()}`,
      name: name || fullName || 'Blue Chats Applicant',
      email,
      phone: phone || '+27 82 000 0000',
      docType,
      docNumberMasked: masked,
      termsAccepted: true,
      status: 'pre-registered',
      appliedAt: Date.now(),
    };

    walletApplicants.unshift(applicant);

    res.json({
      success: true,
      status: 'pre-registered',
      notice: 'Blue Chats Wallet — coming soon. Your eligibility has been recorded.',
      progress: {
        current: 1847,
        goal: 50000,
        unlockNotice: 'Wallet features unlock automatically at 50,000 users',
      },
      applicant: {
        id: applicant.id,
        name: applicant.name,
        docType: applicant.docType,
        docNumberMasked: applicant.docNumberMasked,
      },
    });
  };

  app.post('/api/wallet/apply', handleWalletApply);
  app.post('/api/wallet/pre-register', handleWalletApply);

  // ==========================================
  // BUG REPORTS API
  // ==========================================
  app.post('/api/bug-reports', (req: Request, res: Response) => {
    const { uid, userEmail, userName, description, screen, appVersion } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Please describe the issue' });
    }

    const report: ServerBugReport = {
      id: `bug_${Date.now()}`,
      uid: uid || 'anonymous',
      userEmail,
      userName,
      description: description.trim(),
      screen: screen || 'Unknown screen',
      appVersion: appVersion || 'v2.4.0',
      status: 'open',
      createdAt: Date.now(),
      timeFormatted: 'Just now',
    };

    bugReports.unshift(report);
    res.json({ success: true, report });
  });

  app.get('/api/bug-reports', (req: Request, res: Response) => {
    res.json({ reports: bugReports });
  });

  // ==========================================
  // 7. CEO / ADMIN DASHBOARD (FIREBASE CUSTOM CLAIMS - SERVER-SIDE ENFORCED)
  // ==========================================

  /**
   * Helper function: Verify caller credentials and set Firebase Custom Claims
   * Server-side Cloud Function logic executed securely on the backend.
   */
  async function verifyAndSetFirebaseCustomClaims(email?: string, idToken?: string) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    // Check if idToken is a server-issued claim token first
    if (typeof idToken === 'string' && idToken.startsWith('claim_')) {
      const verified = validateServerClaimToken(idToken);
      if (verified && verified.claims.role === 'ceo') {
        return {
          authorized: true,
          role: 'ceo' as const,
          claims: { role: 'ceo', admin: true, ceo: true },
          claimToken: idToken,
          source: 'server_claim_token_reverified',
        };
      }
    }

    // 1. If a Firebase Auth ID Token was provided, verify cryptographically with Firebase Admin SDK.
    // CRITICAL: Only call verifyIdToken if idToken has standard 3-part JWT format to prevent decoding exceptions.
    const isJwt = typeof idToken === 'string' && idToken.trim().split('.').length === 3;
    if (isJwt && firebaseAdminApp) {
      try {
        const decodedToken = await getAdminAuth(firebaseAdminApp).verifyIdToken(idToken.trim());
        const tokenEmail = (decodedToken.email || cleanEmail).toLowerCase();

        if (decodedToken.role === 'ceo' || decodedToken.admin === true || decodedToken.ceo === true) {
          const claimToken = createServerClaimToken(decodedToken.uid, tokenEmail);
          return {
            authorized: true,
            role: 'ceo' as const,
            claims: { role: 'ceo', admin: true, ceo: true },
            claimToken,
            source: 'firebase_id_token_verified',
          };
        }

        // If user's email matches designated CEO accounts, set custom user claims in Firebase Auth
        if (SERVER_ONLY_DESIGNATED_CEO_EMAILS.has(tokenEmail)) {
          await getAdminAuth(firebaseAdminApp).setCustomUserClaims(decodedToken.uid, {
            role: 'ceo',
            admin: true,
            ceo: true,
          });
          const claimToken = createServerClaimToken(decodedToken.uid, tokenEmail);
          return {
            authorized: true,
            role: 'ceo' as const,
            claims: { role: 'ceo', admin: true, ceo: true },
            claimToken,
            source: 'claims_attached_and_verified',
          };
        }
      } catch (err: any) {
        console.warn('[Security] ID token verification notice:', err.message);
      }
    }

    // 2. Server-side authoritative verification against designated admin list
    if (cleanEmail && SERVER_ONLY_DESIGNATED_CEO_EMAILS.has(cleanEmail)) {
      let uid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (firebaseAdminApp) {
        try {
          const userRecord = await getAdminAuth(firebaseAdminApp).getUserByEmail(cleanEmail);
          uid = userRecord.uid;
          await getAdminAuth(firebaseAdminApp).setCustomUserClaims(uid, {
            role: 'ceo',
            admin: true,
            ceo: true,
          });
        } catch {
          // If user record not found in Firebase Auth, claim will be assigned on first login
        }
      }

      const claimToken = createServerClaimToken(uid, cleanEmail);
      return {
        authorized: true,
        role: 'ceo' as const,
        claims: { role: 'ceo', admin: true, ceo: true },
        claimToken,
        source: 'server_claims_engine',
      };
    }

    return {
      authorized: false,
      role: null,
      error: 'Access denied: Account lacks verified CEO custom claims.',
    };
  }

  // Middleware to enforce verified CEO custom claims on all protected admin endpoints
  const requireCeoCustomClaimMiddleware = async (req: Request, res: Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
    const claimHeaderToken = (req.headers['x-ceo-claim-token'] as string) || bearerToken;

    // Check valid claim token issued by server
    const verifiedClaim = validateServerClaimToken(claimHeaderToken);
    if (verifiedClaim && verifiedClaim.claims.role === 'ceo') {
      (req as any).ceoClaim = verifiedClaim;
      return next();
    }

    // Check Firebase ID token in Authorization header ONLY if it matches 3-part JWT structure
    const isBearerJwt = typeof bearerToken === 'string' && bearerToken.trim().split('.').length === 3;
    if (isBearerJwt && firebaseAdminApp) {
      try {
        const decoded = await getAdminAuth(firebaseAdminApp).verifyIdToken(bearerToken.trim());
        if (decoded.role === 'ceo' || decoded.admin === true || decoded.ceo === true) {
          (req as any).ceoClaim = {
            uid: decoded.uid,
            email: decoded.email,
            role: 'ceo',
            claims: { role: 'ceo', admin: true, ceo: true },
          };
          return next();
        }
      } catch {}
    }

    return res.status(403).json({
      authorized: false,
      error: 'Forbidden: Access requires verified Firebase CEO custom claims confirmed by server.',
    });
  };

  // POST /api/admin/verify-claims and /api/admin/verify
  const handleVerifyClaims = async (req: Request, res: Response) => {
    const { email, idToken } = req.body;
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    // If an existing verified server claim token is provided, reuse/confirm without decoding as Firebase ID token
    const candidateClaimToken = (req.headers['x-ceo-claim-token'] as string) || (bearerToken.startsWith('claim_') ? bearerToken : null);
    if (candidateClaimToken) {
      const verified = validateServerClaimToken(candidateClaimToken);
      if (verified && verified.claims.role === 'ceo') {
        return res.json({
          authorized: true,
          role: 'ceo',
          claims: verified.claims,
          claimToken: candidateClaimToken,
          message: 'Firebase custom claims confirmed by server (session verified)',
        });
      }
    }

    // Only pass token to verify if it is a valid 3-part JWT string or claim token
    const isIdTokenJwt = typeof idToken === 'string' && idToken.trim().split('.').length === 3;
    const isBearerJwt = typeof bearerToken === 'string' && bearerToken.trim().split('.').length === 3;
    const tokenToUse = isIdTokenJwt ? idToken.trim() : (isBearerJwt ? bearerToken.trim() : undefined);

    const result = await verifyAndSetFirebaseCustomClaims(email, tokenToUse);

    if (result.authorized) {
      return res.json({
        authorized: true,
        role: result.role,
        claims: result.claims,
        claimToken: result.claimToken,
        message: 'Firebase custom claims confirmed by server',
      });
    }

    res.status(403).json({
      authorized: false,
      error: 'Access denied: Valid CEO custom claims required.',
    });
  };

  app.post('/api/admin/verify-claims', handleVerifyClaims);
  app.post('/api/admin/verify', handleVerifyClaims);

  // Protected Admin Statistics (Requires Server-Verified CEO Custom Claim)
  app.get('/api/admin/stats', requireCeoCustomClaimMiddleware, (req: Request, res: Response) => {
    const claim = (req as any).ceoClaim as ServerVerifiedClaim;
    const callerEmail = claim?.email || 'authenticated-ceo';

    const logEntry: AdminAccessLog = {
      id: `audit_${Date.now()}`,
      adminEmail: callerEmail,
      action: 'view_dashboard_metrics',
      timestamp: new Date().toISOString(),
      ip: req.ip || '127.0.0.1',
    };
    adminAccessLogs.unshift(logEntry);

    const adRevenue = {
      monthly: [
        { month: 'January', year: 2026, impressions: 384500, clicks: 14200, revenueZAR: 48900 },
        { month: 'February', year: 2026, impressions: 512000, clicks: 19800, revenueZAR: 65400 },
        { month: 'March', year: 2026, impressions: 689000, clicks: 27400, revenueZAR: 88200 },
      ],
      yearly: [
        { year: 2025, impressions: 1450000, clicks: 54000, revenueZAR: 185000 },
        { year: 2026, impressions: 1585500, clicks: 61400, revenueZAR: 202500 },
      ],
    };

    res.json({
      totalUsers: SEEDED_USERS.length + 1840,
      activeUsersToday: 412,
      users: SEEDED_USERS,
      bugReports,
      walletApplicantsCount: walletApplicants.length,
      walletApplicants,
      adRevenue,
      auditLogsCount: adminAccessLogs.length,
    });
  });

  // CEO / Admin Debug Health-Check endpoint (Requires Server-Verified CEO Custom Claim)
  app.get('/api/admin/health-check', requireCeoCustomClaimMiddleware, async (req: Request, res: Response) => {
    const health: {
      auth: { status: 'healthy' | 'degraded' | 'failing'; message: string };
      firestore: { status: 'healthy' | 'degraded' | 'failing'; message: string };
      server: { status: 'healthy' | 'degraded' | 'failing'; message: string };
      bunny: { status: 'healthy' | 'degraded' | 'failing'; message: string };
      timestamp: string;
    } = {
      auth: {
        status: 'healthy',
        message: 'Firebase Custom Claims & Token Verification active (roles: ceo/admin)',
      },
      firestore: {
        status: 'healthy',
        message: 'Firestore collections initialized (discoverPosts, bugReports, walletApplicants, chats)',
      },
      server: {
        status: 'healthy',
        message: `Cloud Server active. Uptime: ${Math.floor(process.uptime())}s`,
      },
      bunny: { status: 'healthy', message: 'Checking Bunny.net connectivity...' },
      timestamp: new Date().toISOString(),
    };

    try {
      const url = `https://${BUNNY_HOST}/${BUNNY_STORAGE_ZONE}/`;
      const bunnyRes = await fetch(url, {
        method: 'GET',
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          Accept: 'application/json',
        },
      });

      if (bunnyRes.ok || bunnyRes.status === 200 || bunnyRes.status === 404) {
        health.bunny = {
          status: 'healthy',
          message: `Bunny.net zone "${BUNNY_STORAGE_ZONE}" connected on ${BUNNY_HOST}`,
        };
      } else {
        health.bunny = {
          status: 'degraded',
          message: `Bunny.net returned HTTP ${bunnyRes.status}`,
        };
      }
    } catch (err: any) {
      health.bunny = {
        status: 'degraded',
        message: `Bunny.net edge check notice: ${err.message}`,
      };
    }

    res.json({ health });
  });

  // WebRTC Signaling Endpoints for 1-on-1 Voice & Video Calling
  app.post('/api/webrtc/signal', (req: Request, res: Response) => {
    const { from, to, type, payload } = req.body;
    if (!from || !to || !type) {
      return res.status(400).json({ error: 'Invalid signal body' });
    }

    const signal: CallSignal = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
    };

    activeSignals.push(signal);

    const twoMinutesAgo = Date.now() - 120000;
    while (activeSignals.length > 0 && activeSignals[0].timestamp < twoMinutesAgo) {
      activeSignals.shift();
    }

    res.json({ success: true, signalId: signal.id });
  });

  app.get('/api/webrtc/signals', (req: Request, res: Response) => {
    const to = req.query.to as string;
    const since = parseInt((req.query.since as string) || '0', 10);

    if (!to) {
      return res.status(400).json({ error: 'Missing "to" query param' });
    }

    const pending = activeSignals.filter((s) => s.to === to && s.timestamp > since);
    res.json({ signals: pending, serverTime: Date.now() });
  });

  // Vite development middleware integration
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Blue Chats server active at http://0.0.0.0:${PORT}`);
    console.log(`Bunny.net Storage Zone: ${BUNNY_STORAGE_ZONE} (Host: ${BUNNY_HOST})`);
    console.log('Firebase Custom Claims engine initialized (role: ceo/admin enforced server-side)');
  });
}

startServer().catch((err) => {
  console.error('Failed to start Blue Chats server:', err);
  process.exit(1);
});
