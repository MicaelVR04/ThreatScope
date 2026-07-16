# ThreatScope Landing Page — Design

## Context

`dashboard/` is a React + Vite app with no landing page — `/` is currently the live
Dashboard itself, and there's no auth on this branch (`feature/dashboard`, a
pre-Supabase snapshot: axios + raw WebSocket, no login). The app has no Tailwind
installed; existing pages use inline `style={{}}` objects.

## Routing

Restructure `dashboard/src/App.jsx` into two layouts under one `BrowserRouter`:

- **Public layout** — `/` renders the new `Landing.jsx`, no app chrome.
- **App layout** — wraps `/dashboard` (existing `Dashboard.jsx`, moved off `/`) and
  `/history` (existing `AlertHistory.jsx`), keeps the current `Navbar`. Wrapped in a
  `RequireAuth` component that is a pure pass-through today (`return children`) —
  when auth is added later, that one component gets a real check and both routes
  are gated with no route-structure rework. `Navbar`'s link that currently points at
  `/` becomes `/dashboard`.

## Visual direction — "Signal Intelligence"

Deliberately overrides the ui-ux-pro-max auto-generated system (both runs defaulted
to Inter, and the second defaulted to Orbitron + neon/matrix-green — the security
equivalent of a generic purple-gradient SaaS template). Direction: precision
monitoring / real-time telemetry, not hacker-movie cosplay.

- **Colors:** base `#070A0F`, elevated surface `#0D131B`, signal-cyan accent
  `#2EEBD1`, hairline borders `rgba(255,255,255,.08)`. Severity red `#EF4444` /
  amber `#F59E0B` / green `#22C55E` are kept where they carry data meaning (feature
  icons, stat callouts) but are not used as brand color.
- **Type:** Space Grotesk (display/headings), IBM Plex Sans (body), IBM Plex Mono
  (labels, badges, timestamps, stat numerals).
- **Motion:** custom ease `cubic-bezier(0.16,1,0.3,1)`, ~240ms scroll reveals
  staggered ~50ms via a small IntersectionObserver hook (`useReveal.js`, no new
  animation library), ~160ms hover transitions, a slow (6s) low-opacity radar-sweep
  behind the hero, stat counters count up on scroll-into-view.
  `prefers-reduced-motion` disables transforms, keeps opacity-only fades.

## Sections & copy

1. **Hero** — kicker "REAL-TIME NETWORK INTRUSION DETECTION", headline "Nothing
   moves on your network unseen," subhead on capture → signature match →
   severity-classified alert. Primary CTA "Launch Dashboard" → `/dashboard`,
   secondary "See how it works" (scroll).
2. **Capabilities** (6 cards, grounded in actual code): Live Packet Capture
   (Scapy), Rule-Based Signature Detection, Severity Classification
   (HIGH/MEDIUM/LOW), Real-Time WebSocket Feed, Attack-Type Analytics, Full Alert
   History.
3. **How it works** — 5-step pipeline: Capture → Analyze → Classify → Alert →
   Visualize.
4. **Stats / proof** — verified facts only, no invented numbers: tech badges
   (Python/Scapy, FastAPI, WebSocket, React), "3 severity tiers," "push-based, zero
   polling," "fully logged history."
5. **CTA** — "Your network's next alert is one packet away." Launch Dashboard +
   GitHub link.
6. **Footer** — brand, nav, GitHub, "Built for Holberton School Demo Day."

## Implementation

- Add `tailwindcss`, `postcss`, `autoprefixer` as devDeps in `dashboard/`
  (currently not installed). New `tailwind.config.js` / `postcss.config.js` with
  the tokens above. Google Fonts `<link>` (Space Grotesk, IBM Plex Sans, IBM Plex
  Mono) added to `dashboard/index.html`.
- Existing dashboard pages (`Dashboard.jsx`, `AlertHistory.jsx`, `Navbar.jsx`, etc.)
  keep their inline styles untouched — Tailwind is additive and only used by the
  new landing files, so nothing about the current product UI changes visually.
- New files: `src/pages/Landing.jsx`,
  `src/components/landing/{LandingNav,Hero,Capabilities,HowItWorks,Stats,CTA,Footer}.jsx`,
  `src/hooks/useReveal.js`.
