# Design blueprint: "Zero" theme (portable)

A self-contained spec of the CO2 Tracker v2 design system, written to be reused in another project, for
example an STF 3D digital twin with an operations dashboard. Everything here is framework-agnostic CSS
variables plus optional Tailwind and React snippets. Copy §2 (tokens) first; everything else builds on it.

---

## 1. Principles

1. **Two inks, one signal colour.** Black / off-white carry text; neon green `#0FFF4F` ("lime") is the only
   brand colour and marks *one* thing per view: the primary action, the active state, or the headline number.
2. **Lime is never text on a light surface** (contrast ≈ 1.3:1). In light mode lime appears as a *fill* with
   black text on it, or as black buttons with lime text. In dark mode lime is the primary and link colour.
3. **Light and dark are designed separately**, not inverted: each has its own surfaces, shadows, chart steps
   and gradient strengths (see §2). Both follow the system setting unless the user picks one.
4. **Calm surfaces, data in front.** Translucent cards over a slow gradient. No decorative motion inside data
   areas; motion is for orientation (page enter, card rise, selection).
5. **Accessible by construction:** WCAG 2.1 AA contrast on every token pair, 44 px+ targets, visible focus,
   reduced-motion and reduced-transparency fallbacks, and identity never shown by colour alone.

## 2. Design tokens (copy as-is)

```css
/* ---------- LIGHT (default) ---------- */
:root {
  color-scheme: light;
  --bg: #f2f2f2;
  --surface-solid: #ffffff;
  --surface-raised: #fafafa;
  --glass: rgba(255, 255, 255, 0.92);
  --glass-strong: rgba(255, 255, 255, 0.96);
  --glass-border: rgba(0, 0, 0, 0.07);
  --glass-shadow: rgba(0, 0, 0, 0.06);
  --line: rgba(0, 0, 0, 0.08);
  --field: #8c8c8c;            /* input outline, 3.4:1 on white */
  --fill: rgba(0, 0, 0, 0.045);
  --fill-strong: rgba(0, 0, 0, 0.085);
  --ink: #000000;              /* 18.8:1 */
  --muted: #595959;            /* 6.3:1 */
  --brand: #0fff4f;            /* fills, rings, highlights only */
  --brand-ink: #000000;        /* text on brand fills */
  --primary: #000000;          /* primary button bg */
  --primary-ink: #0fff4f;      /* primary button text */
  --accent: #3d5c00;           /* links / focus ring, 6.9:1 */
  --warn: #a34a00;
  --danger: #c4000f;
  --danger-ink: #ffffff;
  --ring: rgba(61, 92, 0, 0.35);
  --chart-grid: #e6e6e6;
  --chart-neutral: #999999;
  --heat-1: #ebff99; --heat-2: #0fff4f; --heat-3: #8fb300; --heat-4: #4d6100;
  --wallpaper:
    radial-gradient(62rem 44rem at 92% -10%, rgba(15, 255, 79, 0.5), transparent 62%),
    radial-gradient(40rem 32rem at 8% 0%, rgba(15, 255, 79, 0.16), transparent 60%),
    radial-gradient(52rem 42rem at -4% 108%, rgba(153, 153, 153, 0.32), transparent 62%),
    radial-gradient(36rem 30rem at 70% 70%, rgba(15, 255, 79, 0.1), transparent 60%),
    linear-gradient(180deg, #f8f8f8 0%, #f2f2f2 48%, #e8e8e8 100%);
}

/* ---------- DARK: same block under both selectors, keep in sync ---------- */
:root[data-theme='dark'] { /* …dark values… */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* …dark values… */ }
}
/* dark values: */
/*
  color-scheme: dark;
  --bg: #000000;
  --surface-solid: #141414;
  --surface-raised: #1f1f1f;
  --glass: rgba(20, 20, 20, 0.9);
  --glass-strong: rgba(31, 31, 31, 0.94);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-shadow: rgba(0, 0, 0, 0.6);
  --line: rgba(255, 255, 255, 0.09);
  --field: #6e6e6e;
  --fill: rgba(255, 255, 255, 0.06);
  --fill-strong: rgba(255, 255, 255, 0.11);
  --ink: #f2f2f2;              16.5:1
  --muted: #999999;            6.5:1 (5.8:1 on raised)
  --brand: #0fff4f;
  --brand-ink: #000000;
  --primary: #0fff4f;
  --primary-ink: #000000;
  --accent: #0fff4f;           15.7:1
  --warn: #ffb340;
  --danger: #ff6961;
  --danger-ink: #2b0003;
  --ring: rgba(15, 255, 79, 0.35);
  --chart-grid: #262626;
  --chart-neutral: #999999;
  --heat-1: #3d4d00; --heat-2: #7a9900; --heat-3: #b3e000; --heat-4: #e0ff66;
  --wallpaper:
    radial-gradient(62rem 44rem at 92% -10%, rgba(15, 255, 79, 0.17), transparent 62%),
    radial-gradient(40rem 32rem at 8% 0%, rgba(15, 255, 79, 0.05), transparent 60%),
    radial-gradient(52rem 42rem at -4% 108%, rgba(153, 153, 153, 0.15), transparent 62%),
    radial-gradient(36rem 30rem at 70% 70%, rgba(15, 255, 79, 0.06), transparent 60%),
    linear-gradient(180deg, #0b0b0b 0%, #000000 55%, #050505 100%);
*/
```

**Theme switching.** Three states: System (no attribute), Light (`data-theme="light"`), Dark
(`data-theme="dark"`) on `<html>`. Persist the choice in `localStorage`; apply it in an inline script in
`<head>` before first paint to avoid a flash. Set `<meta name="theme-color">` to `#f2f2f2` / `#000000`.

### 2.1 Status colours (for a twin / ops dashboard)

The source app uses `--warn` and `--danger` only. For equipment state add a fixed four-step status set,
**reserved for state, never reused as a series colour**, always shipped with an icon and a label:

| State | Light | Dark | Icon |
|---|---|---|---|
| OK / running | `#1a7f37` | `#3fb950` | check-circle |
| Warning | `#a34a00` (= `--warn`) | `#ffb340` | triangle |
| Critical / fault | `#c4000f` (= `--danger`) | `#ff6961` | octagon |
| Offline / unknown | `#595959` | `#999999` | dashed circle |

> Do not use lime for "OK": lime means *selected / primary* in this system. Keep the meanings separate.

### 2.2 Categorical chart colours (fixed order, never cycled)

| Slot | Light | Dark |
|---|---|---|
| 1 | `#2a78d6` | `#3987e5` |
| 2 | `#eb6834` | `#d95926` |
| 3 | `#1baf7a` | `#199e70` |
| 4 | `#eda100` | `#c98500` |
| 5 | `#e87ba4` | `#d55181` |

More than 5 series → fold into "Other" or use small multiples. A colour follows its entity, not its rank:
filtering must never repaint the series that remain. Every chart has a legend (≥ 2 series) and a table view.

## 3. Typography

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Display (page title, KPI value) | Space Grotesk Variable | 28–40 px / 600 | `letter-spacing: -0.02em`, tabular figures for numbers |
| Section heading | Space Grotesk Variable | 18–20 px / 600 | |
| Body | Inter Variable | 14–15 px / 400 | `font-feature-settings: 'kern','ss01','cv11'` |
| Label | Inter Variable | 13 px / 500 | |
| Caption / axis | Inter Variable | 12 px / 400–500 | colour `--muted` |

Self-host both via `@fontsource-variable/inter` and `@fontsource-variable/space-grotesk` (no third-party
font requests, so the CSP stays tight). Use `font-variant-numeric: tabular-nums` on every live-updating number.

## 4. Shape, spacing, elevation

- Radius: cards **24 px**, controls **12 px**, segmented control 10/8 px, buttons and chips fully round.
- Spacing scale: 4 px base; card padding 24 px (16 px on phones); gap between cards 20 px.
- Elevation: one shadow recipe only: `0 1px 2px var(--glass-shadow), 0 12px 32px -12px var(--glass-shadow)`.
- Lines: 1 px `--line`; inputs use `--field` (≥ 3:1 non-text contrast).

## 5. Surfaces ("liquid glass")

```css
.glass, .glass-liquid {               /* card */
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: 0 1px 2px var(--glass-shadow), 0 12px 32px -12px var(--glass-shadow);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}
.glass-strong { background: var(--glass-strong); }   /* sidebar, sticky headers, overlays on 3D */
.liquid-capsule {                     /* secondary button / pill */
  background: var(--fill); border: 1px solid var(--line);
  transition: background-color .18s, border-color .18s, transform .18s;
}
.liquid-capsule:hover { background: var(--fill-strong); border-color: var(--brand); }

/* Background: the gradient sits on a fixed layer behind everything and drifts slowly. */
body { background: var(--bg); }
body::after {
  content: ''; position: fixed; inset: -12%; z-index: -2; pointer-events: none;
  background: var(--wallpaper);
}
@media (prefers-reduced-motion: no-preference) {
  body::after { animation: gradient-drift 40s ease-in-out infinite alternate; }
}
@keyframes gradient-drift {
  50% { transform: translate3d(-3%, 2%, 0) scale(1.05); }
  to  { transform: translate3d(2%, -2%, 0) scale(1.02); }
}

/* Fallbacks: solid cards when transparency is reduced (OS setting or in-app switch). */
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-strong { background: var(--surface-solid); backdrop-filter: none; }
}
:root[data-transparency='reduced'] .glass,
:root[data-transparency='reduced'] .glass-strong { background: var(--surface-solid); backdrop-filter: none; }
@media (forced-colors: active) { .glass, .glass-strong { border: 1px solid CanvasText; } }
```

Glass opacity is high (0.90–0.96) on purpose: text contrast is computed against the *card*, not what is
behind it. Never drop card opacity below 0.85 behind text.

## 6. Components

| Component | Spec |
|---|---|
| **Primary button** | `--primary` bg, `--primary-ink` text, round, min-height 46 px, px 20, 14 px/600. One per view. |
| **Secondary button** | `.liquid-capsule`, `--ink` text. |
| **Danger button** | `--danger` bg, `--danger-ink` text; confirm destructive actions. |
| **Input / select** | 48 px high, radius 12, 1 px `--field` border, `--surface-solid` bg; focus: border `--accent` + 3 px ring `--ring`. Label above (13 px/500), help or error below (12 px; error `--danger`, `role="alert"`). Custom chevron on select. |
| **Segmented control** | track `--fill`, radius 10, 2 px padding; segment 32 px high, 12 px/600 `--muted`; active `[aria-pressed=true]` → `--primary` bg / `--primary-ink`. |
| **Switch** | 51×31 track `--fill-strong`, white 27 px knob; checked → `--primary`. Built on a native checkbox. |
| **Brand chip** | round, 12 px/600, `--brand` bg + `--brand-ink`: the single highlight per card. |
| **Card** | `.glass-liquid rounded-[24px] p-6`; title 18 px display, optional action at the top right. |
| **KPI tile** | label (13 px `--muted`) → value (32–40 px display, tabular) → delta line (12 px, with ▲/▼ icon and words, never colour alone). |
| **Error banner** | `border-danger/30 bg-danger/10 text-danger`, radius 12, leading icon, `role="alert"`. |
| **Skeleton** | `--fill-strong` block shaped like the content, 1.4 s opacity pulse; `role="status"` + sr-only text. |
| **Empty state** | lime disc with a black glyph, display title, one-line reason, one primary action. |
| **Toast** | `.glass-strong`, bottom-centre, enters 0.22 s rise + scale 0.98 → 1. |
| **Dialog / command bar** | native `<dialog>`, backdrop `rgba(0,0,0,.45)` + 14 px blur; opens with 0.24 s pop; on phones it's a bottom sheet. |
| **Focus** | `outline: 3px solid var(--accent); outline-offset: 2px` on everything that isn't a text field. |

## 7. Dashboard layout

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ Sidebar      │  Page header: title (display) · context · primary btn  │
│ 272 px       ├──────────────┬──────────────┬──────────────┬──────────┤
│ glass-strong │  KPI tile    │  KPI tile    │  KPI tile    │ KPI tile │
│ sticky,      ├──────────────┴──────────────┼──────────────┴──────────┤
│ rounded 24   │  Primary chart (2/3)         │  Status / alerts (1/3)  │
│              ├──────────────────────────────┴─────────────────────────┤
│ grouped nav  │  Detail table / secondary charts                       │
│ (collapsible)│                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

- Grid: `md:grid-cols-[272px_minmax(0,1fr)] md:gap-5 md:p-4`, with `min-w-0` on `<main>` (prevents chart
  overflow). Content max width about 1200 px; card grid 12 columns, collapsing to 1 column under 768 px.
- Sidebar: `glass-strong`, `sticky top-4 h-[calc(100vh-2rem)]`; app mark at the top; collapsible nav
  groups (for example *Overview*, *Assets*, *Operations*, *Settings*); theme segmented control
  (System / Light / Dark) at the bottom. On phones: a top bar and a flat nav list.
- Active nav item: `--fill-strong` bg + a 3 px lime bar on the left edge + `--ink` text (`aria-current`).
- Filters: one row above the charts (date range, then dimension selects); they apply to every chart on the page.

### 7.1 Charts

- Thin marks: 2 px lines, bars with 4 px rounded data-ends from the baseline, a 2 px surface gap between
  segments, markers ≥ 8 px.
- Grid lines `--chart-grid`, axis text 12 px `--muted`; text never takes a series colour.
- One y-axis only (never a dual axis). Magnitude ramps use the lime `--heat-1…4` (light → dark).
- Hover: crosshair + tooltip on line and area charts, a per-mark tooltip on bars; hit targets larger than the mark.
- Bars grow from the baseline on first draw (0.6 s `cubic-bezier(.2,.8,.2,1)`); no motion afterwards.

## 8. 3D digital-twin integration

The 3D viewport is just another surface in the same system. Recommended with three.js / react-three-fiber.

| Element | Light | Dark |
|---|---|---|
| Scene background | transparent canvas over `--bg` (or `#eeeeee`) | `#050505` |
| Ground / floor grid | `#d9d9d9` major, `#e6e6e6` minor | `#1f1f1f` major, `#141414` minor |
| Neutral model material | `#cfcfcf`, roughness 0.7, metalness 0.1 | `#3a3a3a`, roughness 0.6, metalness 0.2 |
| Hover outline | `#000000`, 2 px | `#f2f2f2`, 2 px |
| **Selected** object | lime `#0fff4f` outline + 15 % emissive | same |
| Status tint (§2.1) | emissive tint 20–35 % on the affected mesh, plus a floating label | same, emissive 30–45 % |
| Ambient + key light | hemisphere `#ffffff`/`#bbbbbb` 0.9, directional 1.2 | hemisphere `#9a9a9a`/`#111111` 0.5, directional 0.9 |

Rules:
1. **Read colours from CSS tokens** at runtime (`getComputedStyle(document.documentElement)
   .getPropertyValue('--brand')`) and update materials when the theme changes (observe the `data-theme`
   attribute and the `prefers-color-scheme` media query). Do not hard-code a second palette in JS.
2. **Overlays on the canvas** (inspector panel, legend, toolbar, sensor tooltips) use `.glass-strong`
   with radius 24 / 12, positioned in a 16 px inset. They block pointer events; the canvas gets the rest.
3. **Labels in 3D** (CSS2D / `<Html>` from drei): pill style `.liquid-capsule`, 12 px, `--ink`, with a
   status icon; collapse labels by distance so no more than about 12 are visible at once.
4. **Camera motion** follows the motion rules: ease `cubic-bezier(.22,1,.36,1)`, 0.8–1.2 s fly-to on
   selection, damping 0.08 on orbit controls. Under `prefers-reduced-motion` the camera jumps instead of flying.
5. **Twin ↔ dashboard linking:** selecting a mesh highlights its row and chart series (lime ring), and the
   reverse. Selection always uses lime; status always uses the §2.1 colours.
6. **Performance:** render on demand (`frameloop="demand"`), cap DPR at 2, and turn off the background
   gradient animation while the canvas is full-screen.
7. **Accessibility:** every 3D object that matters is also listed in a table or tree view next to the canvas
   (keyboard selectable); the canvas has `role="img"` with an `aria-label` summary.

## 9. Motion

| What | Spec |
|---|---|
| Smooth scrolling | Lenis `lenis@1.1.20`: `duration 1.15`, easing easeOutExpo `t => t===1?1:1-2**(-10*t)`, `wheelMultiplier 0.9`, `touchMultiplier 1.4`, anchors offset −16. `prevent` for dialogs, `[data-lenis-prevent]`, `.overflow-*` areas and **the 3D canvas**. Skip entirely under reduced motion. |
| Page enter | Framer Motion `framer-motion@11.11.17`: `opacity 0→1, y 14→0`, 0.36 s, ease `[0.2,0.8,0.2,1]`. Entrance only (no exit wait, so redirects don't stall). Scroll to the top on route change. |
| Card rise on scroll | CSS `animation-timeline: view()`, `translateY(28px) scale(.985) → none`, range `entry 0%–55%`. **Transform only, never opacity.** |
| Micro-interactions | 0.18–0.2 s, `cubic-bezier(.22,1,.36,1)`; press = `translateY(0.5px)`. |
| Background | 40 s gradient drift, transform only. |
| Reduced motion | global `animation-duration/transition-duration: .01ms !important`, no Lenis, camera jumps. |

## 10. Tailwind wiring (optional)

```js
// tailwind.config.js: tokens go through color-mix so opacity modifiers (bg-danger/10) work
const t = (v) => `color-mix(in srgb, var(--${v}) calc(<alpha-value> * 100%), transparent)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      bg: t('bg'), surface: t('surface-solid'), raised: t('surface-raised'), line: t('line'),
      field: t('field'), fill: t('fill'), 'fill-strong': t('fill-strong'), ink: t('ink'), muted: t('muted'),
      primary: t('primary'), 'primary-ink': t('primary-ink'), brand: t('brand'), 'brand-ink': t('brand-ink'),
      accent: t('accent'), warn: t('warn'), danger: t('danger'), 'danger-ink': t('danger-ink'),
    },
    fontFamily: {
      sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      display: ['"Space Grotesk Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
    },
    borderRadius: { card: '24px' },
  } },
}
```

## 11. Accessibility checklist

- [ ] Each token pair used for text is ≥ 4.5:1 (≥ 3:1 for large text, icons and field outlines), checked in both themes.
- [ ] Lime is never body text on a light surface.
- [ ] Status and series identity always carry an icon, label or pattern, not colour alone.
- [ ] Targets ≥ 44×44 px; focus visible on everything.
- [ ] Reduced motion, reduced transparency and forced colours all render correctly.
- [ ] Every chart and 3D view has a table or list alternative.
- [ ] Automated axe check runs on each page in both themes (Playwright + `@axe-core/playwright`).

## 12. Do / don't

| Do | Don't |
|---|---|
| One lime highlight per view | Lime for "OK" status or as a series colour |
| Black primary buttons in light mode, lime in dark | Lime text on white or off-white |
| Separate tuned dark values | `filter: invert()` or auto-generated dark mode |
| Solid fallback for glass | Card opacity < 0.85 behind text |
| Transform-only animation | Animating opacity of content while it scrolls |
| Fixed categorical order | Repainting series after filtering |

---
*Source of truth in the origin project: `v2/frontend/src/index.css`, `tailwind.config.js`,
`src/components/ui.tsx`, `src/components/Layout.tsx`, `src/lib/smoothScroll.ts`,
`src/components/PageTransition.tsx`. The §2.1 status set and the §8 3D values are new recommendations, not yet
used in this app; check their contrast in the target project.*
