# Web Design Task 1 — Foundation

Design system, responsive architecture, navigation, and the client/server split for the Next.js web
client in `apps/web`.

Companion pieces: [`docs/PRD.md`](../PRD.md) §10 (web stack), and the Android design set in
[`docs/design/`](../design/). Visual reference:
`canvases/web-design-foundation.canvas.tsx`.

**This document does not invent a new visual language.** The colour, type, and motion decisions were
settled for Android in [`docs/design/01-foundation.md`](../design/01-foundation.md) and are ported
here unchanged, because one product with two clients that look like siblings is worth more than two
clients that each look locally optimal. What this document *does* decide is everything the Android
document had no reason to consider: breakpoints, layout shells, hover and focus states, pointer
affordances, keyboard navigation, where the server ends and the browser begins, and how a JWT that
arrives in a JSON response body becomes a session a Next.js middleware can trust.

---

## 1. Stack

The PRD names Next.js, TypeScript, Tailwind, React Query, and Zustand. That holds, with the
specifics filled in.

| Concern | Choice | Why this and not the obvious alternative |
|---|---|---|
| Framework | Next.js, **App Router** | Server Components let the authenticated shell render with the companion already in it, rather than flashing a skeleton on every navigation |
| Language | TypeScript, `strict` | — |
| Styling | **Tailwind CSS v4**, CSS-first `@theme` | v4 defines the palette as real CSS custom properties, so the same tokens are available to Tailwind utilities *and* to hand-written CSS *and* to the canvas previews. A v3 JS config would fork the palette into a place CSS cannot read. |
| Components | **shadcn/ui** (Radix primitives, vendored) | Radix gets focus traps, roving tabindex, and `aria-*` wiring right — the parts of a component library that are expensive to build and invisible when correct. Vendored rather than installed, so restyling to mulberry is editing our own files. |
| Server data | **TanStack Query v5** | — |
| Client state | **Zustand** | Only for composer drafts, the onboarding wizard, and UI preferences. Server data never goes in Zustand; that is what Query's cache is for. |
| Forms | **react-hook-form** + **zod** | The zod schemas mirror the Nest DTOs and are the single source of client validation (§9 of [`02-authentication.md`](./02-authentication.md)) |
| Icons | **Lucide** | Matches the outline/filled pairing the navigation needs |
| Audio | `MediaRecorder` + `<audio>` | No library. Voice is one record and one playback; Media3's web equivalents are all heavier than the requirement. |
| Tests | Vitest + Testing Library, Playwright for the auth and chat flows | — |

Pin exact versions at install time and record them here. Everything below assumes Tailwind v4
`@theme` syntax; if the project lands on v3, the palette moves to `tailwind.config.ts` and §2.5 is
rewritten.

### 1.1 Directory layout

The PRD's proposed structure, with route groups made explicit:

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (public)/            landing, login, signup, forgot, reset
│   │   ├── (onboarding)/        onboarding/*
│   │   ├── (app)/               home, chat/*, memory/*, companion/*, account/*
│   │   ├── api/bff/             route handlers — the only thing that talks to Nest (§7)
│   │   ├── layout.tsx           <html>, fonts, theme script
│   │   ├── error.tsx            root error boundary
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                  vendored shadcn primitives
│   │   ├── chat/ companion/ memory/ voice/ shared/
│   ├── features/                auth, chat, companion, memory, subscription
│   ├── lib/                     api client, sse, cookies, jwt, utils
│   ├── hooks/ stores/ types/
│   └── styles/globals.css       @theme block lives here
└── middleware.ts                route protection (§7.4)
```

Three route groups, three layout shells (§4). The grouping is not cosmetic — each group has a
genuinely different chrome, and putting them in one layout with conditional rendering is how a
sidebar ends up briefly visible on the login page.

---

## 2. Colour

### 2.1 Palette

Identical to Android: four tonal ramps at Material 3 tone stops. Light theme draws accents from tone
40, dark from tone 80. The full ramps are tabulated in
[`docs/design/01-foundation.md`](../design/01-foundation.md) §2.1 and are not duplicated here — the
ramps are one artifact with two consumers, and copying them into a second document guarantees they
drift.

The five anchors, for orientation:

| Ramp | Role | Light accent | Dark accent |
|---|---|---|---|
| Mulberry | `primary` — brand, CTAs, outgoing messages | `#932D5E` | `#E7B7CA` |
| Champagne | `secondary` — premium, subscription, active nav | `#786224` | `#E6D091` |
| Dusk Violet | `tertiary` — memory and AI-derived surfaces | `#6D3D91` | `#D6B8E8` |
| Warm Neutral | surfaces and text, mauve-cast never grey | `#FEF7F9` / `#1C171A` | `#141013` / `#E9DAE1` |
| Neutral Variant | outlines | `#7E7280` | `#988B99` |

The three visual rules carry over verbatim and are worth restating because they are what keep thirty
screens coherent: **warmth without pink**, **the companion is the accent** (saturated colour only on
her avatar, her messages, and the one primary action per screen), and **restraint reads as premium**.

### 2.2 Two token layers

Web needs a layer Android does not: shadcn/ui components are written against *its* token names
(`--background`, `--card`, `--muted`, `--accent`, `--ring`), and Radix-based components will
reference those names whether we like it or not.

Rather than rename either vocabulary, the M3 role names are the **source of truth** and the shadcn
names are **aliases pointing at them**. One palette, two spellings, no synchronisation problem.

| shadcn token | Aliases M3 role | Note |
|---|---|---|
| `--background` | `--surface` | |
| `--foreground` | `--on-surface` | |
| `--card` | `--surface-container-low` | shadcn's flat `--card` becomes our level-1 tonal surface |
| `--card-foreground` | `--on-surface` | |
| `--popover` | `--surface-container-high` | level 3, matching dialogs and sheets |
| `--muted` | `--surface-container` | |
| `--muted-foreground` | `--on-surface-variant` | |
| `--primary` / `--primary-foreground` | `--primary` / `--on-primary` | identical |
| `--secondary` | `--secondary-container` | shadcn uses `secondary` for *quiet button fills*, which is our container, not our accent |
| `--accent` | `--surface-container-high` | shadcn's `accent` is a **hover surface**, not a brand colour. Mapping brand mulberry here would tint every hovered menu item. |
| `--destructive` | `--error` | |
| `--border` | `--outline-variant` | |
| `--input` | `--outline-variant` | |
| `--ring` | `--primary` | see §3.3 |

The `--accent` row is the one that goes wrong. Its name invites you to put the brand colour in it,
and the result is a dropdown whose every hovered row flashes mulberry. It is a state surface.

### 2.3 Extension tokens

M3 has no slot for success, warning, or chat bubbles. On Android these ride in a `CompanionColors`
class; on web they are simply more custom properties, which is easier.

| Token | Light | Dark |
|---|---|---|
| `--success` / `--success-container` / `--on-success-container` | `#2E6B4F` / `#CBEBD9` / `#0B2418` | `#96D8B4` / `#1E4F35` / `#B9E9CE` |
| `--warning` / `--warning-container` / `--on-warning-container` | `#8A5300` / `#FFDDB3` / `#2C1700` | `#FFB865` / `#6A3F00` / `#FFDDB3` |
| `--bubble-outgoing` / `--on-bubble-outgoing` | `#932D5E` / `#FFFFFF` | `#752049` / `#F5DCE6` |
| `--bubble-incoming` / `--on-bubble-incoming` | `#F4E7EC` / `#1C171A` | `#2B2429` / `#E9DAE1` |
| `--online-indicator` | `#2E6B4F` | `#96D8B4` |

### 2.4 Web-only state tokens

Android has no hover, no focus ring, and no text selection. These four are additions, not ports, and
they are the difference between a mobile design shown in a browser and a web design.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--state-hover` | `rgb(0 0 0 / 0.04)` | `rgb(255 255 255 / 0.06)` | Overlay on hoverable surfaces |
| `--state-pressed` | `rgb(0 0 0 / 0.08)` | `rgb(255 255 255 / 0.10)` | Active/pressed |
| `--focus-ring` | `#932D5E` | `#E7B7CA` | `:focus-visible` outline |
| `--selection` | `#F5DCE6` | `#752049` | `::selection` background |

**Hover is an overlay, not a second palette.** Defining a `--surface-container-low-hover` for every
surface doubles the token count and the two halves fall out of step within a month. A single
translucent overlay composited over whatever surface is underneath handles all of them, and it
degrades correctly on surfaces this design has not invented yet.

### 2.5 `globals.css`

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* ── Mulberry ─────────────────────────────────────── */
  --mulberry-10: #3b0b21; --mulberry-20: #571435;
  --mulberry-30: #752049; --mulberry-40: #932d5e;
  --mulberry-80: #e7b7ca; --mulberry-90: #f5dce6;

  /* ── Champagne ────────────────────────────────────── */
  --champagne-10: #2a1e05; --champagne-20: #43330e;
  --champagne-30: #5d4a19; --champagne-40: #786224;
  --champagne-80: #e6d091; --champagne-90: #f5e9c4;

  /* ── Dusk Violet ──────────────────────────────────── */
  --dusk-10: #25103a; --dusk-20: #3c1e56;
  --dusk-30: #542c73; --dusk-40: #6d3d91;
  --dusk-80: #d6b8e8; --dusk-90: #eddcf6;

  /* ── Warm neutral / neutral variant ───────────────── */
  --n-6: #141013;  --n-10: #1c171a; --n-12: #211b1f; --n-17: #2b2429;
  --n-20: #312a2f; --n-22: #362e34; --n-90: #e9dae1; --n-94: #f4e7ec;
  --n-95: #f7eaef; --n-96: #faedf2; --n-98: #fef7f9;
  --n-lowest-dark: #0e0b0d; --n-high-light: #efe1e7;
  --nv-30: #4c424a; --nv-50: #7e7280; --nv-60: #988b99;
  --nv-80: #d0c2ce; --nv-90: #eddeea;

  /* ── M3 roles — light (source of truth) ───────────── */
  --primary: var(--mulberry-40);        --on-primary: #ffffff;
  --primary-container: var(--mulberry-90);
  --on-primary-container: var(--mulberry-10);
  --inverse-primary: var(--mulberry-80);

  --secondary: var(--champagne-40);     --on-secondary: #ffffff;
  --secondary-container: var(--champagne-90);
  --on-secondary-container: var(--champagne-10);

  --tertiary: var(--dusk-40);           --on-tertiary: #ffffff;
  --tertiary-container: var(--dusk-90);
  --on-tertiary-container: var(--dusk-10);

  --surface: var(--n-98);               --on-surface: var(--n-10);
  --surface-container-lowest: #ffffff;
  --surface-container-low: var(--n-96);
  --surface-container: var(--n-94);
  --surface-container-high: var(--n-high-light);
  --surface-container-highest: var(--n-90);
  --surface-variant: var(--nv-90);      --on-surface-variant: var(--nv-30);

  --outline: var(--nv-50);              --outline-variant: var(--nv-80);
  --inverse-surface: var(--n-20);       --inverse-on-surface: var(--n-95);

  --error: #b3261e;                     --on-error: #ffffff;
  --error-container: #f9dedc;           --on-error-container: #410e0b;
  --success: #2e6b4f;
  --success-container: #cbebd9;         --on-success-container: #0b2418;
  --warning: #8a5300;
  --warning-container: #ffddb3;         --on-warning-container: #2c1700;

  --bubble-outgoing: var(--mulberry-40); --on-bubble-outgoing: #ffffff;
  --bubble-incoming: var(--n-94);        --on-bubble-incoming: var(--n-10);
  --online-indicator: var(--success);

  --state-hover: rgb(0 0 0 / 0.04);
  --state-pressed: rgb(0 0 0 / 0.08);
  --focus-ring: var(--primary);
  --selection: var(--mulberry-90);
}

.dark {
  --primary: var(--mulberry-80);        --on-primary: var(--mulberry-20);
  --primary-container: var(--mulberry-30);
  --on-primary-container: var(--mulberry-90);
  --inverse-primary: var(--mulberry-40);

  --secondary: var(--champagne-80);     --on-secondary: var(--champagne-20);
  --secondary-container: var(--champagne-30);
  --on-secondary-container: var(--champagne-90);

  --tertiary: var(--dusk-80);           --on-tertiary: var(--dusk-20);
  --tertiary-container: var(--dusk-30);
  --on-tertiary-container: var(--dusk-90);

  --surface: var(--n-6);                --on-surface: var(--n-90);
  --surface-container-lowest: var(--n-lowest-dark);
  --surface-container-low: var(--n-10);
  --surface-container: var(--n-12);
  --surface-container-high: var(--n-17);
  --surface-container-highest: var(--n-22);
  --surface-variant: var(--nv-30);      --on-surface-variant: var(--nv-80);

  --outline: var(--nv-60);              --outline-variant: var(--nv-30);
  --inverse-surface: var(--n-90);       --inverse-on-surface: var(--n-20);

  --error: #f2b8b5;                     --on-error: #601410;
  --error-container: #8c1d18;           --on-error-container: #f9dedc;
  --success: #96d8b4;
  --success-container: #1e4f35;         --on-success-container: #b9e9ce;
  --warning: #ffb865;
  --warning-container: #6a3f00;         --on-warning-container: #ffddb3;

  --bubble-outgoing: var(--mulberry-30); --on-bubble-outgoing: var(--mulberry-90);
  --bubble-incoming: var(--n-17);        --on-bubble-incoming: var(--n-90);
  --online-indicator: var(--success);

  --state-hover: rgb(255 255 255 / 0.06);
  --state-pressed: rgb(255 255 255 / 0.10);
  --selection: var(--mulberry-30);
}

/* ── Tailwind utility generation + shadcn aliases ───── */
@theme inline {
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
  --color-primary-container: var(--primary-container);
  --color-on-primary-container: var(--on-primary-container);
  --color-secondary: var(--secondary);
  --color-secondary-container: var(--secondary-container);
  --color-on-secondary-container: var(--on-secondary-container);
  --color-tertiary: var(--tertiary);
  --color-tertiary-container: var(--tertiary-container);
  --color-on-tertiary-container: var(--on-tertiary-container);

  --color-surface: var(--surface);
  --color-on-surface: var(--on-surface);
  --color-surface-container-lowest: var(--surface-container-lowest);
  --color-surface-container-low: var(--surface-container-low);
  --color-surface-container: var(--surface-container);
  --color-surface-container-high: var(--surface-container-high);
  --color-surface-container-highest: var(--surface-container-highest);
  --color-on-surface-variant: var(--on-surface-variant);
  --color-outline: var(--outline);
  --color-outline-variant: var(--outline-variant);

  --color-error: var(--error);
  --color-error-container: var(--error-container);
  --color-success: var(--success);
  --color-success-container: var(--success-container);
  --color-warning: var(--warning);
  --color-warning-container: var(--warning-container);
  --color-bubble-outgoing: var(--bubble-outgoing);
  --color-bubble-incoming: var(--bubble-incoming);

  /* shadcn aliases — see §2.2 */
  --color-background: var(--surface);
  --color-foreground: var(--on-surface);
  --color-card: var(--surface-container-low);
  --color-popover: var(--surface-container-high);
  --color-muted: var(--surface-container);
  --color-muted-foreground: var(--on-surface-variant);
  --color-accent: var(--surface-container-high);
  --color-destructive: var(--error);
  --color-border: var(--outline-variant);
  --color-input: var(--outline-variant);
  --color-ring: var(--focus-ring);

  --font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;

  --radius-xs: 0.5rem;  --radius-sm: 0.75rem; --radius-md: 1rem;
  --radius-lg: 1.25rem; --radius-xl: 1.75rem;
}

::selection { background: var(--selection); color: var(--on-surface); }

/* Chrome paints its own autofill background and ignores background-color.
   An inset shadow is the only thing that overrides it. */
input:-webkit-autofill,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--on-surface);
  box-shadow: 0 0 0 1000px var(--surface-container-low) inset;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 2.6 Theme switching

`class` strategy on `<html>`, three user-facing options: light, dark, system.

Two hard requirements, both of which are the sort of thing that gets discovered in review rather than
in design:

**No flash of the wrong theme.** The class must be on `<html>` before first paint, which means a
small blocking inline script in the root layout reading `localStorage` and
`matchMedia('(prefers-color-scheme: dark)')`. There is no way to do this in React — any component,
server or client, runs after the document starts painting. `next-themes` does exactly this and is
worth the dependency.

**`color-scheme` must be set** (`:root { color-scheme: light }` / `.dark { color-scheme: dark }`) or
the browser renders native scrollbars, form controls, and the `<html>` background canvas in light
colours inside a dark app.

**Dynamic colour stays off**, as on Android. A companion whose accent shifts with the OS accent stops
feeling like a specific person.

### 2.7 Contrast

The verified WCAG table in [`docs/design/01-foundation.md`](../design/01-foundation.md) §2.4 applies
unchanged, since the pairs are the same. Three web-only pairs to add:

| Pair | Light | Dark | Requirement |
|---|---|---|---|
| `--focus-ring` on `--surface` | 5.9:1 | 8.4:1 | ≥3:1 for non-text (WCAG 1.4.11) |
| `--focus-ring` on `--surface-container-low` | 5.6:1 | 7.9:1 | ≥3:1 |
| `--outline-variant` on `--surface` | 1.4:1 | 1.6:1 | **Decorative only** |

That last row is a constraint, not a pass: `--outline-variant` is deliberately below 3:1 because it
is a hairline separator. It must never be the only indication of an input's boundary — which is why
text fields at rest use a 1px `--outline-variant` stroke **plus** a filled
`--surface-container-low` background, and the fill is what makes them perceivable.

---

## 3. Typography

### 3.1 Faces

**Plus Jakarta Sans** for all UI, **Fraunces Light** for display. Same two faces as Android, loaded
through `next/font/google` so the CSS `@font-face` and the preload hints are generated at build time
and the fonts are self-hosted rather than fetched from Google's CDN.

```tsx
// app/layout.tsx
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jakarta",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300"],
  axes: ["SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});
```

**Fraunces is used in five places and nowhere else:** the landing hero, the wordmark, the companion's
name on Home, her name on the companion profile, and the "Meet Aria" finale. Android has four; web
adds the landing hero, which does not exist on mobile. A serif in exactly those moments is what stops
the product reading as another chat app; using it for section headings dilutes that to zero.

**`display: "swap"`, not `"optional"`.** The landing hero is Fraunces, and `optional` will silently
render it in Georgia on a slow first visit — on the one screen whose entire job is the first
impression.

### 3.2 Scale

Sizes in `rem` against a 16px root, so they scale with the browser's font-size setting. The Android
scale ports directly, with three web-specific rows.

| Token | Face | Size / Line | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| `display-hero` | Fraunces | `clamp(2.5rem, 6vw, 4.5rem)` / 1.05 | 300 | -0.02em | **Web only** — landing hero |
| `display-lg` | Fraunces | 2.5rem / 3rem | 300 | -0.02em | Wordmark, auth headline |
| `display-md` | Fraunces | 2rem / 2.5rem | 300 | -0.01em | Companion name |
| `display-sm` | Fraunces | 1.75rem / 2.25rem | 300 | 0 | Onboarding step headline |
| `headline-lg` | Jakarta | 1.75rem / 2.25rem | 600 | -0.015em | Empty-state headline |
| `headline-md` | Jakarta | 1.5rem / 2rem | 600 | -0.01em | Page title |
| `headline-sm` | Jakarta | 1.25rem / 1.75rem | 600 | -0.005em | Section heading |
| `title-lg` | Jakarta | 1.25rem / 1.75rem | 600 | -0.005em | Bar title |
| `title-md` | Jakarta | 1rem / 1.5rem | 600 | 0.006em | Row title, card title |
| `title-sm` | Jakarta | 0.875rem / 1.25rem | 600 | 0.006em | Overline, group label |
| `body-lg` | Jakarta | 1rem / 1.5rem | 400 | 0.009em | **Chat messages**, primary body |
| `body-md` | Jakarta | 0.875rem / 1.25rem | 400 | 0.012em | Secondary body, row subtitle |
| `body-sm` | Jakarta | 0.75rem / 1rem | 400 | 0.019em | Caption, timestamp, helper |
| `label-lg` | Jakarta | 0.9375rem / 1.25rem | 600 | 0.006em | Button text |
| `label-md` | Jakarta | 0.8125rem / 1rem | 600 | 0.019em | Chip, nav label |
| `label-sm` | Jakarta | 0.6875rem / 1rem | 500 | 0.025em | Badge |
| `mono-sm` | ui-monospace | 0.8125rem / 1.25rem | 400 | 0 | **Web only** — memory IDs, debug values |

Chat messages are `body-lg` at 16px. Do not shrink it. Message text is the single thing users read
most in this product, and 14px chat is the most common way a companion app feels cheap.

**`display-hero` is the only fluid size.** Everything else is fixed, because fluid type on body copy
makes line length and line height drift out of the ratio they were chosen for, and the result reads
as slightly wrong at every width except the two you tested.

### 3.3 Measure

The constraint Android never had: a chat bubble at "78% of the viewport" is fine at 390px and
unreadable at 1600px.

**Prose is capped by character count, not percentage.** `max-width: 68ch` on chat bubbles and any
paragraph of body copy — roughly 60–75 characters per line, which is where reading speed peaks. The
chat thread column itself is capped at `44rem` and centred, so the bubbles have somewhere to sit
rather than stretching across a widescreen monitor.

Headlines cap at `24ch` (`display-*`) and `36ch` (`headline-*`). A three-word headline set across
1400px stops being a headline.

### 3.4 Zoom and reflow

WCAG 1.4.4 requires 200% text zoom without loss of content, and 1.4.10 requires reflow at 320px
equivalent width. Both are met by the same discipline: **no fixed heights on text containers** (use
`min-height`), **no `overflow: hidden` on anything a user typed**, and no `line-clamp` outside the
two places it is genuinely appropriate (conversation-list titles and memory-card previews, both of
which have a full view one click away).

Test matrix is 320px, 768px, 1440px, each at 100% and 200% zoom. The onboarding finalize screen and
the account settings pages are where this breaks first — they have the most vertical content.

---

## 4. Layout and responsive architecture

This is the section with no Android equivalent, and the one that determines whether the web app feels
like a web app or like an emulator.

### 4.1 Breakpoints

Tailwind defaults, used with intent rather than sprinkled:

| Name | Min width | What changes |
|---|---|---|
| *(base)* | 0 | Single column. Bottom tab bar. Sheets instead of dialogs. |
| `sm` | 640px | Type and gutters only. No structural change. |
| `md` | 768px | Bottom bar → icon rail. Dialogs replace sheets. Two-column forms. |
| `lg` | 1024px | Rail → labelled sidebar. Chat gains the conversation column. |
| `xl` | 1280px | Chat gains the right context panel. Memory becomes list + detail. |
| `2xl` | 1536px | Nothing. Content is centred in a max width; the app does not keep growing. |

**Three structural breakpoints, not six.** `md` moves navigation off the bottom edge, `lg` gives
navigation labels and chat a second column, `xl` adds the third column. `sm` and `2xl` deliberately
change nothing structural — every structural breakpoint is a layout that has to be designed, built,
and tested, and six of them is how a responsive app ends up broken at four widths nobody checked.

**Gutters:** 20px base, 32px at `md`, 40px at `lg`. The 20px base matches Android's 20dp gutter for
the same reason — at 360px the extra 4px over Material's default is most of what separates "premium"
from "dense".

### 4.2 Three shells

**Public shell** — landing, login, signup, forgot, reset.

No app navigation at all. A minimal header (wordmark left, "Log in" right) and a footer with legal
links. Content in a single centred column, `max-width: 26rem` for forms and `max-width: 72rem` for
the landing page. Auth forms are vertically centred at `md` and up, top-aligned below that so the
keyboard does not push them off screen on a phone.

**Onboarding shell** — the five wizard screens.

Full viewport, no navigation, no exit affordance except an explicit "Skip" per step. A four-segment
progress bar pinned to the top. At `lg` and up the layout splits: the live companion preview occupies
a fixed left column (`24rem`, sticky) while the step's controls scroll on the right. On mobile the
preview collapses to a small avatar above the controls.

That split is the biggest single win web has over mobile in this product. Onboarding is a
"see the effect of your choice" flow, and on a phone the preview and the controls cannot both be
visible. On a desktop they can, so changing hair colour visibly changes the avatar without scrolling.

**App shell** — everything authenticated.

```
┌──────────────────────────────────────────────────────────────┐
│ ░░ sidebar ░░ │  page content                    │ ▓ panel ▓ │
│               │                                  │           │
│  Home         │  max-width 80rem, centred        │  xl only, │
│  Chat         │  (chat overrides: full height,   │  chat and │
│  Memory       │   own column layout)             │  memory   │
│  You          │                                  │  only     │
│  ───────────  │                                  │           │
│  [avatar]     │                                  │           │
│  Aria         │                                  │           │
└──────────────────────────────────────────────────────────────┘
   264px @ lg                                          320px
    72px @ md
   bottom bar below md
```

The sidebar's bottom slot holds the companion — avatar, name, presence — and clicking it opens her
profile. That is the web equivalent of Android's decision to make Companion a destination reached by
tapping her rather than a peer nav item, and it works better here: she is persistently visible on
every screen rather than only on Home.

### 4.3 Navigation

**Four destinations, matching Android:** Home, Chat, Memory, You. The reasoning is in
[`docs/design/01-foundation.md`](../design/01-foundation.md) §6.2 and has not changed — Companion is
reached through her, and Memory earns a top-level slot because user control over what she remembers
is the product's trust story.

| Viewport | Presentation |
|---|---|
| `< md` | Fixed bottom bar, 4 items, icon + label. `secondary-container` pill behind the active icon. Uses `env(safe-area-inset-bottom)`. |
| `md` – `lg` | 72px left rail, icon only, tooltip on hover, active pill retained |
| `≥ lg` | 264px sidebar, icon + label, companion card at the bottom |

Active state is a filled Lucide icon plus a 600-weight label plus the `secondary-container` pill —
three signals, so the active tab is identifiable in greyscale.

**URL is the source of truth for navigation state.** No Zustand store holds "current tab". Active
state derives from `usePathname()`. This sounds obvious and is the thing most often got wrong in
App Router apps, where a store and the URL disagree after a back-button press.

**Route structure:**

```
/                              landing (public)
/login  /signup                (public)
/forgot-password  /reset-password   (public, feature-flagged — see 02 §1)
/onboarding                    intro
/onboarding/appearance         step 1
/onboarding/personality        step 2
/onboarding/voice              step 3
/onboarding/finalize           step 4
/home                          Home tab
/chat                          redirects to the most recent conversation
/chat/[conversationId]         the thread
/chat/history                  mobile-only route; a column at lg+
/memory                        Memory tab
/memory/[memoryId]             sheet at base, split pane at xl
/memory/privacy                memory & privacy controls
/companion/[companionId]       companion profile
/companion/[companionId]/edit  edit, with appearance/personality/voice tabs
/account                       You tab
/account/security              account & security
/account/subscription          plan and usage
/account/appearance            theme
/account/privacy               privacy & data
/gallery                       flagged off — `/images` API ready, web screen not built (see 05 §6)
```

**Back-button behaviour.** Android maintains a separate back stack per tab. The browser has one
history stack and cannot be given four, so do not try: every navigation is a real push, and back
means "the previous page I was on" rather than "up one level in this tab". Fighting the browser here
produces the trapped-history bug that makes web apps feel broken.

The three places that need explicit handling: the onboarding wizard (steps push, so back is a free
lossless step backwards — see [`03`](./03-onboarding-and-home.md) §2.2), modals and sheets (open via
local state, **not** a route, so back does not close them — except the memory detail sheet, which is
a route because it is deep-linkable), and the chat composer with unsaved text (`beforeunload` only,
never a router intercept).

### 4.4 Motion

Durations and easing port from Android unchanged: instant 100ms, quick 200ms, standard 300ms,
emphasized 400ms, easing `cubic-bezier(0.2, 0, 0, 1)`.

**Web-specific:** hover transitions are 100ms (anything slower feels laggy under a pointer, which
Android never has to consider), and every animation is gated on `prefers-reduced-motion` through the
global media query in §2.5 rather than per-component.

**No page transition animations.** App Router navigations are streamed, and layering an exit
animation over a streaming navigation means either delaying content behind an animation or animating
a layout that is still filling in. The sidebar and shell persist across navigations, so the change is
already visually contained.

### 4.5 Elevation and shape

Elevation is **tonal**, as on Android: level 0 `surface`, level 1 `surface-container-low` (cards),
level 2 `surface-container` (sticky bars once scrolled), level 3 `surface-container-high` (dialogs,
popovers, composer).

Shadows are permitted in exactly one situation Android does not have: **floating overlays that are
not backed by a scrim** — dropdown menus, popovers, tooltips, and the toast stack. These sit over
arbitrary content with no dimming layer, and a tonal surface alone does not separate them from a card
of a similar tone underneath. One token, `--shadow-overlay: 0 8px 24px -6px rgb(0 0 0 / 0.18)`, and
it is not used anywhere else. Dialogs and sheets have a scrim and therefore no shadow.

Radii match Android in `rem`: `xs` 8px chips, `sm` 12px small surfaces, `md` 16px inputs, `lg` 20px
cards and bubbles, `xl` 28px buttons and sheets, `full` avatars. Chat bubbles are 20px on three
corners and 6px on the tail corner nearest the sender.

---

## 5. Component library

Thirty-four components in `components/ui`, vendored from shadcn/ui where an equivalent exists and
written from scratch where it does not. Each is presentational: no data fetching, no store reads, so
each can be rendered in isolation in the canvas and in Storybook if one is added later.

**Universal rules.** Every interactive element has a visible `:focus-visible` ring (§5.1). Minimum
hit area 44×44px on touch (`< md`), 32×32px acceptable for pointer-only controls at `md` and up.
Disabled controls get `opacity: 0.38` and `aria-disabled`, not the `disabled` attribute, wherever the
control still needs to be focusable to explain itself (§5.2). Every icon-only control has an
accessible name.

### 5.1 Focus

One ring, everywhere: `outline: 2px solid var(--focus-ring); outline-offset: 2px`.

`:focus-visible`, never `:focus` — a plain `:focus` ring appears on mouse clicks, which is the reason
so many products remove focus rings altogether and break keyboard navigation in the process. Radix
components manage this correctly out of the box; hand-written ones must opt in.

The ring never uses `box-shadow`. A `box-shadow` ring is clipped by any ancestor with
`overflow: hidden`, which describes most scroll containers, so focus silently disappears exactly
where lists are long. `outline` is not clipped.

**Focus order is DOM order.** No `tabindex` above 0 anywhere. The two exceptions where focus is moved
programmatically: after a form submit fails, focus goes to the first invalid field; when a
dialog opens, focus goes to its first interactive element and returns to the trigger on close (Radix
handles the latter).

**Skip link** as the first focusable element in the app shell — "Skip to main content" — visually
hidden until focused. With a 264px sidebar of four links plus a companion card, a keyboard user
otherwise tabs through six controls on every single page.

### 5.2 Buttons

`Button` with variants, all 44px tall at base and 40px at `md` (pointer targets can be tighter than
touch targets):

| Variant | Fill | For |
|---|---|---|
| `primary` | `--primary`, pill radius | The one primary action per screen |
| `secondary` | `--primary-container` | Second-most-likely action |
| `outline` | transparent, 1px `--outline` | Dismissive — "Skip for now" |
| `ghost` | transparent, `--state-hover` on hover | Toolbar and row actions |
| `link` | text only, underline on hover | Inline navigation |
| `destructive` | `--error` | Delete and archive confirmations only |

Loading state replaces the label with a spinner **while preserving the button's width**, so the layout
does not jump. `aria-busy="true"` and the accessible name changes to "Saving…".

**Disabled submit buttons stay enabled while a form is invalid.** This carries over from Android for
the same reason and is more important on web: a greyed-out button gives a screen-reader user no
signal about what is wrong. Validate on click and move focus to the problem. The single exception is
offline, where a banner states plainly that nothing will work until connectivity returns.

### 5.3 Inputs

`TextField` — 44px min height, 16px radius, `--surface-container-low` fill, 1px `--outline-variant`
border widening to 2px `--primary` on focus and 2px `--error` on error. A helper-text slot below
**reserves its own height** so a validation error does not shift the form. States: rest, hover,
focus, filled, error, disabled, read-only.

Also: `PasswordField` (visibility toggle whose accessible name flips between "Show password" and
"Hide password", optional strength meter on signup only), `TextArea` (auto-growing, min 3 rows),
`SearchField` (pill, leading icon, clear button once non-empty, `⌘K` shortcut hint at `md`+),
`Select` (Radix), `Combobox` (Radix, for voice selection), `Slider` (Radix, personality levels),
`Switch`, `Checkbox`, `RadioGroup`, `ColorSwatch` (the appearance picker's hair/eye/skin swatches —
a radio group rendered as circles, with an accessible name per swatch because colour alone is not a
label).

**Every field has a visible persistent `<label>`.** Placeholder-as-label loses the label the instant
someone types, and it fails at 200% zoom where the placeholder truncates.

**Font size on inputs is never below 16px at base width.** iOS Safari zooms the viewport when a
focused input's text is smaller, and the zoom does not undo itself.

### 5.4 Surfaces and data display

`Card` (20px radius, `--surface-container-low`, optional hover lift via `--state-hover`),
`SectionCard` (grouped settings rows with `--outline-variant` dividers inset from the leading edge),
`Sheet` (Radix Dialog, bottom at base and right-side at `md`+), `Dialog`, `Popover`, `DropdownMenu`,
`Tooltip` (pointer only — never the sole carrier of information, since it has no touch equivalent),
`Tabs`, `Accordion`, `Separator`, `ScrollArea`, `Meter` (the personality and importance bars — a real
`role="meter"` with `aria-valuenow`, not a styled div), `UsageBar` (segmented, with the numeric value
and the limit as text beside it), `Badge`, `Chip` (8px radius, 36px tall, `--secondary-container` fill
with a leading check when selected).

### 5.5 Identity and chat

`Avatar` — 24/32/40/48/64px, circular, `next/image` with a monogram fallback on
`--primary-container`. Optional presence dot: 10px, `--online-indicator`, with a 2px `--surface` ring
so it reads against any background.

`CompanionAvatar` — the hero variant, 96–160px, optional 2px `--primary-container` ring and a
breathing scale animation (1.0 → 1.015 over 4s) that conveys presence without gimmickry, disabled
under reduced motion.

`ChatBubble` — `max-width: 68ch` (§3.3), 20px radius with a 6px tail corner, 12px/16px padding,
`body-lg`. Outgoing `--bubble-outgoing`, incoming `--bubble-incoming`. States: sending (0.55 alpha),
sent, failed (inline "Not sent · Retry" as a real button beneath), streaming (text grows in place with
a caret), image, audio.

`TypingIndicator` — three 7px dots in an incoming-shaped bubble, staggered 0.6s opacity cycle,
announcing "Aria is typing" once rather than on every frame.

`MessageComposer` — 28px radius, `--surface-container-high`, a `<textarea>` growing from one row to
five then scrolling internally. `Enter` sends, `Shift+Enter` newlines, and on `< md` `Enter` inserts a
newline instead with an explicit send button, because on a phone the virtual keyboard's return key is
the only newline available. Holds the mic entry point. Sticky to the bottom of the thread column with
`env(safe-area-inset-bottom)`.

`AudioMessage` — play/pause, a static waveform, elapsed time. The waveform is decorative and must be
a **fixed** pattern, not randomised — the API returns no amplitude data, and a random waveform implies
information that does not exist.

### 5.6 Feedback

`Toast` (Radix, `--inverse-surface`, top-right at `md`+ and bottom at base, always icon plus text),
`Banner` (persistent, in-flow, for offline and form-level errors — the thing a toast must not be
used for), `Callout` (inline informational, `--tertiary-container` for memory context and
`--warning-container` for usage warnings), `Skeleton` (`--surface-container-high` blocks with a 1.2s
shimmer, shaped like the content they replace, static under reduced motion), `Spinner`, `EmptyState`
(icon in `--on-surface-variant`, `headline-sm` title, `body-md` explanation, one action — every empty
state says what to do next, not merely that there is nothing here), `ErrorState` (same structure,
icon in `--error`, mandatory retry).

**Toasts are for confirmations, never for errors that need action.** An error toast disappears in
four seconds and scrolls away from the thing it describes. Form errors are banners; message-send
failures are inline on the message ([`04`](./04-chat-and-voice.md) §4.1).

### 5.7 Keyboard shortcuts

Web gets shortcuts. Keep the set small enough to remember.

| Keys | Action | Scope |
|---|---|---|
| `⌘K` / `Ctrl+K` | Focus search | Memory |
| `Enter` | Send | Composer, `md`+ |
| `Shift+Enter` | Newline | Composer |
| `Esc` | Close overlay / cancel recording / stop streaming | Global |
| `⌘Enter` | Save | Companion edit, memory edit |
| `?` | Shortcut reference dialog | Global, outside inputs |
| `g` then `h`/`c`/`m`/`y` | Go to Home / Chat / Memory / You | Global, outside inputs |

Every shortcut must be gated on the event target not being a text input, or `g` becomes unusable in
the composer. All of them duplicate a visible control; none is the only route to an action.

---

## 6. Rendering: what is a Server Component

The decision that shapes every screen file, and the one with no mobile analogue.

**Default to Server Components. Reach for `"use client"` at the leaf.** The failure mode is putting
`"use client"` at the top of a page because one button inside needs state, which pulls the entire
subtree into the client bundle.

| Rendering | Screens |
|---|---|
| **Static** | Landing, legal pages, 404 |
| **Server, dynamic** | App shell (sidebar, companion card), Home, companion profile, memory list, account pages — all read cookies, none are cacheable |
| **Client** | Chat thread (SSE + optimistic state), composer, onboarding wizard, every form, memory filters |

**Chat is a client island inside a server shell.** The thread's app bar and the companion's identity
render on the server; the message list and composer are client components hydrated with the initial
messages passed as props. That way the conversation's chrome appears immediately and only the
interactive part waits on hydration.

**TanStack Query is hydrated from the server, not refetched on mount.** Fetch on the server,
`dehydrate` into the page, `HydrationBoundary` in the layout. Without this, every navigation shows a
skeleton for data the server already had — which is the single most common way an App Router app ends
up slower than the Pages Router app it replaced.

**Streaming and Suspense.** The app shell renders immediately; Home's usage strip and memory
highlight are wrapped in `<Suspense>` with skeletons, because both come from endpoints that are
currently unguarded and may fail (§8). A failure there must degrade to a hidden section, never to an
error page — which is exactly what a Suspense boundary with an error boundary inside it gives.

---

## 7. Auth architecture

The most consequential web-specific decision in this document. It exists because of one fact about
the API.

### 7.1 The problem

`AuthService.createAuthResponse` returns tokens **in the JSON response body**:

```json
{ "user": { "id": 1, "email": "…", "displayName": "…" },
  "accessToken": "eyJ…", "refreshToken": "eyJ…" }
```

The API sets no cookies. `Session.expiresAt` defaults to 30 days, so the refresh token is a
long-lived bearer credential that the client is responsible for storing.

For a mobile app that is fine — `EncryptedSharedPreferences` is a real secure store. In a browser
there is no secure store. `localStorage` is readable by any script on the origin, so a single XSS
anywhere in the app — including in a dependency — yields a 30-day refresh token and therefore full
account takeover that survives a password change (the reset flow does not exist yet, and even when it
does, nothing currently invalidates sessions).

### 7.2 The decision: a BFF in Next.js Route Handlers

**The browser never sees a token.** Route handlers under `/api/bff/*` are the only thing that talks
to Nest.

```
Browser ──fetch, cookies──▶ Next Route Handler ──Authorization: Bearer──▶ Nest API
        ◀──JSON, Set-Cookie──                  ◀──JSON──
```

1. The browser posts credentials to `POST /api/bff/auth/login`.
2. The handler calls `POST {API}/api/v1/auth/login`, receives both tokens.
3. The handler writes two cookies and returns only the `user` object to the browser.

| Cookie | Contents | Flags | Max-Age |
|---|---|---|---|
| `ag_at` | access token | `HttpOnly` `Secure` `SameSite=Lax` `Path=/` | matches token TTL |
| `ag_rt` | refresh token | `HttpOnly` `Secure` `SameSite=Strict` `Path=/api/bff/auth` | 30d |

The refresh cookie is scoped to the one path that needs it and is `SameSite=Strict`, so it is not
attached to the dozens of ordinary API calls that have no business carrying it. Narrowing the blast
radius of the more valuable credential costs one line of configuration.

**What this buys:** XSS can no longer read either token. It can still *use* the session by calling
`/api/bff/*` from the victim's browser, which is the residual risk of any cookie-based auth, but it
cannot exfiltrate a credential to use later or elsewhere. That difference — session-scoped versus
account takeover — is the whole reason for the hop.

**What it costs:** every request has an extra network hop through the Next server, and route handlers
must run on the Node runtime (Edge cannot reach a `localhost` API in development). Handlers are thin
proxies; the latency is a local process hop in production if both are co-located.

**It also removes CORS entirely.** Note that `main.ts` sets `allowedHeaders: ['Content-Type',
'Authorization']` — no custom request headers are permitted from a browser at all. With the BFF,
browser→Nest calls do not happen, so the restriction is moot rather than something to work around.

**CSRF.** Cookie auth reintroduces CSRF, which bearer headers do not have. `SameSite=Lax` blocks the
cross-site form post, and all mutating BFF routes additionally require a `Origin` header matching the
app's own origin. Both, not either.

**Alternative considered and rejected:** access token in a JS variable, refresh token in
`localStorage`, silent refresh on load. It is less code and it is what most tutorials show. It also
puts the 30-day credential in the one place an attacker can read, and it cannot support
`middleware.ts` route protection because middleware cannot read `localStorage`. Every authenticated
page would then be a client-side redirect after a flash of the wrong content.

### 7.3 Two API bugs that change this design

Both were found reading `auth.service.ts` and both need fixing on the backend. The web client has to
be built around them meanwhile.

**The access-token TTL is inconsistent.** `generateTokensForSession` defaults `JWT_ACCESS_EXPIRES_IN`
to `'30d'` (line 253), while `refresh()` defaults the same variable to `'15m'` (line 137). A user who
logs in gets a 30-day access token; the moment they refresh, they get a 15-minute one. Any client that
schedules a proactive refresh from the token's own `exp` will therefore behave completely differently
before and after the first refresh.

*Consequence for the web client:* **do not schedule refreshes from `exp`.** Refresh reactively — on a
401 from any BFF route, call refresh once, retry the original request once, and on a second failure
clear cookies and route to `/login`. A single-flight lock around the refresh call is required, or ten
parallel queries on Home each trigger their own refresh and nine of them race the rotation and fail.
Set `JWT_ACCESS_EXPIRES_IN` explicitly in `.env` regardless, so neither default applies.

**Concurrent signups collide on a unique constraint.** `createAuthResponse` creates the `Session` row
with `refreshToken: ''` and then updates it with the real token. `Session.refreshToken` is `@unique`.
Two registrations or logins landing in the same instant both insert `''` and the second gets a unique
violation — surfacing as a 500 on signup, intermittently, under exactly the load where it is hardest
to reproduce. The fix is to generate the token before the insert; there is nothing the client can do
but present the 500 honestly and offer retry.

### 7.4 `middleware.ts`

This replaces Android's Splash screen. There is no splash on web — a branded interstitial while the
session resolves is a mobile pattern that on web reads as a slow page load.

Middleware verifies the `ag_at` JWT signature with `jose` and `JWT_ACCESS_SECRET`, then routes:

| Cookie state | Requesting | Result |
|---|---|---|
| none | `/(app)/*` | 307 → `/login?next=…` |
| none | public route | render |
| valid | `/login`, `/signup` | 307 → `/home` |
| valid | `/(app)/*` | render |
| expired but `ag_rt` present | anything | render; the first BFF 401 triggers refresh (§7.2) |

**Middleware verifies the signature but does not check for a companion.** Deciding
onboarding-versus-home needs `GET /avatars`, and putting an API call in middleware puts it on the
critical path of every navigation including static assets. The companion check belongs in the `(app)`
layout, which already loads her for the sidebar: no companion means `redirect('/onboarding')`.

**`next` is validated as a relative path** before redirecting to it. An unvalidated `?next=` is an
open redirect, and login pages are where they are always found.

---

## 8. Endpoint reality

Read from `apps/api/src`, not from the PRD. The web client is built against this column, not the
PRD's aspirations.

| Capability | Endpoint | Status for web |
|---|---|---|
| Register / login / refresh / logout | `POST /auth/*` | Works |
| Current user | `GET /users/me` | Works. **Use this, not `GET /auth/me`** — the latter has no `JwtAuthGuard` and reads `req.user` regardless |
| Update display name | `PATCH /users/me` | Works — `displayName` only |
| Delete account | `DELETE /users/me` | Works |
| Companion CRUD | `/avatars/*` | Works. Note the resource is `avatars` in the API and **"companion" in all UI copy** |
| Avatar upload | `POST /avatars/:id/avatar` | Works — multipart, ≤5MB, jpeg/png/webp |
| Conversations | `/conversations/*` | Works. **No `lastMessage` preview in the list** |
| Messages | `/conversations/:id/messages` | Works. **No pagination** — returns full history |
| Streaming | `POST /conversations/:id/messages/stream` | Works — SSE (§8.1) |
| Memories | `GET`/`PATCH`/`DELETE /memories/*` | Works. **No `POST`** — no manual memory creation |
| Voice | `POST /voice/{transcribe,synthesize,respond}` | Built but **double-prefixed and unguarded** (§8.2) |
| Subscription | `GET /subscriptions/{current,latest}` | Read-only, **unguarded**. No checkout, no create |
| Usage | `GET /usage/summary`, `POST /usage/{check,}` | **Unguarded**, and `summary` reads `req.user.id` where the JWT payload uses `sub` |
| Password change | — | **Missing.** Blocks account security and password reset |
| Forgot / reset password | — | **Missing.** Blocks two designed screens ([`02`](./02-authentication.md) §1) |
| Google sign-in | — | Missing. `AuthProvider.GOOGLE` exists in the schema only |
| Image generation | — | **Missing entirely.** Blocks the gallery ([`05`](./05-companion-memory-account.md) §6) |
| Regenerate / edit message | — | Missing |
| Calls | — | Missing. Phase 2/3 |
| Notifications | — | Missing |

### 8.1 SSE on the web

`POST /conversations/:id/messages/stream` writes `event: <type>` / `data: <json>` frames. Confirmed
payloads:

```
event: message   data: { "type": "message", "message": { …persisted user message… } }
event: delta     data: { "type": "delta",   "content": "…" }
event: done      data: { "type": "done",    "message": { …persisted assistant message… } }
event: error     data: { "message": "…" }
```

Four consequences for the web client, three of them non-obvious:

**`EventSource` cannot be used.** It is GET-only and cannot send a body or set headers. The transport
is `fetch` with a `ReadableStream` reader plus `TextDecoderStream`, and the frame parser is
hand-written — about forty lines, and preferable to depending on `@microsoft/fetch-event-source` for
a parser this small.

**The `error` event has no `type` field.** Every other event carries `type` in its payload; the
controller's catch block writes `{ message }` alone. A discriminated union keyed on `data.type` will
therefore fail to match the error case. Key on the SSE `event:` line instead, which is always present
and always correct.

**Always replace the buffer with the `done` payload** rather than trusting accumulated deltas. A
dropped or duplicated delta is invisible until the thread reloads and the text silently differs.

**There is no keepalive.** The backend sends no `: ping` comments, so a stalled connection is
indistinguishable from a slow model. The client needs its own inactivity watchdog: no `delta` for 30
seconds is a failure. (Backend fix: emit a comment frame every 15 seconds.)

**Streaming through the BFF** requires the route handler to pass the body through without buffering:
`export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, and return
`new Response(upstream.body, { headers })`. Also set `X-Accel-Buffering: no` — Nginx and several
platform proxies buffer `text/event-stream` by default, which turns a stream into one long pause
followed by the whole reply at once. This is the single most common way SSE works in development and
fails in production.

A 401 from the guard *does* arrive as JSON rather than SSE, because `JwtAuthGuard` runs before the
handler reaches `flushHeaders()`. Check `content-type` on the response before starting to parse
frames.

**The stream answers 200 for almost every subsequent failure.** `flushHeaders()` runs before the
`try` (`messages.controller.ts`), so a thrown error after headers are sent cannot change the status
code — it arrives as an `error` event on a 200 response. Treat HTTP status as the transport status
only; application failure is the `error` event.

**JSON responses are envelope-wrapped.** `ResponseInterceptor` maps every 2xx body into
`{ success, statusCode, message, data, timestamp, path }`. Tokens sit at `data.accessToken`. The BFF
unwraps `.data` once at the boundary. Extra request fields 400 because `forbidNonWhitelisted: true`.

### 8.2 Voice paths

`VoiceController` is declared `@Controller('api/v1/voice')` while `main.ts` already sets a global
prefix of `api/v1`, so the live paths are `/api/v1/api/v1/voice/*`. The BFF should target the correct
single-prefix path and the controller should be changed to `@Controller('voice')`.

The voice endpoints also have **no `JwtAuthGuard`**. They are the most expensive endpoints in the
product and are currently open to the internet. This must be fixed before anything ships.

**WebM/Opus is a blocker, not a codec preference.** Chrome and Firefox `MediaRecorder` produce
`audio/webm;codecs=opus`. Gemini STT accepts WAV, MP3, AIFF, AAC, OGG, and FLAC — not WebM — and
`getAudioExtension` stores `audio/webm;codecs=opus` as `.audio`, so even playback would fail. Safari
produces `audio/mp4` (AAC), which *is* on the accepted list. Voice on web cannot ship until the
backend transcodes or the provider is given a supported container. Detail in
[`04-chat-and-voice.md`](./04-chat-and-voice.md).

**`GET /uploads/**` is public.** Voice notes and companion avatars are at guessable paths with no
authorisation. The browser plays them by fetching Nest directly — the one place the BFF is bypassed.

### 8.3 Other API facts later documents discovered

These change client behaviour. They are recorded here so implementers do not have to read all five
documents to find them.

- **`gender` is required on the wire.** `CreateAvatarDto` requires it; Prisma's `FEMALE` default
  never applies if the field is omitted. The wizard still does not *ask*, but Finalize must send it.
- **Nested DTO keys are unvalidated.** A misspelt `hairColour` is a silent 201. The client must use
  the American field names in the DTO (`hairColor`, `eyeColor`, `skinTone`).
- **`CompanionVoice` is all-or-nothing.** `AvatarsService.create` writes the voice row only when both
  `provider` and `voiceId` are present. Skipping the voice step must still send both, with documented
  defaults.
- **Memory importance is 1–10, not 0–100.** The extractor and `MemoryImportanceService` clamp 1–10
  and drop anything below 4. `UpdateMemoryDto` incorrectly allows `@Min(0) @Max(100)`, so a client
  writing 92 outranks every extracted memory. The UI slider is 1–10. The Android design's "92"
  example is wrong.
- **`GET /memories` filters after `limit`.** The service takes the top N by importance, then applies
  `type` / `companionId` in JavaScript. A type filter returns "the facts among your 50 most
  important", not 50 facts, and can be empty while facts exist.
- **`DELETE /memories/:id` is a soft delete.** The "she'll forget it immediately" copy is true for
  retrieval; right-to-erasure is not satisfied.
- **Archived companions 404 on `GET /avatars/:id`.** `update` calls `findOne` first, so there is no
  path back. The un-archive gap is total.
- **`/subscriptions/current` and `/usage/summary` fail, they do not merely degrade.** With no
  `JwtAuthGuard`, the former reads `request.user?.sub` → `NaN` → 400; the latter reads `req.user.id`
  on `undefined` → 500. Home hides both widgets.
- **Stop does not cancel the server.** Aborting the `fetch` stops the client stream; the assistant
  message is still persisted. The discarded partial will reappear on the next history load unless
  the backend grows cancellation.

---

## 9. Accessibility

Requirements, not aspirations. Target WCAG 2.1 AA.

**Landmarks.** One `<main>` per page, `<nav aria-label="Main">` for the sidebar, `<header>`,
`<footer>`. The skip link (§5.1) targets `<main id="main">`. Section boundaries use real `<h2>`/`<h3>`
in document order — no `<div class="headline-sm">` standing in for a heading.

**Never communicate by colour alone.** Every status carries an icon and text. Memory type badges have
text content, not just a container colour. The presence dot is paired with "Active now". The password
strength meter has a text label. This is the rule most often broken by a toast that signals success
purely by turning green.

**Forms.** `<label for>` on every input, `aria-invalid` and `aria-describedby` pointing at the error
text, `role="alert"` on the error container so it is announced. Form-level error banners are
`role="alert"`; the offline banner is `role="status"` because it is ambient rather than a response to
an action.

**Live regions.** The streaming assistant reply is `aria-live="polite"` with the caret excluded from
the accessible name, so the response is announced as it arrives. The recording timer is polite and
updates every 5 seconds, not every second. `aria-live="assertive"` is used for exactly one thing: a
credential rejection on login, which the user is otherwise looking down at a form and will not see.

**Motion.** All animation gated on `prefers-reduced-motion` (§2.5). The breathing avatar and the
skeleton shimmer are the two that matter.

**Test matrix.** Keyboard-only end-to-end on the auth and chat flows; NVDA on Windows and VoiceOver
on macOS for those same two flows; 200% zoom at 320px, 768px, and 1440px; both themes; forced-colours
mode (Windows high contrast) on the app shell, where a sidebar built from background colours alone
disappears entirely. `axe-core` in the Playwright suite so regressions fail CI rather than review.

---

## 10. Performance budgets

Numbers, so "it feels slow" becomes a bug rather than an opinion.

| Metric | Budget | Where it is at risk |
|---|---|---|
| LCP, landing, 4G | < 2.0s | The hero image |
| LCP, Home, 4G | < 2.5s | Server-rendered; safe if Query is hydrated (§6) |
| INP | < 200ms | The composer during streaming — batch delta appends per animation frame, not per event |
| CLS | < 0.05 | Reserved helper-text height (§5.3) and skeletons shaped like their content |
| First-load JS, app shell | < 180KB gzip | Every stray `"use client"` |
| Time to first delta | < 1.5s after send | BFF hop plus proxy buffering (§8.1) |

Two specific risks worth naming now:

**The full-history fetch.** `GET /conversations/:id/messages` has no pagination and returns
everything. At 50 messages this is invisible; at 5,000 it is a multi-megabyte JSON payload blocking
the chat screen. Render the newest window and virtualise upward, but understand that this only hides
the problem — **cursor pagination is a backend prerequisite for launch**, not an optimisation.

**Delta re-renders.** Appending each SSE delta to React state re-renders the thread on every token.
Accumulate into a ref and flush on `requestAnimationFrame`, and keep the streaming bubble in its own
component so the flush does not re-render the message list.

---

## 11. Screen inventory

Thirty-two designed surfaces across four documents. Status is against the endpoint table in §8.

| # | Screen | Route | Doc | Status |
|---|---|---|---|---|
| 1 | Landing | `/` | [02](./02-authentication.md) | Ready |
| 2 | Log in | `/login` | 02 | Ready |
| 3 | Sign up | `/signup` | 02 | Ready |
| 4 | Forgot password | `/forgot-password` | 02 | **No backend** — flagged off |
| 5 | Reset password | `/reset-password` | 02 | **No backend** — flagged off |
| 6 | Onboarding intro | `/onboarding` | [03](./03-onboarding-and-home.md) | Ready |
| 7 | Step 1 · Appearance | `/onboarding/appearance` | 03 | Ready |
| 8 | Step 2 · Personality | `/onboarding/personality` | 03 | Ready |
| 9 | Step 3 · Voice & framing | `/onboarding/voice` | 03 | Ready |
| 10 | Step 4 · Finalize | `/onboarding/finalize` | 03 | Ready |
| 11 | Home | `/home` | 03 | Ready, degrades (§8) |
| 12 | Conversation | `/chat/[id]` | [04](./04-chat-and-voice.md) | Ready |
| 13 | Conversation history | `/chat/history` + `lg` column | 04 | Ready, no previews |
| 14 | Voice composer | overlay in 12 | 04 | Blocked on §8.2 |
| 15 | Usage wall | overlay in 12 | 04 | Designed, unreachable |
| 16 | Memory list | `/memory` | [05](./05-companion-memory-account.md) | Ready |
| 17 | Memory detail | `/memory/[id]` | 05 | Ready |
| 18 | Memory & privacy | `/memory/privacy` | 05 | Partial |
| 19 | Companion profile | `/companion/[id]` | 05 | Ready |
| 20 | Companion edit | `/companion/[id]/edit` | 05 | Ready |
| 21 | You | `/account` | 05 | Ready |
| 22 | Account & security | `/account/security` | 05 | Partial — no password change |
| 23 | Subscription | `/account/subscription` | 05 | Read-only |
| 24 | Appearance & theme | `/account/appearance` | 05 | Client-only |
| 25 | Privacy & data | `/account/privacy` | 05 | Partial |
| 26 | Gallery | `/gallery` | 05 | **No backend** — flagged off |
| 27 | 404 | — | 05 | Ready |
| 28 | Error boundary | — | 05 | Ready |
| 29 | Offline | banner + cached | 05 | Ready |
| 30 | Delete account | dialog in 22 | 05 | Ready |
| 31 | Shortcut reference | dialog, global | 01 §5.7 | Ready |
| 32 | Login interstitial | middleware redirect | 02 | Ready |

The PRD's Module 14 admin panel is **out of scope for this design set**. It is a different product
with different users, no endpoints, and no shared chrome; designing it alongside the consumer app
would compromise both.

---

## 12. Decisions

**Settled here.** The Android palette, type scale, and motion port unchanged. M3 role names are the
token source of truth with shadcn names as aliases. Three structural breakpoints (`md`, `lg`, `xl`).
Four navigation destinations with the companion in the sidebar footer rather than as a fifth. Three
layout shells. A BFF with httpOnly cookies rather than browser-held tokens. `middleware.ts` replaces
the splash screen. Server Components by default with chat as a client island. Prose capped by `ch`
rather than percentage. No page transition animations. Admin panel out of scope.

**Open, and worth answering before these tokens become screens.**

**Brand name.** "Lumen" is the placeholder in the Android mockups. On web it additionally sets the
domain, the wordmark, the OG image, and the page titles — more surface than on mobile, and page
titles are the one thing that cannot ship with a placeholder.

**Landing page imagery.** The Android Welcome screen calls for a single warm, off-camera portrait.
The landing page needs more: a hero, and probably two or three supporting images. Whether these are
licensed photography, commissioned illustration, or rendered companions is the largest unresolved
visual decision, and it is the first thing every new visitor sees. It also cannot be derived from
the tokens, which is why it is here rather than decided.

**Whether the landing page ships at all in the first milestone.** An authenticated-only app can
launch with `/` redirecting to `/login`. That is honest and cheap. A weak marketing page is worse
than none, and the design in [`02`](./02-authentication.md) §2.1 assumes real imagery exists.

**Google sign-in.** Deferred on Android. On web it is materially cheaper (no Play Services, no SHA
fingerprints) and materially more valuable, since password entry on a desktop keyboard is where
signup abandonment concentrates. `AuthProvider.GOOGLE` and the `Account` model already exist in the
schema; only `POST /auth/google` is missing. Worth reconsidering rather than inheriting the mobile
decision.

**Hosting and co-location.** The BFF's extra hop is negligible if Next and Nest are co-located and
meaningful if they are in different regions. This is an infrastructure decision that changes a
user-visible latency budget (§10), so it belongs on this list.
