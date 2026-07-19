/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070A0F',
        surface: '#0D131B',
        'surface-2': '#121A24',
        signal: { DEFAULT: '#2EEBD1', dim: 'rgba(46, 235, 209, 0.12)' },
        severity: { high: '#EF4444', medium: '#F59E0B', low: '#22C55E' },
        // faint nudged from #707C8C — that measured 4.40:1 against the
        // surface background, just under the 4.5:1 AA minimum for normal
        // text; +2 per channel clears it (4.52:1) with no visible change.
        ink: { DEFAULT: '#F5F7FA', muted: '#8B96A5', faint: '#727E8E' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      transitionTimingFunction: { swift: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        'radar-sweep': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulse: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(1.5)' } },
        'pipeline-pulse': {
          '0%, 12%': { backgroundPosition: '0% 50%', opacity: '0' },
          '20%': { opacity: '1' },
          '78%': { opacity: '1' },
          '88%, 100%': { backgroundPosition: '100% 50%', opacity: '0' },
        },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-14px)' } },
        'radar-ping': { '0%': { opacity: '0' }, '3%': { opacity: '1' }, '9%, 100%': { opacity: '0' } },
        // One-shot error feedback — not infinite, replays via a `key` change
        // on the element (React remounts it, which restarts the animation).
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(3px)' },
        },
        // Three distinct irregular loop paths for ambient background blobs.
        // Each keyframe stop sets BOTH x and y together (not one axis at a
        // time) so every leg of the path is inherently diagonal — combining
        // two independent single-axis animations (the previous approach)
        // reads as mechanical because each axis still moves in a straight
        // line on its own; a single animation with explicit diagonal
        // waypoints doesn't have that failure mode. Each blob has its own
        // shape and duration (22s/27s/19s — no short common multiple) so
        // none of the three ever move in sync or trace the same path.
        'drift-a': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(10vw, -8vh)' },
          '45%': { transform: 'translate(4vw, -18vh)' },
          '70%': { transform: 'translate(-12vw, -6vh)' },
          '88%': { transform: 'translate(-5vw, 9vh)' },
        },
        'drift-b': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '18%': { transform: 'translate(-9vw, 10vh)' },
          '40%': { transform: 'translate(-16vw, -4vh)' },
          '65%': { transform: 'translate(-3vw, -14vh)' },
          '85%': { transform: 'translate(9vw, -3vh)' },
        },
        'drift-c': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '22%': { transform: 'translate(7vw, 12vh)' },
          '48%': { transform: 'translate(-8vw, 16vh)' },
          '72%': { transform: 'translate(6vw, 2vh)' },
          '90%': { transform: 'translate(-4vw, -10vh)' },
        },
        // Decaying arrival flash for newly-received alerts, now a background
        // tint (not a box-shadow) since the terminal-line feed has no card
        // edge for a glow to bloom around — one shot per severity color.
        'line-flash-high':   { '0%': { backgroundColor: 'rgba(239,68,68,0.18)' },  '100%': { backgroundColor: 'rgba(239,68,68,0)' } },
        'line-flash-medium': { '0%': { backgroundColor: 'rgba(245,158,11,0.18)' }, '100%': { backgroundColor: 'rgba(245,158,11,0)' } },
        'line-flash-low':    { '0%': { backgroundColor: 'rgba(34,197,94,0.18)' },  '100%': { backgroundColor: 'rgba(34,197,94,0)' } },
        // Slow opacity blink for the "live" eyebrow dot — same idea as a
        // terminal cursor, not tied to any state, purely "this is live."
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        // Concentric rings expanding + fading behind the hero status —
        // staggered via animation-delay on each ring (inline style, same
        // technique as the radar detection pings), not separate keyframes.
        'ring-pulse': { '0%': { transform: 'scale(0.9)', opacity: '0.5' }, '100%': { transform: 'scale(1.5)', opacity: '0' } },
        // Page-level ambient wash — exact values from the mock: opacity
        // 0.06-0.12, scale 1-1.08, nothing more dramatic.
        breathe: { '0%, 100%': { opacity: '0.06', transform: 'scale(1)' }, '50%': { opacity: '0.12', transform: 'scale(1.08)' } },
        // Feed-line entrance — distinct from `fade-up` (12px/240ms): the
        // mock's terminal lines travel a shorter 4px over 300ms.
        'fl-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        // Ambient signal on the #1 ranked attack type only — ties motion to
        // a real state ("this is currently the most frequent threat") rather
        // than decorating every row equally.
        'bar-glow': { '0%, 100%': { boxShadow: '0 0 0px rgba(46,235,209,0)' }, '50%': { boxShadow: '0 0 8px rgba(46,235,209,0.45)' } },
      },
      animation: {
        'radar-sweep': 'radar-sweep 6s linear infinite',
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulse: 'pulse 1.4s ease-in-out infinite',
        // Same pulse keyframe, calmer cadence — for ambient state glows that
        // shouldn't compete with the faster pulse used for active processes.
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'pipeline-pulse': 'pipeline-pulse 4s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'radar-ping': 'radar-ping 6s ease-out infinite',
        'drift-a': 'drift-a 22s ease-in-out infinite',
        'drift-b': 'drift-b 27s ease-in-out infinite',
        'drift-c': 'drift-c 19s ease-in-out infinite',
        shake: 'shake 400ms ease-in-out',
        'line-flash-high': 'line-flash-high 1400ms ease-out',
        'line-flash-medium': 'line-flash-medium 1400ms ease-out',
        'line-flash-low': 'line-flash-low 1400ms ease-out',
        blink: 'blink 1.6s ease-in-out infinite',
        // Same blink keyframe, two more cadences the mock uses for different
        // elements — a terminal cursor (hard steps, no easing) and the
        // feed's "connected" dot (slightly faster than the hero eyebrow).
        'cursor-blink': 'blink 1s steps(1) infinite',
        'live-blink': 'blink 1.4s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 3.2s ease-out infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        'fl-in': 'fl-in 300ms cubic-bezier(0.16,1,0.3,1) forwards',
        'bar-glow': 'bar-glow 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
