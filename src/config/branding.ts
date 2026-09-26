/**
 * ─────────────────────────────────────────────────────────────
 *  BRANDING & CUSTOMISATION — edit this file to re-brand the app
 * ─────────────────────────────────────────────────────────────
 * App name, colours, sponsored status cards and product constants all live here.
 * Colours are applied at runtime as CSS variables, so every screen updates at once
 * (Tailwind classes such as `bg-brand`, `text-accent`, `bg-navy-950` read them).
 */

export interface AccentPreset {
  id: string;
  name: string;
  brand: string; // primary buttons, links, own chat bubbles
  strong: string; // hover / pressed state
  soft: string; // light variant for rings & highlights
}

/** Accent colours users can pick in Settings → Appearance. The first is the default. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', name: 'Blue Chats', brand: '#3B6BFA', strong: '#2453D6', soft: '#6E8CFF' },
  { id: 'violet', name: 'Violet', brand: '#7C5CF0', strong: '#5F3FD6', soft: '#A48DF7' },
  { id: 'teal', name: 'Teal', brand: '#0FA3A3', strong: '#0B8080', soft: '#4CC9C9' },
  { id: 'emerald', name: 'Emerald', brand: '#16A36A', strong: '#0F7F52', soft: '#4CC993' },
  { id: 'rose', name: 'Rose', brand: '#E0457B', strong: '#C02C62', soft: '#F07AA3' },
  { id: 'sunset', name: 'Sunset', brand: '#E8752B', strong: '#C85A14', soft: '#F29F66' },
];

export interface SponsoredCard {
  id: string;
  sponsor: string;
  text: string;
  cta: string;
  /** Opened when the CTA is tapped. Cards without a URL show no button. */
  url?: string;
  bg: string;
}

export const BRANDING = {
  appName: 'Blue Chats',
  tagline: 'Chats, calls & stories — across Africa and the world',
  version: '3.0.0',

  /** Surface palette (headers, dark mode). Accent colours come from ACCENT_PRESETS. */
  colors: {
    accent: '#4DD8E8', // cyan highlight (online dots, badges)
    navy950: '#0B1330',
    navy900: '#101C42',
    navy800: '#152657',
    success: '#2FBE8F',
    gold: '#E8A23B',
  },

  /** Colours assigned to new users' default avatars. */
  avatarPalette: ['#3B6BFA', '#2453D6', '#8A6CF2', '#2FBE8F', '#E8A23B', '#E15B5B', '#0FA3A3', '#D9468F', '#4D7C0F'],

  /** Status background colours offered in the composer. */
  statusBackgrounds: ['#2453D6', '#8A6CF2', '#34B3A0', '#E8A23B', '#101C42', '#E15B5B', '#0B1330'],

  /** Link shared by "Invite to Blue Chats". Defaults to the current site origin. */
  inviteUrl: '',
  inviteMessage: (appName: string, url: string) =>
    `Let's chat on ${appName} — free messages, voice & video calls. Join me: ${url}`,

  /**
   * House / sponsored cards shown between status stories. Impressions and clicks
   * are counted in Firestore (`adStats`) and reported in the CEO dashboard.
   */
  sponsoredCards: [
    {
      id: 'bleushorts',
      sponsor: 'Bleushorts',
      text: 'Your shorts, movies & sounds — all in one app.',
      cta: 'Open Bleushorts',
      bg: '#101C42',
    },
  ] as SponsoredCard[],

  /** Used by the CEO dashboard to estimate revenue from sponsored-card analytics. */
  adRates: { currency: 'ZAR', cpm: 45, cpc: 2.5 },

  wallet: {
    /** Wallet features unlock when this many users have registered. */
    unlockGoal: 50_000,
  },
};
