/**
 * In-app sounds (generated with Web Audio — no audio files to host) and
 * system notifications for when the tab is in the background.
 */

const PREFS_KEY = 'bluechats_notify_prefs';

export interface NotifyPrefs {
  sounds: boolean;
  notifications: boolean;
}

export function getNotifyPrefs(): NotifyPrefs {
  try {
    return { sounds: true, notifications: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { sounds: true, notifications: true };
  }
}

export function setNotifyPrefs(prefs: NotifyPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Browsers only allow audio after a user gesture; call this from any click to unlock it early. */
export function unlockAudio() {
  audio();
}

function tone(freq: number, start: number, duration: number, gain = 0.08, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

export function playMessageSound() {
  if (!getNotifyPrefs().sounds) return;
  tone(880, 0, 0.12, 0.06);
  tone(1320, 0.09, 0.16, 0.05);
}

/** Starts a repeating tone; returns a stop function. */
function loop(pattern: () => void, everyMs: number): () => void {
  pattern();
  const id = window.setInterval(pattern, everyMs);
  return () => window.clearInterval(id);
}

/** Incoming-call ringtone (plays even if message sounds are off — calls must be audible). */
export function startRingtone(): () => void {
  const stopVibrate = () => navigator.vibrate?.(0);
  const stop = loop(() => {
    tone(740, 0, 0.35, 0.09, 'triangle');
    tone(988, 0.4, 0.35, 0.09, 'triangle');
    navigator.vibrate?.([400, 200, 400]);
  }, 2400);
  return () => {
    stop();
    stopVibrate();
  };
}

/** Outgoing "ringback" tone heard by the caller while the other phone rings. */
export function startRingback(): () => void {
  return loop(() => {
    tone(440, 0, 0.9, 0.035);
    tone(480, 0, 0.9, 0.035);
  }, 3000);
}

export function playHangupSound() {
  tone(480, 0, 0.18, 0.05);
  tone(360, 0.2, 0.25, 0.05);
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/** Shows a system notification only while the app is in the background. */
export function showSystemNotification(title: string, body: string, onClick?: () => void, tag?: string) {
  if (!getNotifyPrefs().notifications) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    const n = new Notification(title, { body, tag, icon: '/icon.svg' });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}
