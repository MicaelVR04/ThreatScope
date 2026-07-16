/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070A0F',
        surface: '#0D131B',
        'surface-2': '#121A24',
        signal: {
          DEFAULT: '#2EEBD1',
          dim: 'rgba(46, 235, 209, 0.12)',
        },
        severity: {
          high: '#EF4444',
          medium: '#F59E0B',
          low: '#22C55E',
        },
        ink: {
          DEFAULT: '#F5F7FA',
          muted: '#8B96A5',
          // Lighter than a typical "faint" gray — #4B5563 measured 2.62:1 against
          // the #070A0F base, well under WCAG AA's 4.5:1. This clears 4.67:1.
          faint: '#707C8C',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.5)' },
        },
      },
      animation: {
        'radar-sweep': 'radar-sweep 6s linear infinite',
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulse: 'pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
