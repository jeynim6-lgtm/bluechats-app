import React, { useState } from 'react';
import { Search, UserPlus, MessageSquare, Phone, Video, X } from 'lucide-react';
import { UserProfile } from '../types';

interface ContactsListProps {
  onStartChat: (partnerName: string) => void;
  onStartCall: (partnerName: string, type: 'voice' | 'video') => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({ onStartChat, onStartCall }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [contacts, setContacts] = useState([
    { id: '1', name: 'Naledi M.', phone: '+27 82 555 0192', color: '#2453D6' },
    { id: '2', name: 'Kabelo', phone: '+27 83 444 8821', color: '#3B6BFA' },
    { id: '3', name: 'Rea', phone: '+27 71 222 9011', color: '#4DD8E8' },
    { id: '4', name: 'Mom', phone: '+27 82 999 1122', color: '#2FBE8F' },
    { id: '5', name: 'Thabo', phone: '+27 84 333 4455', color: '#E8A23B' },
    { id: '6', name: 'Lindiwe', phone: '+27 76 111 7788', color: '#8A6CF2' },
  ]);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setContacts((prev) => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        name: newName.trim(),
        phone: newPhone.trim(),
        color: '#3B6BFA',
      },
    ]);

    setNewName('');
    setNewPhone('');
    setShowAddModal(false);
  };

  return (
    <div className="pb-24">
      {/* Top search & Add contact */}
      <div className="px-4 py-3 flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-full px-4 py-2 text-sm shadow-xs">
          <Search className="w-4 h-4 text-[#9AA1C4]" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none text-sm"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-9 h-9 rounded-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white flex items-center justify-center shadow-md cursor-pointer flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Contacts List */}
      <div className="divide-y divide-[#E4E8F7]/60 dark:divide-[#242D57]/60">
        {filtered.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-black/2 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-xs shadow-xs flex-shrink-0"
                style={{ backgroundColor: contact.color }}
              >
                {getInitials(contact.name)}
              </div>

              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#0E1430] dark:text-[#EEF1FF] truncate">
                  {contact.name}
                </h3>
                <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] truncate mt-0.5">
                  {contact.phone}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onStartChat(contact.name)}
                title="Message"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E4E8F7]/70 dark:bg-[#242D57] text-[#3B6BFA] hover:bg-[#3B6BFA] hover:text-white transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                onClick={() => onStartCall(contact.name, 'voice')}
                title="Voice Call"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E4E8F7]/70 dark:bg-[#242D57] text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                onClick={() => onStartCall(contact.name, 'video')}
                title="Video Call"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E4E8F7]/70 dark:bg-[#242D57] text-cyan-500 hover:bg-cyan-500 hover:text-white transition-all cursor-pointer"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#131B3E] rounded-3xl p-5 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">
                Add New Contact
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#9AA1C4] hover:text-[#0E1430] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sindi Ndlovu"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3.5 py-2.5 text-sm text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+27 82 000 0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3.5 py-2.5 text-sm text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-1 focus:ring-[#3B6BFA]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#3B6BFA] hover:bg-[#2453D6] text-white py-3 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer mt-4"
              >
                Save Contact
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
