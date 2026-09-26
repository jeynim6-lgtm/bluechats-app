import React, { useEffect, useMemo, useState } from 'react';
import { initFirebase, type RuntimeConfig } from './lib/firebase';
import { applyDark, getInitialDark } from './lib/theme';
import { unlockAudio } from './lib/notify';
import { AuthProvider, useAuth, useMe } from './context/AuthContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { CallProvider, useCalls } from './context/CallContext';
import { subscribeCallHistory } from './services/calls';
import { useStatusFeed } from './components/StatusTab';
import { SplashScreen, SetupRequired } from './components/BootScreens';
import { AuthModal } from './components/AuthModal';
import { Topbar } from './components/Topbar';
import { BottomNav, type TabType } from './components/BottomNav';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { NewChatSheet } from './components/NewChatSheet';
import { DiscoverTab } from './components/DiscoverTab';
import { StatusTab } from './components/StatusTab';
import { CallsList } from './components/CallsList';
import { CallModal } from './components/CallModal';
import { ContactsList } from './components/ContactsList';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { ProtectedCeoRoute } from './components/ProtectedCeoRoute';
import { ContactProfileModal, type ProfileTarget } from './components/ContactProfileModal';
import { ToastHost } from './components/ui';
import type { CallRecord } from './types';

const CALLS_SEEN_KEY = 'bluechats_calls_seen_at';

export default function App() {
  const [boot, setBoot] = useState<{ state: 'loading' } | { state: 'ready'; config: RuntimeConfig } | { state: 'error'; message: string }>({
    state: 'loading',
  });

  useEffect(() => {
    initFirebase()
      .then((config) => setBoot({ state: 'ready', config }))
      .catch((err) => setBoot({ state: 'error', message: (err as Error).message }));
  }, []);

  if (boot.state === 'loading') return <SplashScreen />;
  if (boot.state === 'error') return <SetupRequired error={boot.message} />;
  if (!boot.config.firebase) return <SetupRequired missing={boot.config.missing} />;

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { status } = useAuth();
  // Keeps the onboarding screens (wallet step, welcome) visible after the profile is created.
  const [onboarding, setOnboarding] = useState(false);

  if (status === 'loading') return <SplashScreen />;
  if (status !== 'ready' || onboarding) {
    return <AuthModal onProfileCreated={() => setOnboarding(true)} onFinished={() => setOnboarding(false)} />;
  }
  return (
    <AppDataProvider>
      <CallProvider>
        <MainShell />
      </CallProvider>
    </AppDataProvider>
  );
}

function MainShell() {
  const me = useMe();
  const { chats, activeChatId, openChat, friendRequests, blocked } = useAppData();
  const { call } = useCalls();
  const [tab, setTab] = useState<TabType>('chats');
  const [isDark, setIsDark] = useState(getInitialDark);
  const [showNewChat, setShowNewChat] = useState(false);
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [callsSeenAt, setCallsSeenAt] = useState<number>(() => Number(localStorage.getItem(CALLS_SEEN_KEY) || 0));
  const statusFeed = useStatusFeed();

  useEffect(() => applyDark(isDark), [isDark]);
  useEffect(() => subscribeCallHistory(me.uid, setCallRecords), [me.uid]);

  useEffect(() => {
    if (tab !== 'calls') return;
    const now = Date.now();
    setCallsSeenAt(now);
    localStorage.setItem(CALLS_SEEN_KEY, String(now));
  }, [tab, callRecords.length]);

  // Unlock Web Audio on the first interaction so ringtones can play later.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const unreadChats = useMemo(
    () => chats.filter((c) => !(c.type === 'direct' && c.participants.some((p) => blocked.has(p))) && (c.unread[me.uid] || 0) > 0).length,
    [chats, me.uid, blocked]
  );
  const visibleCalls = useMemo(() => callRecords.filter((c) => !blocked.has(c.partnerId)), [callRecords, blocked]);
  const missedCalls = visibleCalls.filter((c) => c.direction === 'missed' && c.timestamp > callsSeenAt).length;
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-mist flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col relative bg-paper dark:bg-night shadow-2xl">
        <Topbar
          onOpenWallet={() => setTab('wallet')}
          onNewChat={() => setShowNewChat(true)}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
        />

        <main className="flex-1">
          {tab === 'chats' && <ChatList onNewChat={() => setShowNewChat(true)} onOpenProfile={setProfileTarget} />}
          {tab === 'discover' && <DiscoverTab onOpenProfile={setProfileTarget} />}
          {tab === 'status' && <StatusTab feed={statusFeed} />}
          {tab === 'calls' && <CallsList records={visibleCalls} onOpenProfile={setProfileTarget} />}
          {tab === 'contacts' && <ContactsList onOpenProfile={setProfileTarget} />}
          {tab === 'wallet' && <WalletView />}
          {tab === 'settings' && (
            <SettingsView
              isDark={isDark}
              onToggleTheme={() => setIsDark((d) => !d)}
              onOpenAdmin={() => setTab('admin')}
              onOpenWallet={() => setTab('wallet')}
            />
          )}
          {tab === 'admin' && <ProtectedCeoRoute onBack={() => setTab('settings')} />}
        </main>

        <BottomNav
          activeTab={tab}
          onSelectTab={(next) => {
            openChat(null);
            setTab(next);
          }}
          unreadChatsCount={unreadChats}
          hasUnseenStatus={statusFeed.hasUnseen}
          missedCallsCount={missedCalls}
          hasFriendRequests={friendRequests.length > 0}
        />

        {activeChat && <ChatRoom chat={activeChat} onBack={() => openChat(null)} onOpenProfile={setProfileTarget} />}

        {showNewChat && <NewChatSheet onClose={() => setShowNewChat(false)} />}

        {profileTarget && <ContactProfileModal target={profileTarget} onClose={() => setProfileTarget(null)} />}

        {call && <CallModal />}

        <ToastHost />
      </div>
    </div>
  );
}
