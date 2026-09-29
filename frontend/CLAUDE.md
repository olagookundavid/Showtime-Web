# Frontend guide

Standing rules for all code under `frontend/`. Follow them without being asked. Add each new rule the owner gives here, and keep this file succinct.

**Scope:** when you edit a file, apply every rule to the whole file (text icons, native `confirm()`/`alert()`, responsiveness gaps, hand-written tables, dashboard page headers, first-time usability), and to the components a page renders for responsiveness. Don't edit other files just for these rules.

## 1. No text icons

Never use emoji, Unicode symbols or text as icons (`✅ 🔍 ⚡ ⭐ ✕ ✓ ← → ▲ ▼ ●`, an `x` or `>` for an icon, `...` as a loading indicator) in JSX, labels, headings, `toast()` or dialog strings. Currency signs like `₦`, the `—` empty-cell placeholder and punctuation are typography and stay.

1. **Heroicons** (`@heroicons/react`): `24/outline`, or `24/solid` for filled or active states. Check `node_modules/@heroicons/react/24/outline` before deciding one doesn't exist.
2. **Custom SVG**, only when no heroicon depicts the exact thing (a football, a gender symbol), never a loosely related one. Outline style: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.5}`, round caps and joins, sized with `className`. Used in more than one place? Make it a component in `src/components/icons/` (see `RunnerIcon.tsx`).

- Size `w-4 h-4` beside text, `w-5 h-5` in headings and larger controls. Align with `inline-flex items-center gap-1.5`.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons get an `aria-label`.
- Loading: `ArrowPathIcon` with `animate-spin`, or `<Spinner />` (`src/components/ui/`).

## 2. Confirm every write, and logout

Actions that create, update or delete data or change a record's state (saves, deletes, check-in, verify, approve, revoke, publish, send, reset, force), and logout, run only after a confirm dialog. Reading, filtering, sorting, paging, switching tabs, opening a form and marking notifications read don't.

- `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) props: `open`, `title`, `description?`, `body?`, `confirmLabel`, `tone`, `icon` (a heroicon), `pending`, `maxWidth?` (`'md'` unless the body needs room), `onConfirm`, `onCancel`. Name the affected record with a `ConfirmSummary` (`src/components/ui/ConfirmSummary.tsx`) in `body`.
- Tone: `success` for positive completions (check in, approve), `info` for neutral changes and saves, `warning` for destructive, irreversible or forced actions (delete, revoke, reset, force).
- Logout: title "Log out?", `confirmLabel` "Log out", `tone="info"`, `icon={ArrowRightOnRectangleIcon}`.
- Never use `confirm()`, `window.confirm()` or `alert()`. Report results with `toast` from `react-hot-toast` (mounted in `App.tsx`).
- Pattern (`src/pages/admin/AdminTickets.tsx`):
  1. The button stores the pending action (`setPendingAction({ kind, item })`) instead of calling the handler.
  2. One `<ConfirmDialog>` per page reads that state. Its title says what will happen, and its body names the record.
  3. `onConfirm` runs the handler with `pending` true while the request is in flight, then the dialog closes. `onCancel` clears the state.

## 3. Responsive at every size

Every page you change or build works from a 320px phone to a wide monitor.

- **Mobile first.** Base classes are for the smallest screen. Add `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px). Don't write desktop styles and undo them with `max-*:`.
- **No horizontal page scroll.**
  - No fixed pixel widths on containers. Use `w-full` with `max-w-*`, percentages, grid or flex.
  - Give flex and grid children whose text must shrink `min-w-0`.
  - Use `truncate`, `break-words` or `line-clamp-*` on long values, and `max-w-full` on media.
- **Reflow.** Grids collapse (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Control rows wrap (`flex-wrap`) or stack (`flex-col sm:flex-row`). Spacing and type scale up with the breakpoint.
- **Tables:** see §4. Don't hide a column unless its information is offered another way.
- **Touch targets** are at least 44px (`min-h-11 min-w-11`, or padding), with room between them. Nothing that matters depends on hover.
- **Modals fit the viewport.**
  - Height: `max-h-[calc(100dvh-2rem)]` (prefer `dvh` to `vh`), with an `overflow-y-auto` body.
  - Width: `w-full` up to `max-w-*`, with a margin on small screens.
  - Footer buttons stack or wrap.
- **Fixed chrome.**
  - Layout provides the page width (`--max-width-page`), the sticky navbar and the mobile bottom nav. Don't add a page-level max-width.
  - Clear the bottom nav with `pb-mobile-nav-2x` (`src/index.css`).
  - Keep anything pinned to a screen edge clear of the bottom nav and the notch (`env(safe-area-inset-*)`).
- **Check** at about 320, 375, 768, 1024 and 1440px before calling it done: no sideways scroll, nothing overlapping or clipped, every control reachable.

## 4. Tables: DataTable

Every table uses `DataTable` (`src/components/ui/DataTable.tsx`, built on TanStack Table). Never hand-write a `<table>`.

- **Columns** are `Column<T>` (`header`, `accessor`, `cell`, `sortable`, `sortValue`, `align`, `className`). Pages don't use TanStack Table directly.
  - Define columns once with `useMemo`. When a page shows the same columns twice, share them (see `AdminTickets.tsx`).
  - Keep `data` stable too: a module-level `const NO_ROWS: Row[] = []`, not an inline `?? []`.
- **Server-paginated lists** pass `serverPage`, `totalServerPages` and `onPageChange`, plus `onSearchSubmit` for server search. A sortable header there only reorders the loaded rows. Local lists let `DataTable` search, sort and page in the browser.
- **Other props:** `loading`, `paginated={false}`, `getRowId`, `emptyMessage`, `searchable={false}`, `compact` (no 800px minimum width, for tables in dialogs or narrow cards) and `headerActions` (toolbar filters and buttons).
- **The same table on every screen.** On phones it scrolls sideways inside its card (`DataTable` does this). No card layout; the owner doesn't want one.
- **The first column is frozen,** so it must name the row (player, team, match). Never lead with a narrow column like `#` or `Pos`; fold it into the name cell or put it second.
- **Row actions.** Rows with actions end in an `Actions` column (`align: 'right'`) holding `<RowActions>` (`src/components/ui/RowActions.tsx`): a three-dot button on every row that opens a dropdown of all that row's actions. No inline action buttons. An action that can't run on a row stays in the menu, disabled, with a `hint` saying why.
- **Missing a feature?** Add it to `DataTable` as an optional prop instead of hand-writing a table. Ask first if the change is large.

## 5. Dashboards

Dashboard layouts (admin, team head, player portal, seller) render `DashboardShell` (`src/components/dashboard/`) with a nav file such as `teamHeadNav.ts`.

Every dashboard page (`src/pages/admin/`, `src/pages/team-head/`, `src/pages/player-portal/`, `src/pages/seller/`) starts with its own `DashboardPageHeader` (`src/components/dashboard/DashboardPageHeader.tsx`). Never hand-write an `<h1>`, banner or card header there. The look lives in that component only; change it there.

- **Title:** the page's sidebar label in Title Case (`Matches`, `Play by Play`), so page and sidebar agree. Detail pages (an order, a team) use their own title plus `back={{ to, label }}`.
- **Subtitle:** one sentence on every page saying what it's for. Pass a `ReactNode` for live values.
- **Actions:** primary buttons go in `actions`, on the right from 640px up. Search boxes and filters go in their own row below the header.
- No italics, uppercase, icon tiles, banners or per-page sizes.

## 6. First-time users

Every UI change and new page must be easy for someone using the app for the first time. Put UX and UI first.

- **Say what things are.** Plain-word labels, a subtitle saying what the page is for, a heading on each section.
- **Show, don't hide.** Put what people need to decide (who, how many, status) on the page, not behind a dialog or an extra click.
- **Obvious next step.** One primary action per page or section. Links look like links, and a record's name opens its detail page. A status badge is never a secret button.
- **Helpful empty states.** Say what's missing, why it matters, and give a link or button to fix it.
- **Predictable.** Reuse the shared components and patterns above so every page behaves the same way.
- **Check** by walking the page as a newcomer: can they tell where they are, what they can do, and how to get back?
