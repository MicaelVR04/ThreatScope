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
        // A small glow traveling once per cycle along the HowItWorks connector
        // line, via background-position rather than left/transform — the line's
        // width is fluid (calc(100% - 3rem)), and background-position % is
        // relative to the container while transform % is relative to the dot
        // itself, so this is the only composited-friendly way to cover the
        // full fluid width without measuring it in JS.
        'pipeline-pulse': {
          '0%, 12%': { backgroundPosition: '0% 50%', opacity: '0' },
          '20%': { opacity: '1' },
          '78%': { opacity: '1' },
          '88%, 100%': { backgroundPosition: '100% 50%', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        // Opacity-only, deliberately — each dot also carries a static
        // -translate-x/y-1/2 centering transform, and a CSS `animation`
        // replaces an element's whole computed transform per frame, so a
        // transform here would fight that centering (same conflict already
        // hit once with the CTA glow's float animation).
        'radar-ping': {
          '0%': { opacity: '0' },
          '3%': { opacity: '1' },
          '9%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'radar-sweep': 'radar-sweep 6s linear infinite',
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulse: 'pulse 1.4s ease-in-out infinite',
        'pipeline-pulse': 'pipeline-pulse 4s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        // Duration matches radar-sweep's 6s exactly so each ping repeats in
        // sync with the sweep's rotation instead of drifting out of phase.
        'radar-ping': 'radar-ping 6s ease-out infinite',
      },
    },
  },
  plugins: [],
}
