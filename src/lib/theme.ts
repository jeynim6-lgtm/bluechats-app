import { ACCENT_PRESETS, BRANDING, type AccentPreset } from '../config/branding';

const ACCENT_KEY = 'bluechats_accent';
const DARK_KEY = 'bluechats_dark';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — preference just won't persist */
  }
}

export function getAccentPreset(): AccentPreset {
  const id = safeGet(ACCENT_KEY);
  return ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0];
}

export function applyAccent(preset: AccentPreset) {
  const root = document.documentElement.style;
  root.setProperty('--color-brand', preset.brand);
  root.setProperty('--color-brand-strong', preset.strong);
  root.setProperty('--color-brand-soft', preset.soft);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BRANDING.colors.navy950);
}

export function setAccent(id: string) {
  const preset = ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0];
  safeSet(ACCENT_KEY, preset.id);
  applyAccent(preset);
}

export function getInitialDark(): boolean {
  const saved = safeGet(DARK_KEY);
  if (saved !== null) return saved === '1';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function applyDark(dark: boolean, persist = true) {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  if (persist) safeSet(DARK_KEY, dark ? '1' : '0');
}

/** Applies branding colours + saved preferences. Call once before first render. */
export function initTheme() {
  const root = document.documentElement.style;
  const c = BRANDING.colors;
  root.setProperty('--color-accent', c.accent);
  root.setProperty('--color-navy-950', c.navy950);
  root.setProperty('--color-navy-900', c.navy900);
  root.setProperty('--color-navy-800', c.navy800);
  root.setProperty('--color-success', c.success);
  root.setProperty('--color-gold', c.gold);
  applyAccent(getAccentPreset());
  applyDark(getInitialDark(), false);
  document.title = BRANDING.appName;
}
