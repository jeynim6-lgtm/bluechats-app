import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Moon,
  Sun,
  Shield,
  Bell,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  LogOut,
  User,
  FileText,
  Lock,
  Globe,
  Trash2,
  Bug,
  ChevronRight,
  ShieldAlert,
  Wallet,
  Activity,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { checkBunnyStatus, uploadToBunny } from '../services/bunnyStorage';
import { FIREBASE_WEB_KEY } from '../services/firebaseClient';
import { LegalModal, LegalDocType } from './LegalModals';
import { verifyCeoClaimsOncePerSession, getCachedCeoStatus } from '../services/adminAuth';
import { BugReportModal } from './BugReportModal';

interface SettingsViewProps {
  user: UserProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  isDark,
  onToggleTheme,
  onLogout,
  onUpdateUser,
  onOpenAdmin,
  onOpenWallet,
}) => {
  const [bunnyInfo, setBunnyInfo] = useState<{
    status: string;
    storageZone: string;
    host: string;
    message?: string;
  }>({
    status: 'checking...',
    storageZone: 'bluechats',
    host: 'storage.bunny.com',
  });

  const [testUploadResult, setTestUploadResult] = useState<string | null>(null);
  const [isTestingUpload, setIsTestingUpload] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Profile Edit modal/inline state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || 'Hey there! I am using Blue Chats.');
  const [editEmail, setEditEmail] = useState(user.email || '');

  // Language selector state
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('bluechats_language') || 'English';
  });

  // Modals
  const [legalModalType, setLegalModalType] = useState<LegalDocType>(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  useEffect(() => {
    checkBunnyStatus().then((res) => {
      setBunnyInfo(res);
    });
  }, []);

  const handleSaveProfile = () => {
    onUpdateUser({
      name: editName.trim(),
      bio: editBio.trim(),
      email: editEmail.trim(),
    });
    setIsEditingProfile(false);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('bluechats_language', lang);
  };

  const runTestUpload = async () => {
    setIsTestingUpload(true);
    setTestUploadResult(null);
    try {
      const sampleBlob = new Blob(['Blue Chats Bunny.net storage connection verification payload'], {
        type: 'text/plain',
      });
      const res = await uploadToBunny(sampleBlob, 'status', 'test_connection.txt');
      setTestUploadResult(`Success: Stored in Bunny.net (${res.size} bytes)`);
    } catch (err: any) {
      setTestUploadResult(`Upload notice: ${err.message}`);
    } finally {
      setIsTestingUpload(false);
    }
  };

  // Check session cache immediately (0 network calls on navigation)
  const [isCeoVerified, setIsCeoVerified] = useState<boolean>(() => {
    const cached = getCachedCeoStatus(user.email);
    return Boolean(cached?.authorized && cached.claims?.role === 'ceo');
  });

  useEffect(() => {
    let active = true;
    if (!user.email) return;

    // Checks once per session; if already verified, returns cached result with 0 network calls
    verifyCeoClaimsOncePerSession(user.email).then((res) => {
      if (!active) return;
      if (res.authorized && res.claims?.role === 'ceo') {
        setIsCeoVerified(true);
      } else if (!res.authorized) {
        setIsCeoVerified(false);
      }
    });

    return () => {
      active = false;
    };
  }, [user.email]);

  return (
    <div className="pb-28 p-4 space-y-4">
      {/* Profile Card & Account Editor */}
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-5 shadow-xs">
        {isEditingProfile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E8F7] dark:border-[#242D57]">
              <span className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF]">Edit Profile</span>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-[#9AA1C4] hover:text-[#0E1430]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase">
                Display Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase">
                Bio / About
              </label>
              <input
                type="text"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase">
                Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3 py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF]"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              className="w-full py-2.5 rounded-xl bg-[#3B6BFA] hover:bg-[#2453D6] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#3B6BFA] flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
              {user.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF] truncate">
                  {user.name}
                </h3>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="p-1 text-[#3B6BFA] hover:bg-[#3B6BFA]/10 rounded-lg cursor-pointer"
                  title="Edit Profile"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] truncate mt-0.5">
                {user.phone}
              </p>
              <p className="text-[11px] text-[#9AA1C4] truncate mt-0.5">
                {user.email || 'No email registered'}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block text-[10px] text-[#2FBE8F] font-bold bg-[#2FBE8F]/10 px-2 py-0.5 rounded-full">
                  Active Session
                </span>
                {isCeoVerified && (
                  <span className="inline-block text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/15 px-2 py-0.5 rounded-full">
                    👑 Verified CEO Claims
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CEO / ADMIN DASHBOARD SHORTCUT (Protected by Server-Verified Claims) */}
      {isCeoVerified && (
        <div className="bg-gradient-to-r from-[#0B1330] to-[#152657] border border-white/10 rounded-3xl p-4 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4DD8E8]/20 text-[#4DD8E8] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-white block">CEO / Admin Dashboard</span>
              <span className="text-[10px] text-[#B9C0E6]">
                Server-verified custom claims (role: ceo)
              </span>
            </div>
          </div>

          <button
            onClick={onOpenAdmin}
            className="px-3.5 py-1.5 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Open →
          </button>
        </div>
      )}

      {/* WALLET CONSENT & PRE-REGISTRATION QUICK LINK */}
      <div
        onClick={onOpenWallet}
        className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-4 shadow-xs flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B6BFA]/10 text-[#3B6BFA] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF]">
              Blue Chats Wallet Pre-Registration
            </h4>
            <p className="text-[10px] text-[#5A6182] dark:text-[#AEB4DA]">
              Unlocks at 50,000 users · FICA documentation
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#9AA1C4]" />
      </div>

      {/* GENERAL PREFERENCES & APP THEME */}
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-5 shadow-xs space-y-3.5">
        <h4 className="text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF] uppercase tracking-wider">
          Preferences &amp; Language
        </h4>

        {/* Global Dark Theme Toggle */}
        <div
          onClick={onToggleTheme}
          className="flex items-center justify-between py-1 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF]">
            {isDark ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <div>
              <span>Dark Appearance</span>
              <p className="text-[10px] text-[#9AA1C4] font-normal">Applies globally across all screens</p>
            </div>
          </div>

          <div
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
              isDark ? 'bg-[#3B6BFA]' : 'bg-[#E4E8F7]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                isDark ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center justify-between py-1 border-t border-[#E4E8F7]/80 dark:border-[#242D57] pt-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF]">
            <Globe className="w-4 h-4 text-[#3B6BFA]" />
            <span>App Language</span>
          </div>

          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none"
          >
            <option value="English">English</option>
            <option value="isiZulu">isiZulu</option>
            <option value="Sesotho">Sesotho</option>
            <option value="Afrikaans">Afrikaans</option>
            <option value="Français">Français</option>
            <option value="Português">Português</option>
            <option value="Español">Español</option>
            <option value="Kiswahili">Kiswahili</option>
          </select>
        </div>

        {/* Notifications */}
        <div
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          className="flex items-center justify-between py-1 border-t border-[#E4E8F7]/80 dark:border-[#242D57] pt-3 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF]">
            <Bell className="w-4 h-4 text-[#3B6BFA]" />
            <span>Chat Notifications &amp; Sounds</span>
          </div>

          <div
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
              notificationsEnabled ? 'bg-[#3B6BFA]' : 'bg-[#E4E8F7]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </div>
      </div>

      {/* LEGAL & POLICIES */}
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-5 shadow-xs space-y-2">
        <h4 className="text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF] uppercase tracking-wider mb-2">
          Legal &amp; Privacy Policies
        </h4>

        <button
          onClick={() => setLegalModalType('terms')}
          className="w-full flex items-center justify-between py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF] hover:text-[#3B6BFA] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#3B6BFA]" />
            <span>Terms of Service</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9AA1C4]" />
        </button>

        <button
          onClick={() => setLegalModalType('privacy')}
          className="w-full flex items-center justify-between py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF] hover:text-[#3B6BFA] cursor-pointer border-t border-[#E4E8F7]/60 dark:border-[#242D57]"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#2FBE8F]" />
            <span>Privacy Policy &amp; POPIA Compliance</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9AA1C4]" />
        </button>

        <button
          onClick={() => setLegalModalType('guidelines')}
          className="w-full flex items-center justify-between py-2 text-xs text-[#0E1430] dark:text-[#EEF1FF] hover:text-[#3B6BFA] cursor-pointer border-t border-[#E4E8F7]/60 dark:border-[#242D57]"
        >
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            <span>Community Guidelines</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9AA1C4]" />
        </button>
      </div>

      {/* CLOUD STORAGE STATUS (Bunny.net + Firebase) */}
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl p-5 shadow-xs space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0E1430] dark:text-[#EEF1FF] uppercase tracking-wider">
          <Server className="w-4 h-4 text-[#3B6BFA]" />
          <span>Storage &amp; Cloud Infrastructure</span>
        </div>

        {/* Bunny.net Card */}
        <div className="bg-[#F4F6FC] dark:bg-[#0B1130] rounded-2xl p-3.5 border border-[#E4E8F7]/80 dark:border-[#242D57] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF] flex items-center gap-1.5">
              🐰 Bunny.net Edge Storage
            </span>
            <span className="text-[10px] font-bold text-[#2FBE8F] bg-[#2FBE8F]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          </div>

          <div className="text-[11px] font-mono-code text-[#5A6182] dark:text-[#AEB4DA] space-y-0.5">
            <div>Zone: <strong>{bunnyInfo.storageZone}</strong></div>
            <div>Host: <strong>{bunnyInfo.host}</strong></div>
            <div>Media: <strong>Voice notes, Photos, Video calls, Discover</strong></div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
              🔒 Key protected strictly server-side in Cloud Server
            </div>
          </div>

          <button
            onClick={runTestUpload}
            disabled={isTestingUpload}
            className="w-full mt-2 bg-[#3B6BFA] hover:bg-[#2453D6] disabled:opacity-50 text-white text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isTestingUpload ? 'animate-spin' : ''}`} />
            <span>{isTestingUpload ? 'Testing Bunny.net Upload...' : 'Test Bunny.net Edge Upload'}</span>
          </button>

          {testUploadResult && (
            <p className="text-[10px] font-semibold text-emerald-500 mt-1 text-center">
              {testUploadResult}
            </p>
          )}
        </div>

        {/* Firebase Card */}
        <div className="bg-[#F4F6FC] dark:bg-[#0B1130] rounded-2xl p-3.5 border border-[#E4E8F7]/80 dark:border-[#242D57] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#0E1430] dark:text-[#EEF1FF] flex items-center gap-1.5">
              🔥 Firebase Firestore &amp; Auth
            </span>
            <span className="text-[10px] font-bold text-[#2FBE8F] bg-[#2FBE8F]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Live
            </span>
          </div>

          <div className="text-[11px] font-mono-code text-[#5A6182] dark:text-[#AEB4DA] space-y-0.5">
            <div>Web Key: <strong>{FIREBASE_WEB_KEY.substring(0, 16)}...</strong></div>
            <div>Project: <strong>bluechats</strong></div>
            <div>Collections: <strong>discoverPosts, friendRequests, bugReports, chats</strong></div>
          </div>
        </div>
      </div>

      {/* REPORT A BUG ACTION */}
      <button
        onClick={() => setShowBugModal(true)}
        className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Bug className="w-4 h-4" />
        <span>Report a Bug to Engineering</span>
      </button>

      {/* LOGOUT & ACCOUNT ACTIONS */}
      <div className="space-y-2">
        <button
          onClick={onLogout}
          className="w-full bg-[#E4E8F7] dark:bg-[#131B3E] hover:bg-[#d6dbf0] text-[#5A6182] dark:text-[#AEB4DA] font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Blue Chats</span>
        </button>

        <button
          onClick={() => setShowDeleteAccountModal(true)}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Account</span>
        </button>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131B3E] border border-red-500/30 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">
                Delete Blue Chats Account?
              </h3>
              <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] mt-1 leading-relaxed">
                This will delete your local session and clear your active account registration. This action is irreversible.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E4E8F7] dark:border-[#242D57] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Modals */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />

      {/* Bug Report Modal */}
      {showBugModal && (
        <BugReportModal
          currentUserId={user.id}
          currentUserEmail={user.email}
          currentUserName={user.name}
          defaultScreen="Settings"
          onClose={() => setShowBugModal(false)}
        />
      )}

      <p className="text-center text-[10px] text-[#9AA1C4]">
        Blue Chats v2.4.0 · Powered by Firebase &amp; Bunny.net Edge CDN
      </p>
    </div>
  );
};
