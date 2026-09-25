import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  ChatSummary,
  ChatMessage,
  StatusContact,
  CallRecord,
  StatusItem,
} from './types';
import {
  INITIAL_USER,
  INITIAL_CHATS,
  INITIAL_MESSAGES,
  INITIAL_STATUS_CONTACTS,
  INITIAL_CALLS,
} from './services/mockInitialData';
import { saveMessageToFirebase, saveCallRecord } from './services/firebaseClient';
import { Topbar } from './components/Topbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { DiscoverTab } from './components/DiscoverTab';
import { StatusTab } from './components/StatusTab';
import { StatusViewer } from './components/StatusViewer';
import { StatusComposer } from './components/StatusComposer';
import { CallsList } from './components/CallsList';
import { CallModal } from './components/CallModal';
import { ContactsList } from './components/ContactsList';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { ProtectedCeoRoute } from './components/ProtectedCeoRoute';
import { ContactProfileModal } from './components/ContactProfileModal';

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // User auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('bluechats_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  // Active navigation
  const [activeTab, setActiveTab] = useState<TabType>('chats');

  // Chats & Messages
  const [chats, setChats] = useState<ChatSummary[]>(INITIAL_CHATS);
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Status Stories
  const [statusContacts, setStatusContacts] = useState<StatusContact[]>(INITIAL_STATUS_CONTACTS);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [showStatusComposer, setShowStatusComposer] = useState(false);

  // Calls
  const [calls, setCalls] = useState<CallRecord[]>(INITIAL_CALLS);
  const [activeCall, setActiveCall] = useState<{
    partnerId: string;
    partnerName: string;
    type: 'voice' | 'video';
  } | null>(null);

  // Contact Profile Modal
  const [activeContactProfile, setActiveContactProfile] = useState<{
    id: string;
    name: string;
    avatar?: string;
    avatarColor?: string;
    country?: string;
    about?: string;
    online?: boolean;
    isBlocked?: boolean;
  } | null>(null);

  // Synchronize Dark Theme across HTML root and Tailwind
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);

  // Handle Send Message inside ChatRoom
  const handleSendMessage = async (msgData: Partial<ChatMessage>) => {
    if (!activeChatId || !currentUser) return;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      chatId: activeChatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      type: msgData.type || 'text',
      text: msgData.text,
      mediaUrl: msgData.mediaUrl,
      mediaDuration: msgData.mediaDuration,
      mediaSize: msgData.mediaSize,
      mimeType: msgData.mimeType,
      location: msgData.location,
      contactCard: msgData.contactCard,
      timestamp: Date.now(),
      timeFormatted,
      status: 'sent',
      mine: true,
    };

    // Update in memory
    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMsg],
    }));

    // Update chat preview in list
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              lastMessage:
                msgData.type === 'voice'
                  ? 'Voice note'
                  : msgData.type === 'image'
                  ? '📷 Photo'
                  : msgData.type === 'video'
                  ? '🎥 Video'
                  : msgData.type === 'location'
                  ? '📍 Location'
                  : msgData.text || 'Media',
              lastMessageType: msgData.type,
              lastMessageTime: timeFormatted,
              lastMessageTimestamp: Date.now(),
              mine: true,
            }
          : c
      )
    );

    // Save to Firebase & local storage
    await saveMessageToFirebase(newMsg);
  };

  // Start voice or video call
  const handleStartCall = (partnerId: string, partnerName: string, type: 'voice' | 'video') => {
    setActiveCall({ partnerId, partnerName, type });
  };

  // End Call and store record in Firebase
  const handleEndCall = async (record: Partial<CallRecord>) => {
    setActiveCall(null);
    if (!record.partnerId || !record.partnerName) return;

    const newCall: CallRecord = {
      id: `call_${Date.now()}`,
      partnerId: record.partnerId,
      partnerName: record.partnerName,
      avatarColor: '#3B6BFA',
      type: record.type || 'voice',
      direction: record.direction || 'outgoing',
      timestamp: Date.now(),
      timeFormatted: 'Just now',
      durationSeconds: record.durationSeconds || 0,
      recordingUrl: record.recordingUrl,
    };

    setCalls((prev) => [newCall, ...prev]);
    await saveCallRecord(newCall);
  };

  // Start Chat with a discovered friend or contact
  const handleStartChatWithFriend = (name: string, color: string = '#3B6BFA', partnerId?: string) => {
    const existing = chats.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || (partnerId && c.participants.includes(partnerId))
    );
    if (existing) {
      setActiveChatId(existing.id);
      setActiveTab('chats');
      return;
    }

    const newChatId = `chat_${Date.now()}`;
    const newChat: ChatSummary = {
      id: newChatId,
      name,
      isGroup: false,
      participants: [currentUser?.id || 'me', partnerId || name.toLowerCase().replace(/\s/g, '_')],
      avatarColor: color,
      lastMessage: 'Say hello!',
      lastMessageType: 'text',
      lastMessageTime: 'Now',
      lastMessageTimestamp: Date.now(),
      unreadCount: 0,
      mine: false,
      online: true,
      country: 'South Africa',
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setActiveTab('chats');
  };

  // Handle Friend Request Accepted: creates real 1-on-1 chat in Chats tab
  const handleFriendRequestAccepted = (friend: { id: string; name: string; avatarColor: string }) => {
    handleStartChatWithFriend(friend.name, friend.avatarColor, friend.id);
  };

  // Post a new status update
  const handlePostStatus = (item: Partial<StatusItem>) => {
    const newItem: StatusItem = {
      id: `st_${Date.now()}`,
      type: item.type || 'text',
      text: item.text,
      mediaUrl: item.mediaUrl,
      bg: item.bg || '#2453D6',
      timestamp: Date.now(),
      timeFormatted: 'Just now',
      views: 0,
    };

    setStatusContacts((prev) => {
      const myIndex = prev.findIndex((c) => c.id === 'my_status');
      if (myIndex >= 0) {
        const updated = [...prev];
        updated[myIndex].items.unshift(newItem);
        return updated;
      } else {
        const myStatus: StatusContact = {
          id: 'my_status',
          name: 'My Status',
          avatarColor: '#3B6BFA',
          items: [newItem],
          seen: false,
        };
        return [myStatus, ...prev];
      }
    });
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('bluechats_user');
    setCurrentUser(null);
  };

  // Block / Unblock user
  const handleToggleBlock = (targetId: string, shouldBlock: boolean) => {
    if (!currentUser) return;
    const blocked = currentUser.blockedUsers || [];
    const updatedBlocked = shouldBlock
      ? [...blocked, targetId]
      : blocked.filter((id) => id !== targetId);

    const updatedUser = { ...currentUser, blockedUsers: updatedBlocked };
    setCurrentUser(updatedUser);
    localStorage.setItem('bluechats_user', JSON.stringify(updatedUser));
  };

  const activeChat = chats.find((c) => c.id === activeChatId);
  const totalUnreadChats = chats.reduce((acc, c) => acc + c.unreadCount, 0);
  const missedCallsCount = calls.filter((c) => c.direction === 'missed').length;

  return (
    <div className="min-h-screen bg-[#F4F6FC] dark:bg-[#0B1130] text-[#0E1430] dark:text-[#EEF1FF] flex justify-center">
      {/* Mobile container layout */}
      <div className="w-full max-w-[480px] min-h-screen flex flex-col relative bg-[#F4F6FC] dark:bg-[#0B1130] shadow-2xl">
        {/* Auth Modal if logged out (5-step onboarding flow) */}
        {!currentUser && (
          <AuthModal
            onComplete={(u) => {
              setCurrentUser(u);
              localStorage.setItem('bluechats_user', JSON.stringify(u));
            }}
          />
        )}

        {/* Top Header */}
        <Topbar
          onOpenWallet={() => setActiveTab('wallet')}
          onOpenNewChat={() => setShowStatusComposer(true)}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && (
            <ChatList
              chats={chats}
              onSelectChat={(id) => setActiveChatId(id)}
              onStartChatWithFriend={handleStartChatWithFriend}
            />
          )}

          {activeTab === 'discover' && currentUser && (
            <DiscoverTab
              currentUser={currentUser}
              onOpenProfile={(u) => {
                setActiveContactProfile({
                  id: u.id,
                  name: u.name,
                  avatar: u.avatar,
                  avatarColor: u.avatarColor,
                  country: u.country,
                  about: 'Blue Chats Creator · Connecting across Africa and the globe.',
                  online: true,
                  isBlocked: currentUser.blockedUsers?.includes(u.id),
                });
              }}
              onFriendRequestAccepted={handleFriendRequestAccepted}
            />
          )}

          {activeTab === 'status' && (
            <StatusTab
              contacts={statusContacts}
              onOpenStory={(idx) => {
                setStatusContacts((prev) =>
                  prev.map((c, i) => (i === idx ? { ...c, seen: true } : c))
                );
                setActiveStoryIndex(idx);
              }}
              onOpenComposer={() => setShowStatusComposer(true)}
            />
          )}

          {activeTab === 'calls' && (
            <CallsList
              calls={calls}
              onStartCall={(id, name, type) => handleStartCall(id, name, type)}
            />
          )}

          {activeTab === 'contacts' && (
            <ContactsList
              onStartChat={(name) => handleStartChatWithFriend(name, '#3B6BFA')}
              onStartCall={(name, type) => handleStartCall(name, name, type)}
            />
          )}

          {activeTab === 'wallet' && <WalletView />}

          {activeTab === 'settings' && currentUser && (
            <SettingsView
              user={currentUser}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              onLogout={handleLogout}
              onUpdateUser={(updated) => {
                setCurrentUser((prev) => {
                  if (!prev) return null;
                  const res = { ...prev, ...updated };
                  localStorage.setItem('bluechats_user', JSON.stringify(res));
                  return res;
                });
              }}
              onOpenAdmin={() => setActiveTab('admin')}
              onOpenWallet={() => setActiveTab('wallet')}
            />
          )}

          {activeTab === 'admin' && currentUser && (
            <ProtectedCeoRoute
              currentUser={currentUser}
              onBack={() => setActiveTab('settings')}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveChatId(null);
            setActiveTab(tab);
          }}
          unreadChatsCount={totalUnreadChats}
          hasUnseenStatus={statusContacts.some((c) => !c.seen)}
          missedCallsCount={missedCallsCount}
        />

        {/* Active Chat Room Modal */}
        {activeChatId && activeChat && currentUser && (
          <ChatRoom
            chat={activeChat}
            messages={messagesMap[activeChatId] || []}
            currentUserId={currentUser.id}
            onBack={() => setActiveChatId(null)}
            onSendMessage={handleSendMessage}
            onStartVoiceCall={(id, name) => handleStartCall(id, name, 'voice')}
            onStartVideoCall={(id, name) => handleStartCall(id, name, 'video')}
            onOpenProfile={(u) => {
              setActiveContactProfile({
                id: u.id,
                name: u.name,
                avatar: u.avatar,
                avatarColor: u.avatarColor,
                country: u.country,
                online: activeChat.online,
                isBlocked: currentUser.blockedUsers?.includes(u.id),
              });
            }}
          />
        )}

        {/* Contact Profile Modal (Tapping avatar/name) */}
        {activeContactProfile && (
          <ContactProfileModal
            contact={activeContactProfile}
            onClose={() => setActiveContactProfile(null)}
            onStartChat={(id, name) => {
              setActiveContactProfile(null);
              handleStartChatWithFriend(name, activeContactProfile.avatarColor, id);
            }}
            onStartVoiceCall={(id, name) => {
              setActiveContactProfile(null);
              handleStartCall(id, name, 'voice');
            }}
            onStartVideoCall={(id, name) => {
              setActiveContactProfile(null);
              handleStartCall(id, name, 'video');
            }}
            onToggleBlock={handleToggleBlock}
          />
        )}

        {/* Status Story Viewer */}
        {activeStoryIndex !== null && (
          <StatusViewer
            contacts={statusContacts}
            initialContactIndex={activeStoryIndex}
            onClose={() => setActiveStoryIndex(null)}
          />
        )}

        {/* Status Composer */}
        {showStatusComposer && (
          <StatusComposer
            onClose={() => setShowStatusComposer(false)}
            onPostStatus={handlePostStatus}
          />
        )}

        {/* Active Video/Voice Call Overlay */}
        {activeCall && (
          <CallModal
            partnerId={activeCall.partnerId}
            partnerName={activeCall.partnerName}
            callType={activeCall.type}
            onEndCall={handleEndCall}
          />
        )}
      </div>
    </div>
  );
}
