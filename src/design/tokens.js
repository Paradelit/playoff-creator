/**
 * Pick&Coach design tokens. Single source of truth derived from `DESIGN.md`.
 *
 * Tailwind utilities still resolve via the project's `tailwind.config.js` (which
 * overrides `blue`, `amber`, and `orange` scales). Use these tokens in inline
 * `style={{ color: tokens.scoreClockBlue }}` cases where a Tailwind class would
 * be awkward (gradients, dynamic values, runtime-built CSS).
 */

export const tokens = {
  /* Primary — brand and Pick affordances */
  courtOrange: '#f97316',
  courtOrangeDeep: '#ea580c',
  clubOrange: '#FF8300',

  /* Secondary — in-app utility */
  scoreClockBlue: '#1A6FD4',
  scoreClockBlueDeep: '#1535A8',
  electricLineCyan: '#00F0FF',
  midnightElectric: '#0A0E27',

  /* Tertiary — reserved usage */
  trophyAmber: '#EFBF04',
  trophyAmberDeep: '#CC9F00',
  pickPurple: '#8B5CF6',

  /* Semantic */
  alertRed: '#DC2626',
  successGreen: '#10B981',
  rosePartido: '#F43F5E',

  /* Neutral — Ink (text) */
  ink900: '#0F172A',
  ink700: '#334155',
  ink600: '#475569',
  ink500: '#64748B',
  ink400: '#94A3B8',

  /* Neutral — Ash (surfaces) */
  ash200: '#E2E8F0',
  ash100: '#F1F5F9',
  ash50: '#F8FAFC',

  /* Surface anchors */
  surfaceWhite: '#FFFFFF',
  surfaceNight: '#06060F',
  surfaceNightSoft: '#0a0a18',
};

/**
 * Translucent versions for tints / borders / glows. Keeps the call sites readable.
 */
export const tints = {
  orangeFill: 'rgba(249,115,22,0.10)',
  orangeBorder: 'rgba(249,115,22,0.32)',
  orangeGlow: 'rgba(249,115,22,0.35)',
  cyanFill: 'rgba(26,111,212,0.08)',
  cyanBorder: 'rgba(26,111,212,0.30)',
  greenFill: 'rgba(16,185,129,0.10)',
  greenBorder: 'rgba(16,185,129,0.32)',
  amberFill: 'rgba(239,191,4,0.12)',
  amberBorder: 'rgba(239,191,4,0.42)',
  redFill: 'rgba(220,38,38,0.10)',
  redBorder: 'rgba(220,38,38,0.32)',
};

/**
 * The signature gradient used on every brand CTA. Imported here so changes
 * (rare, deliberate) cascade everywhere.
 */
export const gradients = {
  ctaBrand: 'linear-gradient(135deg, #f97316, #ea580c)',
  pickAvatar: 'linear-gradient(135deg, #f97316, #ea580c)',
  teamCardCyan: 'linear-gradient(135deg, #0C1440 0%, #0F1E6B 60%, #1535A8 100%)',
};
