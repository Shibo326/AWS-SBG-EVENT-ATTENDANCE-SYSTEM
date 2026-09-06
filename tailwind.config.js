/** @type {import('tailwindcss').Config} */

// ── Design direction ──────────────────────────────────────────────────────
// "Campus event, warm but credible." Deliberately NOT the generic AI look:
// no Inter/Sora, no cold navy + single-neon-accent, no arbitrary soft shadows.
//
//  • Type   — Space Grotesk (display, characterful) + Instrument Sans (body).
//  • Base   — warm ink (#12100E) on warm paper (#FBF7F0), not blue-black on white.
//  • Accent — one amber (AWS-adjacent) as the 10% accent; teal reserved *only*
//             for live / in-progress states so "something is happening now" reads
//             instantly. 60 paper / 30 ink+cards / 10 amber.
//  • Depth  — a single layered-elevation scale (e1..e3), applied consistently;
//             surfaces lift with light warm shadows, never mixed strategies.
// ──────────────────────────────────────────────────────────────────────────

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Base / structure
          ink: '#12100E',        // warm near-black — text & dark surfaces
          navy: '#1C1917',       // slightly lifted ink for bars/headers
          slate: '#3F3A34',      // secondary dark (kept name for compatibility)
          surface: '#FBF7F0',    // warm paper — the dominant 60%
          surfaceAlt: '#F3ECE1', // recessed paper (wells, table stripes)
          line: '#E7DFD2',       // warm hairline borders
          muted: '#78716C',      // muted body / captions (stone-500-ish)

          // Accent (the 10%)
          amber: '#F59E0B',
          amberDark: '#D97706',
          amberSoft: '#FEF3C7',  // tint for accent surfaces

          // Live / active state (reserved, not decorative)
          teal: '#0D9488',
          tealSoft: '#CCFBF1',

          // Semantic
          green: '#15803D',
          greenSoft: '#DCFCE7',
          amberWarn: '#B45309',
          red: '#B91C1C',
          redSoft: '#FEE2E2',

          // Dark-mode surfaces (warm, not pure gray) — used via dark: variants
          darkSurface: '#1C1917',  // page-level dark (matches navy)
          darkCard: '#292524',     // lifted card surface in dark
          darkLine: '#3F3A34',     // hairline in dark
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // one radius language: cards/inputs use xl (14px), pills use full
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        // layered elevation — warm-tinted, consistent light source (top-down)
        e1: '0 1px 2px rgba(18,16,14,0.05), 0 1px 3px rgba(18,16,14,0.06)',
        e2: '0 2px 4px rgba(18,16,14,0.05), 0 6px 16px rgba(18,16,14,0.08)',
        e3: '0 8px 24px rgba(18,16,14,0.10), 0 16px 48px rgba(18,16,14,0.12)',
        // focus ring companion for dark surfaces
        focus: '0 0 0 3px rgba(245,158,11,0.35)',
        // legacy alias so nothing breaks mid-migration
        card: '0 1px 2px rgba(18,16,14,0.05), 0 6px 16px rgba(18,16,14,0.08)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s ease-in-out infinite',
        rise: 'rise 240ms ease-out',
      },
    },
  },
  plugins: [],
}
