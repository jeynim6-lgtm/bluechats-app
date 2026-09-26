import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users, Bug, Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, TrendingUp, Flag, Wallet } from 'lucide-react';
import { useMe } from '../context/AuthContext';
import { loadDashboard, runHealthCheck, logAdminAccess, setBugStatus, setReportStatus, type DashboardData } from '../services/admin';
import { formatRelative, formatLastSeen } from '../lib/format';
import { BRANDING } from '../config/branding';
import { Spinner, ErrorBanner, toast } from './ui';
import type { BugReport, HealthCheckResult } from '../types';

const HealthIcon: React.FC<{ status: string }> = ({ status }) =>
  status === 'healthy' ? (
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
  ) : status === 'degraded' ? (
    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
  ) : (
    <XCircle className="w-3.5 h-3.5 text-red-500" />
  );

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const me = useMe();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadDashboard());
    } catch (err) {
      setError(
        (err as { code?: string }).code === 'permission-denied'
          ? 'Firestore denied access. Make sure firestore.rules are deployed and your account has the "ceo" claim (sign out and in again after granting it).'
          : (err as Error).message
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void logAdminAccess(me.uid, 'view_dashboard');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const check = async () => {
    setChecking(true);
    try {
      setHealth(await runHealthCheck());
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const ads = useMemo(() => {
    const rows = [...(data?.adStats || [])].sort((a, b) => b.month.localeCompare(a.month));
    const { cpm, cpc, currency } = BRANDING.adRates;
    return rows.map((r) => ({
      ...r,
      ctr: r.impressions ? (r.clicks / r.impressions) * 100 : 0,
      estimate: (r.impressions / 1000) * cpm + r.clicks * cpc,
      currency,
      sponsor: BRANDING.sponsoredCards.find((c) => c.id === r.adId)?.sponsor || r.adId,
    }));
  }, [data?.adStats]);

  const users = (data?.users || []).filter((u) => `${u.name} ${u.phone || ''} ${u.country || ''}`.toLowerCase().includes(userQuery.toLowerCase()));

  const updateBug = async (bug: BugReport, status: BugReport['status']) => {
    try {
      await setBugStatus(bug.id, status);
      setData((d) => (d ? { ...d, bugReports: d.bugReports.map((b) => (b.id === bug.id ? { ...b, status } : b)) } : d));
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const card = 'bg-white dark:bg-night-card border border-line dark:border-night-line rounded-3xl p-5 shadow-xs space-y-3';
  const heading = 'font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider';

  return (
    <div className="pb-4 p-4 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-ink-soft dark:text-mist-soft hover:text-brand cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Claims verified
        </span>
      </div>

      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white rounded-3xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">CEO control panel</h1>
            <p className="text-[11px] text-mist-soft">Signed in as {me.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} aria-label="Reload" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={check} disabled={checking} className="px-3 py-2 rounded-xl bg-accent text-navy-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer">
              <Activity className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> Health
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-white/10 text-center">
          {[
            { label: 'Total users', value: data?.totalUsers, color: 'text-white' },
            { label: 'Active today', value: data?.activeToday, color: 'text-accent' },
            { label: 'Open bugs', value: data?.bugReports.filter((b) => b.status !== 'resolved').length, color: 'text-amber-400' },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 rounded-2xl p-2.5">
              <span className="text-[10px] text-mist-soft block">{m.label}</span>
              <span className={`text-base font-extrabold ${m.color}`}>{m.value === undefined ? '…' : m.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {!data && !error && (
        <div className="py-10 flex justify-center">
          <Spinner className="w-6 h-6" />
        </div>
      )}

      {health && (
        <div className={card}>
          <div className="flex items-center justify-between">
            <h3 className={heading}>
              <Activity className="w-4 h-4 text-brand" /> System health
            </h3>
            <span className="text-[9px] text-ink-faint">{new Date(health.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            {(['auth', 'firestore', 'bunny', 'webrtc', 'server'] as const).map((key) => (
              <div key={key} className="p-2.5 rounded-xl bg-paper dark:bg-night flex items-start gap-2">
                <HealthIcon status={health[key].status} />
                <div>
                  <span className="font-bold text-[11px] capitalize">{key === 'bunny' ? 'Bunny.net storage' : key === 'webrtc' ? 'Calls (WebRTC)' : key}</span>
                  <p className="text-[10px] text-ink-soft dark:text-mist-soft">{health[key].message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={heading}>
                <Users className="w-4 h-4 text-brand" /> Newest users
              </h3>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Filter…"
                className="w-28 bg-paper dark:bg-night border border-line dark:border-night-line rounded-lg px-2 py-1 text-[11px] focus:outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line dark:border-night-line text-ink-faint text-[10px] uppercase">
                    <th className="pb-2">User</th>
                    <th className="pb-2">Country</th>
                    <th className="pb-2 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 dark:divide-night-line/60">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-2 pr-2">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-[10px] text-ink-soft dark:text-mist-soft">{u.phone || '—'} · {formatLastSeen(u.lastSeen)}</div>
                      </td>
                      <td className="py-2 text-ink-soft dark:text-mist-soft">{u.country || '—'}</td>
                      <td className="py-2 text-[10px] text-ink-faint text-right">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <h3 className={heading}>
              <TrendingUp className="w-4 h-4 text-success" /> Sponsored status cards
            </h3>
            <p className="text-[10px] text-ink-faint">
              Real impressions & clicks. Revenue is an estimate at {BRANDING.adRates.currency} {BRANDING.adRates.cpm} CPM + {BRANDING.adRates.cpc} per click (set in
              branding config).
            </p>
            {ads.length === 0 ? (
              <p className="text-xs text-ink-faint text-center py-3">No sponsored impressions recorded yet</p>
            ) : (
              ads.map((a) => (
                <div key={a.id} className="p-3 rounded-2xl bg-paper dark:bg-night flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs">
                      {a.sponsor} · {a.month}
                    </span>
                    <span className="text-[10px] text-ink-faint block">
                      {a.impressions.toLocaleString()} views · {a.clicks.toLocaleString()} clicks · {a.ctr.toFixed(1)}% CTR
                    </span>
                  </div>
                  <span className="font-extrabold text-sm text-success">
                    {a.currency} {a.estimate.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className={card}>
            <h3 className={heading}>
              <Bug className="w-4 h-4 text-red-500" /> Bug reports ({data.bugReports.length})
            </h3>
            {data.bugReports.length === 0 ? (
              <p className="text-xs text-ink-faint text-center py-3">No bug reports</p>
            ) : (
              data.bugReports.map((b) => (
                <div key={b.id} className="p-3.5 rounded-2xl bg-paper dark:bg-night space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{b.screen}</span>
                    <span className="text-[9px] text-ink-faint">{formatRelative(b.createdAt)}</span>
                  </div>
                  <p className="text-xs text-ink-soft dark:text-mist-soft leading-relaxed whitespace-pre-wrap">{b.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-ink-faint pt-1">
                    <span className="truncate">
                      {b.userName} {b.userEmail ? `· ${b.userEmail}` : ''} · {b.appVersion}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => updateBug(b, e.target.value as BugReport['status'])}
                      className="bg-white dark:bg-night-card border border-line dark:border-night-line rounded-lg px-1.5 py-0.5 text-[10px] font-bold"
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={card}>
            <h3 className={heading}>
              <Flag className="w-4 h-4 text-red-500" /> User reports ({data.reports.filter((r) => r.status === 'open').length} open)
            </h3>
            {data.reports.length === 0 ? (
              <p className="text-xs text-ink-faint text-center py-3">No user reports</p>
            ) : (
              data.reports.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl bg-paper dark:bg-night flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold">{r.targetName}</span> — {r.reason}
                    <span className="block text-[10px] text-ink-faint">
                      by {r.reporterName || r.reporterId} · {formatRelative(r.createdAt)}
                    </span>
                  </div>
                  {r.status === 'open' ? (
                    <button
                      onClick={() =>
                        setReportStatus(r.id, 'reviewed')
                          .then(() => setData((d) => (d ? { ...d, reports: d.reports.map((x) => (x.id === r.id ? { ...x, status: 'reviewed' } : x)) } : d)))
                          .catch((err) => toast(err.message))
                      }
                      className="px-2.5 py-1 rounded-lg bg-brand text-white text-[10px] font-bold cursor-pointer flex-shrink-0"
                    >
                      Mark reviewed
                    </button>
                  ) : (
                    <span className="text-[10px] text-success font-bold">Reviewed</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className={card}>
            <h3 className={heading}>
              <Wallet className="w-4 h-4 text-brand" /> Wallet pre-registrations ({data.walletApplicants.length})
            </h3>
            {data.walletApplicants.length === 0 ? (
              <p className="text-xs text-ink-faint text-center py-3">No pre-registrations yet</p>
            ) : (
              data.walletApplicants.map((w) => (
                <div key={w.uid} className="flex items-center justify-between text-xs py-1">
                  <span className="font-semibold truncate">{w.name}</span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {w.docType} · {w.docNumberMasked}
                  </span>
                </div>
              ))
            )}
          </div>

          <p className="text-center text-[10px] text-ink-faint">Dashboard access is recorded in the adminAccessLog collection.</p>
        </>
      )}
    </div>
  );
};
