
## InsightSphere Outreach Hub — Build Plan

A single-user, desktop-only outreach tool. UI only for now (no real APIs, no backend). One hardcoded password gate on entry. Mock data persisted to `localStorage` so screens feel real between refreshes.

### Scope and assumptions

- Desktop-only layout (no mobile breakpoints).
- No auth system — just a single password screen comparing against a hardcoded string. Successful entry sets a flag in `sessionStorage` so the gate doesn't reappear on reload during the session.
- No Lovable Cloud yet. All data (sources, ICP filters, leads, drafts, prospects, sequence rows, settings) lives in `localStorage` with seeded mock data so every screen has realistic content and empty states can be tested by clearing.
- File upload on Screen 2 stores only the filename in state (no real upload).
- "Run signal scan", "Regenerate draft", "Push to Lemlist", etc. are simulated with a short delay + toast.

### Design system

- Font: Poppins (loaded via `<link>` in `__root.tsx`, registered as `--font-sans` in `@theme`).
- Brand tokens in `src/styles.css` (oklch):
  - `--brand-pink` (#E31B84) → primary actions
  - `--brand-turquoise` (#01A4A9) → status badges, secondary CTAs
  - `--brand-blue` (#4564DA) → active nav highlight
- Override semantic shadcn tokens so `--primary` = pink, sidebar uses dark navy bg with white text and blue active state.
- Clean SaaS aesthetic: white main canvas, subtle borders, generous spacing, rounded-lg cards.

### Routes (TanStack Start file-based)

```
src/routes/
  __root.tsx           (existing; add Poppins <link>, gate logic)
  index.tsx            (redirect to /lead-discovery)
  _app.tsx             (layout: SidebarProvider + AppSidebar + <Outlet/>; guarded by password)
  _app.lead-discovery.tsx
  _app.email-outreach.tsx
  _app.prospect-engagement.tsx
  _app.sequence-monitor.tsx
```

The `_app` pathless layout renders the sidebar shell and the password gate; if not unlocked it renders the password screen instead of `<Outlet/>`.

### Components

- `src/components/app-sidebar.tsx` — shadcn Sidebar, dark variant, InsightSphere logo, 4 nav items with lucide icons (Radar, Mail, MessageCircle, Activity), active item gets blue highlight.
- `src/components/password-gate.tsx` — centered card with password input.
- `src/components/empty-state.tsx` — reusable illustration + message.
- `src/components/status-badge.tsx` — turquoise/pink/grey variants for the various status enums.
- Per-screen sub-components colocated under `src/components/lead-discovery/`, `email-outreach/`, etc. (sources panel, ICP filters, leads table, draft card, watch list, engagement card, sequence table, flagged list).

### Screen specs (matches brief)

1. **Lead Discovery** — Sources panel (toggle + name/URL rows, Add source, Run signal scan button), ICP filters (titles/industries tag inputs, size dropdown, geography text, auto-saved), Leads table with filter bar, row actions, bulk approve/skip.
2. **Email Outreach** — Collapsible Settings (positioning file upload, tone textarea, Lemlist sequence ID, Save), Draft review queue cards for Approved leads with editable subject+body, Regenerate / Approve & push / Skip, "Push all approved" with count badge.
3. **Prospect Engagement** — Watch list table with Add prospect modal, Engagement queue cards (post snippet, link, editable Claude draft, Approve comment / Like only / Skip).
4. **Sequence Monitor** — 4 stat cards, main table, soft-pink row background for "Opened but no reply" with "Flag for manual follow-up" action, flagged list table below with editable notes per row.

Each screen handles its empty state with the messages from the brief.

### State / data layer

- `src/lib/store.ts` — small typed wrapper around `localStorage` (read/write/subscribe) per entity. Seed with realistic mock rows on first load.
- TanStack Query used per screen to read/mutate via these store functions, so the loader/component pattern stays canonical even without a backend.
- Approving a lead in Screen 1 generates a mock draft and moves it into Screen 2's queue; pushing in Screen 2 creates a row in Screen 4; commenting/liking in Screen 3 updates last activity.

### Technical notes

- Tailwind v4 token additions in `src/styles.css` under `@theme` + remap `--primary` etc. via `@theme inline`.
- Poppins loaded with `<link>` in `__root.tsx` head (no `@import` URL in CSS).
- All navigation via `<Link to>`; no `<a href>` for internal routes.
- Use existing shadcn components (`sidebar`, `table`, `card`, `dialog`, `badge`, `button`, `input`, `textarea`, `select`, `switch`, `checkbox`, `dropdown-menu`, `tooltip`, `sonner` for toasts).
- Index page placeholder is replaced (redirects to `/lead-discovery`).

### Out of scope (per brief)

- Real auth, multiple users, mobile responsiveness, any real API integrations (Lemlist, Claude, Sales Navigator, source scraping). Buttons simulate behavior only.

### Open questions

1. What password should gate entry? (e.g. `insightsphere2026` as a placeholder unless you specify.)
2. Confirm sidebar should be dark navy (close to `#0F1B2D`) with white text — OK?
3. Any logo asset to use for "InsightSphere" or should I generate a simple wordmark/icon?
