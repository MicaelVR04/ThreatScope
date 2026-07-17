# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** ThreatScope
**Generated:** 2026-07-16 18:53:06
**Updated:** 2026-07-17 — replaced with the actual tokens from the finished, shipped landing page (`dashboard/src/pages/Landing.jsx` + `dashboard/src/components/landing/`). The original version of this file was a pre-build speculative spec (red/blue/green cyberpunk, Orbitron/JetBrains Mono) that the real build diverged from during iteration. This version reflects what actually shipped and is the source of truth for future theme work.
**Category:** Dark-mode security/ops tooling
**Design Dials:** Variance 6/10 (bold but restrained) | Motion 5/10 (present but sub-300ms everywhere) | Density 5/10 (Standard)

---

## Global Rules

### Color Palette

Defined in `dashboard/tailwind.config.js` under `theme.extend.colors`.

| Role | Hex / Value | Tailwind class | Notes |
|------|-----|--------------|-------|
| Base (page background) | `#070A0F` | `bg-base` | Near-black; tried lighter (#12141A) and textured variants, reverted both — this is canonical. |
| Surface | `#0D131B` | `bg-surface` | Cards, tiles, badges. |
| Surface 2 | `#121A24` | `bg-surface-2` | Hover state for surface elements. |
| Signal (accent/CTA) | `#2EEBD1` | `text-signal` / `bg-signal` | Teal. The single accent color — used for CTAs, active states, icons, focus rings. |
| Signal dim | `rgba(46,235,209,0.12)` | `bg-signal-dim` | Low-opacity signal fill, e.g. nav "LIVE SYSTEM" pill background. |
| Severity — High | `#EF4444` | `text-severity-high` | |
| Severity — Medium | `#F59E0B` | `text-severity-medium` | |
| Severity — Low | `#22C55E` | `text-severity-low` | |
| Ink (primary text) | `#F5F7FA` | `text-ink` | |
| Ink muted | `#8B96A5` | `text-ink-muted` | Body copy on dark background. |
| Ink faint | `#707C8C` | `text-ink-faint` | Smallest/least important text (e.g. step numbers). Measured 4.67:1 against `#070A0F` — clears WCAG AA. A darker `#4B5563` was tried and rejected at 2.62:1. |
| Border | `rgba(255,255,255,0.06–0.12)` | `border-white/[0.06]` etc. | No solid border color token — always white at low opacity, varies by emphasis (0.06 section dividers, 0.08 cards, 0.12 buttons). |

**Color notes:** One accent color only (signal teal). Severity colors exist purely for alert triage (high/medium/low), not used decoratively elsewhere. No red/blue/green cyberpunk palette — that was the pre-build direction and was abandoned during actual design work.

### Typography

- **Display font (headings):** Space Grotesk (500/600/700) — `font-display`
- **Body font:** IBM Plex Sans (400/500/600) — `font-sans`
- **Mono font (eyebrows, badges, stats, nav links):** IBM Plex Mono (400/500) — `font-mono`
- **Google Fonts import** (from `dashboard/index.html`):
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
```
- **Eyebrow label pattern:** `font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal` — used above every section heading (Hero, Capabilities, How It Works, Stack).
- Note: Space Grotesk / IBM Plex Sans / IBM Plex Mono are flagged as a "reflex-reject" combo by the Impeccable skill's brand-register check (an overused AI-generated-site default). Kept anyway after an audit pass because it fit the technical/precise tone — worth reconsidering for a future refresh, but do not silently swap fonts on new components without flagging it.

### Spacing

No custom spacing scale — uses Tailwind's default spacing scale directly (`px-6`, `py-24`, `gap-4`, etc.), not custom `--space-*` tokens. Section vertical rhythm: `py-16` to `py-32` depending on section weight (Hero largest, Capabilities/HowItWorks/Stats mid-range).

### Motion

Global rule in `dashboard/src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
This single global rule covers every animation/transition automatically — new components don't need their own reduced-motion opt-out, just don't fight it with inline duration overrides.

**House rule:** all hover/press interaction feedback is 150–300ms, `ease-swift` (`cubic-bezier(0.16, 1, 0.3, 1)`). Ambient/idle motion (float, radar-sweep, pulses) runs longer (4–7s) since it's decorative, not interactive feedback.

| Keyframe | Duration | Use |
|---|---|---|
| `fade-up` | 240ms, `ease-swift` | Section/element entrance |
| `pulse` | 1.4s ease-in-out infinite | Small live-status dot (nav "LIVE SYSTEM") |
| `float` | 7s ease-in-out infinite | Ambient glow drift (CTA background) |
| `radar-sweep` | 6s linear infinite | Hero radar rotation |
| `radar-ping` | 6s ease-out infinite (opacity-only) | Detection blips on radar sweep |
| `pipeline-pulse` | 4s ease-in-out infinite | Traveling dot along HowItWorks connector line |

**Known pitfall:** a CSS `animation` shorthand replaces an element's entire computed `transform` per frame — it cannot coexist with a static `translate`/`scale` utility on the same element. Fix: split into two nested elements (outer = static position, inner = animated), or make the keyframe opacity-only if centering must stay static (this is why `radar-ping` only animates opacity).

---

## Component Specs (as actually shipped)

### Buttons

Primary (signal-filled) — used for all CTAs ("Launch Dashboard" in nav/hero/CTA section):
```
bg-signal px-6 py-3 rounded-md font-display text-sm font-semibold text-base
transition-all duration-150 ease-swift
hover:scale-[1.02] hover:shadow-[0_0_28px_-4px_rgba(46,235,209,0.65)]
active:scale-[0.97]
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base
```
Secondary (outline) — used for "View on GitHub":
```
border border-white/[0.12] px-6 py-3 rounded-md font-mono text-sm text-ink-muted
transition-all duration-150 ease-swift
hover:border-signal/30 hover:text-signal
active:scale-[0.97]
```
Note: no magnetic-pull hover — tried and explicitly rejected ("I don't like how it feels"). Scale + shadow + active press-scale only.

### Cards / list rows

The landing page deliberately avoids a bordered-card grid (flagged by the Impeccable audit as a generic/"AI-tell" pattern). Capabilities uses a **divided list** instead:
```
divide pattern: border-t border-white/[0.08] on container, each row border-b border-white/[0.08] py-6
icon: text-signal, transition-transform duration-200 ease-swift, group-hover:rotate-6 group-hover:scale-110
```
Stat tiles (Stack section) do use a bordered box, since they're numeric callouts, not content cards:
```
rounded-xl border border-white/[0.08] bg-surface p-7
```

### Badges / tags

Tech-stack badges (Stack section):
```
rounded-full border border-white/[0.08] bg-surface px-3.5 py-1.5 font-mono text-xs text-ink-muted
transition-all duration-200 ease-swift
hover:scale-105 hover:border-signal/40 hover:bg-surface-2 hover:text-signal
```

### Focus states

Every interactive element: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base`.

---

## Anti-Patterns (confirmed rejected during the actual build — do not reintroduce)

- ❌ Bordered-card grids for content sections (use divided lists instead)
- ❌ Side-stripe borders (`border-l-2`/`border-r-2`) as decorative accents
- ❌ "Ghost-card" pattern (border + wide blur-shadow combined)
- ❌ Magnetic-pull button hover (rejected by explicit user feedback — feels wrong)
- ❌ Grid/dot texture background (rejected — "looked too much like a net")
- ❌ Lightened/glow-heavy background variant (#12141A + radial glows — reverted, canonical base stays `#070A0F`, plain, with only a very low-opacity noise-grain texture)
- ❌ Repeated uppercase eyebrow kickers as the *only* hierarchy signal — fine as a secondary label, not a substitute for real heading-size hierarchy

## Pre-Delivery Checklist

- [ ] No emojis used as icons — Lucide only (note: installed `lucide-react` lacks a `Github` icon; use `GitFork` instead)
- [ ] `cursor-pointer` / `cursor-default` set intentionally on every interactive vs. non-interactive element
- [ ] Hover/press transitions 150–300ms, `ease-swift`
- [ ] Text contrast ≥ 4.5:1 against whichever background token it sits on (verify — don't assume — especially over textured/gradient backgrounds)
- [ ] Focus-visible ring present on every interactive element
- [ ] `prefers-reduced-motion` respected (global rule already covers this — verify new animations don't override duration inline)
- [ ] Responsive at 375px, 768px, 1024px, 1440px, 1920px+
