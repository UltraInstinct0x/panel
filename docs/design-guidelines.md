# Panel Design Guidelines

_Last updated: 2026-05-26_

This document codifies the current design system used in `~/panel`.

Primary source-of-truth inputs:
- `app/globals.css`
- `app/_components/AppShell.tsx`
- shared shell/chrome conventions from the `panel-project` skill

---

## 1) Design intent

Panel should feel like a **control panel**: dense, practical, signal-heavy, and calm.

- Dark-first
- Minimal fluff
- Clear hierarchy
- Operational tone over playful consumer aesthetics

---

## 2) Color system (dark-first, linear-like)

### Backgrounds
- `--bg`: `#08090a`
- `--bg-2`: `#0f1011`
- `--bg-3`: `#191a1b`
- `--bg-4`: `#28282c`

### Foregrounds
- `--fg`: `#f7f8f8`
- `--fg-2`: `#d0d6e0`
- `--fg-dim`: `#8a8f98`
- `--fg-faint`: `#62666d`

### Accent + semantic
- `--accent`: `#67e8f9` (brand)
- `--accent-2`: `#f59e0b` (warn)
- `--ok`: `#4ade80`
- `--danger`: `#f87171`

### Borders / surfaces
- `--border`: `rgba(255,255,255,0.08)`
- `--border-subtle`: `rgba(255,255,255,0.05)`
- `--border-solid`: `#23252a`

Use low-gloss, low-contrast surface separation. Avoid loud gradients.

---

## 3) Typography

### Fonts
- UI sans: `Inter` via `--sans`
- Mono/data/widget/code: `JetBrains Mono` via `--mono`

### Feature settings
- `--feat: "cv01", "ss03"`

### Tone
- Compact, tight tracking
- Clean readability over decorative type treatments

---

## 4) Shape system

- `--radius`: `6px`
- `--radius-lg`: `12px`

Patterns:
- Small controls/cards: 6px-ish geometry
- Containers/frames/modals: 12px-ish geometry
- Pills/badges: full rounded (`9999px`)

---

## 5) Components

### Cards
- Elevated dark surfaces (`rgba(255,255,255,0.02)` style range)
- Subtle borders
- Slight hover lift (`translateY(-2px)`)
- No flashy shadows or glassmorphism gimmicks

### Pills / badges
- Fully rounded
- Semantic variants:
  - `.badge-ok`
  - `.badge-warn`
  - `.badge-danger`
  - `.badge-accent`

### Buttons
- Two primary families:
  - ghost / neutral (`.btn`, `.btn-ghost`)
  - accent primary (`.btn-primary`)
- Crisp state changes; no loud gradients

---

## 6) Layout rhythm

### Spacing cadence
- Section spacing desktop: `96px`
- Section spacing mobile: `56px`

### Containers
- Standard: `.container` (max-width ~1200)
- Narrow: `.container-narrow` (max-width ~720)

Use deliberate width buckets per page intent (wide/docs/narrow/flush conventions).

---

## 7) Navigation and chrome model

Global shell is centralized in `AppShell`.

### Global topbar
- Always rendered through `app/_components/AppShell.tsx`
- Do not mount per-page nav manually

### Chromeless routes (no nav, no footer)
- `/embed`
- `/widget`
- `/login-admin`
- `/api/*`

### No-footer routes (keep nav, suppress footer)
- `/admin`
- `/dashboard`
- `/operator`
- `/review`

### Footer policy
- Single shared footer source in `AppShell`
- Reused across marketing/docs/legal/contact surfaces
- No per-page custom footer duplication

---

## 8) UX tone and interaction quality

- “Control panel” density
- Practical hierarchy
- Signal-heavy surfaces
- Minimal ornament
- Motion is subtle and functional

Prefer clarity and operator confidence over novelty.

---

## 9) Implementation rules for contributors

1. Treat `globals.css` tokens as canonical; extend before inventing one-off values.
2. Use `--sans` for product UI and `--mono` for widget/data/code surfaces.
3. Preserve dark-first contrast model and muted palette hierarchy.
4. Keep border/hover effects subtle.
5. Route chrome behavior through `AppShell`; do not fork shell logic in page components.
6. Avoid introducing bright gradients or playful consumer-style visuals on core product surfaces.

---

## 10) Fast reference (copy/paste)

```css
:root {
  --bg: #08090a;
  --bg-2: #0f1011;
  --bg-3: #191a1b;
  --bg-4: #28282c;

  --fg: #f7f8f8;
  --fg-dim: #8a8f98;

  --accent: #67e8f9;
  --ok: #4ade80;
  --danger: #f87171;

  --border: rgba(255,255,255,0.08);
  --radius: 6px;
  --radius-lg: 12px;

  --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  --feat: "cv01", "ss03";
}
```

---

If these guidelines drift from implementation, update this file and `globals.css`/`AppShell.tsx` in the same PR.