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
        ink: { DEFAULT: '#F5F7FA', muted: '#8B96A5', faint: '#707C8C' },
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
      },
      animation: {
        'radar-sweep': 'radar-sweep 6s linear infinite',
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulse: 'pulse 1.4s ease-in-out infinite',
        'pipeline-pulse': 'pipeline-pulse 4s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'radar-ping': 'radar-ping 6s ease-out infinite',
        'drift-a': 'drift-a 22s ease-in-out infinite',
        'drift-b': 'drift-b 27s ease-in-out infinite',
        'drift-c': 'drift-c 19s ease-in-out infinite',
        shake: 'shake 400ms ease-in-out',
      },
    },
  },
  plugins: [],
}
