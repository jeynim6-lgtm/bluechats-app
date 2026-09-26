import React, { useEffect, useRef, useState } from 'react';
import {
  Server,
  Moon,
  Sun,
  Shield,
  Bell,
  CheckCircle2,
  RefreshCw,
  LogOut,
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
  Camera,
  Palette,
  Volume2,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { deleteUser } from 'firebase/auth';
import { useAuth, useMe } from '../context/AuthContext';
import { useAppData, useUserProfile } from '../context/AppDataContext';
import { updateProfile, updateAccountEmail, setBlocked, deleteUserData } from '../services/users';
import { verifyCeoAccess } from '../services/admin';
import { uploadMedia, compressImage, deleteMedia } from '../lib/media';
import { getFirebaseAuth, getRuntimeConfig } from '../lib/firebase';
import { formatPhone } from '../lib/phone';
import { ACCENT_PRESETS, BRANDING } from '../config/branding';
import { getAccentPreset, setAccent } from '../lib/theme';
import { LANGUAGES, getLanguage, setLanguage, useT, type LanguageCode } from '../lib/i18n';
import { getNotifyPrefs, setNotifyPrefs, requestNotificationPermission, playMessageSound } from '../lib/notify';
import { LegalModal, type LegalDocType } from './LegalModals';
import { BugReportModal } from './BugReportModal';
import { Avatar, Sheet, Spinner, ErrorBanner, toast } from './ui';

interface SettingsViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
}

interface MediaStatus {
  configured: boolean;
  storageZone: string | null;
  endpoint: string | null;
  cdn: boolean;
  cdnUrl: string | null;
}

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <div className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 flex-shrink-0 ${on ? 'bg-brand' : 'bg-line dark:bg-night-line'}`}>
    <div className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
  </div>
);

const BlockedRow: React.FC<{ uid: string; onUnblock: () => void }> = ({ uid, onUnblock }) => {
  const profile = useUserProfile(uid);
  const { displayName } = useAppData();
  const name = displayName(uid, profile?.name || 'Blue Chats user');
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Avatar name={name} color={profile?.avatarColor} url={profile?.avatarUrl} size={32} shape="circle" />
      <span className="flex-1 text-xs font-semibold truncate">{name}</span>
      <button onClick={onUnblock} className="text-[11px] font-bold text-brand cursor-pointer">
        Unblock
      </button>
    </div>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({ isDark, onToggleTheme, onOpenAdmin, onOpenWallet }) => {
  const me = useMe();
  const t = useT();
  const { account, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const [email, setEmail] = useState(account?.email || '');
  const [saving, setSaving] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [accent, setAccentState] = useState(getAccentPreset().id);
  const [language, setLanguageState] = useState<LanguageCode>(getLanguage());
  const [prefs, setPrefs] = useState(getNotifyPrefs());
  const [permission, setPermission] = useState<string>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const [media, setMedia] = useState<MediaStatus | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [ceo, setCeo] = useState(false);

  const [legal, setLegal] = useState<LegalDocType>(null);
  const [showBug, setShowBug] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const runtime = getRuntimeConfig();
  const blockedIds = account?.blocked || [];

  useEffect(() => {
    fetch('/api/media/status')
      .then((r) => r.json())
      .then(setMedia)
      .catch(() => setMedia(null));
    verifyCeoAccess()
      .then((r) => setCeo(r.authorized))
      .catch(() => setCeo(false));
  }, []);

  useEffect(() => {
    if (!editing) {
      setName(me.name);
      setBio(me.bio);
      setEmail(account?.email || '');
    }
  }, [me.name, me.bio, account?.email, editing]);

  const saveProfile = async () => {
    if (name.trim().length < 2) return toast('Name is too short');
    setSaving(true);
    try {
      await updateProfile(me.uid, { name, bio });
      if ((account?.email || '') !== email.trim()) await updateAccountEmail(me.uid, email);
      setEditing(false);
      toast('Profile updated');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (file?: File) => {
    if (!file) return;
    setAvatarProgress(0);
    try {
      const small = await compressImage(file, 512, 0.85);
      const res = await uploadMedia(small, 'avatars', { onProgress: setAvatarProgress });
      const old = me.avatarPath;
      await updateProfile(me.uid, { avatarUrl: res.url, avatarPath: res.path });
      if (old) void deleteMedia(old);
      toast('Profile photo updated');
    } catch (err) {
      toast(`Photo upload failed: ${(err as Error).message}`);
    } finally {
      setAvatarProgress(null);
    }
  };

  const removeAvatar = async () => {
    const old = me.avatarPath;
    await updateProfile(me.uid, { avatarUrl: null, avatarPath: null });
    if (old) void deleteMedia(old);
  };

  const updatePrefs = async (next: typeof prefs) => {
    if (next.notifications && !prefs.notifications) {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === 'denied') toast('Notifications are blocked in your browser settings');
    }
    setPrefs(next);
    setNotifyPrefs(next);
    if (next.sounds && !prefs.sounds) playMessageSound();
  };

  const runStorageTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const blob = new Blob([`${BRANDING.appName} storage check ${new Date().toISOString()}`], { type: 'text/plain' });
      const res = await uploadMedia(blob, 'docs', { fileName: 'storage-check.txt' });
      // CDN URLs are cross-origin: an opaque (no-cors) response still proves the file is being served.
      const crossOrigin = /^https?:\/\//.test(res.url);
      const check = await fetch(res.url, { cache: 'no-store', mode: crossOrigin ? 'no-cors' : 'cors' });
      await deleteMedia(res.path);
      const ok = crossOrigin ? check.type === 'opaque' || check.ok : check.ok;
      setTestResult({
        ok,
        message: ok
          ? `Uploaded, served back (${res.size} bytes) and deleted successfully${media?.cdn ? ' via CDN' : ''}.`
          : `Uploaded, but reading it back returned HTTP ${check.status}${media?.cdn ? ' — check the pull zone is linked to this storage zone' : ''}.`,
      });
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const deleteAccount = async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteUserData(me.uid, account?.phone || user.phoneNumber || '');
      if (me.avatarPath) void deleteMedia(me.avatarPath);
      await deleteUser(user);
      await signOut();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setDeleteError(
        code === 'auth/requires-recent-login'
          ? 'For your security, please log out, sign in again with your phone number, and then delete your account.'
          : (err as Error).message
      );
    } finally {
      setDeleting(false);
    }
  };

  const card = 'bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl p-5 shadow-xs';
  const field = 'w-full bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand';
  const rowBtn = 'w-full flex items-center justify-between py-2.5 text-xs hover:text-brand cursor-pointer';

  return (
    <div className="pb-4 p-4 space-y-4">
      {/* Profile */}
      <div className={card}>
        <input type="file" accept="image/*" ref={avatarInput} className="hidden" onChange={(e) => changeAvatar(e.target.files?.[0])} />
        <div className="flex items-center gap-4">
          <button onClick={() => avatarInput.current?.click()} className="relative cursor-pointer" aria-label="Change profile photo">
            <Avatar name={me.name} color={me.avatarColor} url={me.avatarUrl} size={64} />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center border-2 border-white dark:border-night-card">
              {avatarProgress !== null ? <Spinner className="w-3 h-3 text-white" /> : <Camera className="w-3 h-3" />}
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base truncate">{me.name}</h3>
              {!editing && (
                <button onClick={() => setEditing(true)} aria-label="Edit profile" className="p-1 text-brand hover:bg-brand/10 rounded-lg cursor-pointer">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-ink-soft dark:text-mist-soft truncate">{account?.phone ? formatPhone(account.phone) : ''}</p>
            <p className="text-[11px] text-ink-faint truncate">{me.bio}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full">Verified phone</span>
              {ceo && <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/15 px-2 py-0.5 rounded-full">👑 CEO</span>}
              {me.avatarUrl && (
                <button onClick={removeAvatar} className="text-[10px] text-ink-faint hover:text-red-500 cursor-pointer">
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {editing && (
          <div className="space-y-3 mt-4 pt-4 border-t border-line dark:border-night-line">
            <div>
              <label className="block text-[10px] font-bold text-ink-soft dark:text-mist-soft uppercase mb-1">Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-soft dark:text-mist-soft uppercase mb-1">About</label>
              <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-soft dark:text-mist-soft uppercase mb-1">Recovery email (private)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl border border-line dark:border-night-line text-xs font-semibold cursor-pointer">
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? <Spinner className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5" />} {t('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {ceo && (
        <div className="bg-gradient-to-r from-navy-950 to-navy-800 rounded-3xl p-4 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs block">CEO / Admin dashboard</span>
              <span className="text-[10px] text-haze">Server-verified access</span>
            </div>
          </div>
          <button onClick={onOpenAdmin} className="px-3.5 py-1.5 rounded-full bg-brand hover:bg-brand-strong text-xs font-bold cursor-pointer">
            Open →
          </button>
        </div>
      )}

      <button onClick={onOpenWallet} className={`${card} !p-4 w-full flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 text-left`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs">{BRANDING.appName} Wallet pre-registration</h4>
            <p className="text-[10px] text-ink-soft dark:text-mist-soft">Unlocks at {BRANDING.wallet.unlockGoal.toLocaleString()} users</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint" />
      </button>

      {/* Appearance & language */}
      <div className={`${card} space-y-3.5`}>
        <h4 className="text-xs font-bold uppercase tracking-wider">Appearance &amp; language</h4>
        <button onClick={onToggleTheme} className="w-full flex items-center justify-between cursor-pointer text-left">
          <span className="flex items-center gap-2.5 text-xs font-semibold">
            {isDark ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>
              Dark mode
              <span className="block text-[10px] text-ink-faint font-normal">Remembered on this device</span>
            </span>
          </span>
          <Toggle on={isDark} />
        </button>

        <div className="pt-3 border-t border-line/80 dark:border-night-line">
          <span className="flex items-center gap-2.5 text-xs font-semibold mb-2.5">
            <Palette className="w-4 h-4 text-brand" /> Accent colour
          </span>
          <div className="flex gap-2.5 flex-wrap">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setAccent(p.id);
                  setAccentState(p.id);
                }}
                title={p.name}
                aria-label={`${p.name} accent`}
                aria-pressed={accent === p.id}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform cursor-pointer ${accent === p.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-night-card scale-110' : ''}`}
                style={{ backgroundColor: p.brand, ['--tw-ring-color' as string]: p.brand }}
              >
                {accent === p.id && <CheckCircle2 className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-line/80 dark:border-night-line">
          <span className="flex items-center gap-2.5 text-xs font-semibold">
            <Globe className="w-4 h-4 text-brand" /> Language
          </span>
          <select
            value={language}
            onChange={(e) => {
              const code = e.target.value as LanguageCode;
              setLanguage(code);
              setLanguageState(code);
            }}
            className="bg-paper dark:bg-night border border-line dark:border-night-line rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notifications */}
      <div className={`${card} space-y-3`}>
        <h4 className="text-xs font-bold uppercase tracking-wider">Notifications</h4>
        <button onClick={() => updatePrefs({ ...prefs, notifications: !prefs.notifications })} className="w-full flex items-center justify-between cursor-pointer text-left">
          <span className="flex items-center gap-2.5 text-xs font-semibold">
            <Bell className="w-4 h-4 text-brand" />
            <span>
              Message &amp; call alerts
              <span className="block text-[10px] text-ink-faint font-normal">
                {permission === 'unsupported'
                  ? 'Not supported by this browser'
                  : permission === 'denied'
                  ? 'Blocked in browser settings'
                  : 'Shown while the app is in the background'}
              </span>
            </span>
          </span>
          <Toggle on={prefs.notifications && permission === 'granted'} />
        </button>
        <button onClick={() => updatePrefs({ ...prefs, sounds: !prefs.sounds })} className="w-full flex items-center justify-between cursor-pointer text-left pt-3 border-t border-line/80 dark:border-night-line">
          <span className="flex items-center gap-2.5 text-xs font-semibold">
            <Volume2 className="w-4 h-4 text-brand" /> Message sounds
          </span>
          <Toggle on={prefs.sounds} />
        </button>
      </div>

      {/* Privacy */}
      <div className={`${card} space-y-2`}>
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-500" /> Blocked contacts ({blockedIds.length})
        </h4>
        {blockedIds.length === 0 ? (
          <p className="text-[11px] text-ink-faint">Blocked people can't call you, and their messages and stories are hidden.</p>
        ) : (
          blockedIds.map((uid) => (
            <BlockedRow key={uid} uid={uid} onUnblock={() => setBlocked(me.uid, uid, false).catch((err) => toast(err.message))} />
          ))
        )}
      </div>

      {/* Legal */}
      <div className={`${card} !py-3`}>
        <button onClick={() => setLegal('terms')} className={rowBtn}>
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" /> Terms of Service
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
        </button>
        <button onClick={() => setLegal('privacy')} className={`${rowBtn} border-t border-line/60 dark:border-night-line`}>
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-success" /> Privacy Policy &amp; POPIA
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
        </button>
        <button onClick={() => setLegal('guidelines')} className={`${rowBtn} border-t border-line/60 dark:border-night-line`}>
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" /> Community Guidelines
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
        </button>
      </div>

      {/* Infrastructure */}
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Server className="w-4 h-4 text-brand" /> Storage &amp; connectivity
        </div>
        <div className="bg-paper dark:bg-night rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs">🐰 Bunny.net media storage</span>
            {media?.configured ? (
              <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full">Configured</span>
            ) : (
              <span className="text-[10px] font-bold text-gold bg-gold/15 px-2 py-0.5 rounded-full">Not configured</span>
            )}
          </div>
          <div className="text-[11px] font-mono-code text-ink-soft dark:text-mist-soft space-y-0.5 break-all">
            {media?.configured ? (
              <>
                <div>Zone: {media.storageZone}</div>
                <div>Endpoint: {media.endpoint}</div>
                <div>Delivery: {media.cdn ? media.cdnUrl : 'secure server proxy'}</div>
              </>
            ) : (
              <div>Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY on the server to enable photos, voice notes and video.</div>
            )}
          </div>
          <button
            onClick={runStorageTest}
            disabled={testing || !media?.configured}
            className="w-full mt-1 bg-brand hover:bg-brand-strong disabled:opacity-50 text-white text-[11px] font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} /> {testing ? 'Testing…' : 'Run upload test'}
          </button>
          {testResult && (
            <p className={`text-[10px] font-semibold text-center ${testResult.ok ? 'text-success' : 'text-red-500'}`}>{testResult.message}</p>
          )}
        </div>
        <div className="bg-paper dark:bg-night rounded-2xl p-3.5 text-[11px] font-mono-code text-ink-soft dark:text-mist-soft space-y-0.5">
          <div className="font-bold text-xs font-sans text-ink dark:text-mist mb-1">🔥 Firebase</div>
          <div>Project: {runtime?.firebase?.projectId}</div>
          {runtime?.emulators && <div className="text-gold">Using local emulators</div>}
          <div>Calls relay (TURN): {runtime?.features.turn ? 'configured' : 'not configured — STUN only'}</div>
        </div>
      </div>

      <button
        onClick={() => setShowBug(true)}
        className="w-full bg-gold/10 hover:bg-gold/20 text-gold font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer"
      >
        <Bug className="w-4 h-4" /> Report a bug
      </button>

      <div className="space-y-2">
        <button
          onClick={() => signOut()}
          className="w-full bg-line dark:bg-night-card hover:opacity-90 text-ink-soft dark:text-mist-soft font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> {t('logOut')}
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Delete account
        </button>
      </div>

      <p className="text-center text-[10px] text-ink-faint">
        {BRANDING.appName} v{BRANDING.version}
      </p>

      {showDelete && (
        <Sheet title="Delete your account?" onClose={() => !deleting && setShowDelete(false)}>
          <div className="p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed">
              This permanently deletes your profile, contacts, phone-number registration and wallet pre-registration, and removes your
              sign-in. Messages you already sent stay in the recipients' chats. This cannot be undone.
            </p>
            {deleteError && (
              <div className="text-left">
                <ErrorBanner message={deleteError} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowDelete(false)} disabled={deleting} className="flex-1 py-2.5 rounded-xl border border-line dark:border-night-line text-xs font-semibold cursor-pointer">
                {t('cancel')}
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {deleting ? <Spinner className="w-4 h-4 text-white" /> : <AlertTriangle className="w-4 h-4" />} Delete forever
              </button>
            </div>
          </div>
        </Sheet>
      )}

      <LegalModal type={legal} onClose={() => setLegal(null)} />
      {showBug && <BugReportModal defaultScreen="Settings / Profile" onClose={() => setShowBug(false)} />}
    </div>
  );
};
