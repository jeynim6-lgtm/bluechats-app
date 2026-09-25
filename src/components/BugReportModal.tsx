import React, { useState } from 'react';
import { X, Bug, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { BugReport } from '../types';

interface BugReportModalProps {
  currentUserId: string;
  currentUserEmail?: string;
  currentUserName?: string;
  defaultScreen?: string;
  onClose: () => void;
  onSubmitted?: (report: BugReport) => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  currentUserId,
  currentUserEmail,
  currentUserName,
  defaultScreen = 'Settings',
  onClose,
  onSubmitted,
}) => {
  const [description, setDescription] = useState('');
  const [screen, setScreen] = useState(defaultScreen);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const screensList = [
    'Chats / Messages',
    'Discover Feed',
    'Status Stories',
    'Voice / Video Calls',
    'Wallet Screen',
    'Settings / Profile',
    'Camera / Media Upload',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Please enter a description of the issue');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        uid: currentUserId,
        userEmail: currentUserEmail || 'user@bluechats.com',
        userName: currentUserName || 'Blue Chats User',
        description: description.trim(),
        screen,
        appVersion: 'v2.4.0',
      };

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');

      setSuccess(true);
      if (onSubmitted && data.report) {
        onSubmitted(data.report);
      }
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131B3E] border border-[#E4E8F7] dark:border-[#242D57] rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#9AA1C4] hover:text-[#0E1430] dark:hover:text-white p-1 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">Report a Bug</h2>
            <p className="text-[11px] text-[#5A6182] dark:text-[#AEB4DA]">
              Logs directly to the CEO &amp; engineering dashboard
            </p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-[#0E1430] dark:text-[#EEF1FF]">
              Report Submitted!
            </h3>
            <p className="text-xs text-[#5A6182] dark:text-[#AEB4DA] max-w-xs mx-auto">
              Thank you for keeping Blue Chats reliable. Our team will review the diagnostic telemetry.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Which screen had the issue?
              </label>
              <select
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0E1430] dark:text-[#EEF1FF] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              >
                {screensList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5A6182] dark:text-[#AEB4DA] uppercase tracking-wider mb-1.5">
                Describe what happened
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What went wrong? Steps to reproduce..."
                className="w-full bg-[#F4F6FC] dark:bg-[#0B1130] border border-[#E4E8F7] dark:border-[#242D57] rounded-xl p-3 text-xs text-[#0E1430] dark:text-[#EEF1FF] placeholder-[#9AA1C4] focus:outline-none focus:ring-2 focus:ring-[#3B6BFA]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E4E8F7] dark:border-[#242D57] text-[#5A6182] dark:text-[#AEB4DA] text-xs font-semibold hover:bg-black/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
