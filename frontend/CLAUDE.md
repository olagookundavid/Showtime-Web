# Frontend guide

Standing rules for all code written under `frontend/`. Follow them on every change without being asked. The owner will add more rules over time; add each new one to this file as it is given.

## 1. Icons: no text icons

Never use emoji, Unicode symbols or plain-text characters as icons: `✅ 🔍 ⚡ ⭐ ✕ ✓ ← → ▲ ▼ ●`, an `x` or `>` standing in for an icon, or `...` as a loading indicator. This applies to JSX, button labels, headings, and strings passed to `toast()` or dialogs.

Use, in this order:

1. **Heroicons** (`@heroicons/react`, already installed). Import from `@heroicons/react/24/outline`, and from `@heroicons/react/24/solid` for filled or active states, e.g. `import { XMarkIcon } from '@heroicons/react/24/outline'`. Check the icon names in `node_modules/@heroicons/react/24/outline` before deciding there isn't one.
2. **A custom SVG, when no heroicon depicts the exact thing** (a football, a male/female symbol). Draw it yourself in Heroicons' outline style: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.5}`, round line caps and joins, no fixed width or height (size it with `className`). Never swap in a loosely related heroicon. If it is used in more than one place, make it a small component in `src/components/icons/` that takes `className`.

Details:

- Size: `w-4 h-4` next to text, `w-5 h-5` in headings and larger controls. Align icon and label with `inline-flex items-center gap-1.5`.
- Decorative icons get `aria-hidden="true"`. An icon-only button needs an `aria-label`.
- Loading: `ArrowPathIcon` with `animate-spin`, or the existing `<Spinner />` in `src/components/ui/`.
- **When you edit a file that already has text icons, replace all of them in that file**, not only the lines you were asked to change. Do not edit other files just for icons.
- Plain typography is not an icon: `₦` and other currency signs, the `—` used as an empty-cell placeholder, and punctuation stay as text.

## 2. Confirm before every write, and before logout

Before running any action that creates, updates or deletes data, or changes a record's state, show a confirm dialog and run the action only if the user confirms. This covers form saves ("Create", "Save changes"), deletes, and status changes such as check-in, verify, approve, revoke, publish, send, reset and force. **Logging out always needs a confirm too.** Reading, filtering, sorting, paging, switching tabs and opening a form or modal do not.

Use the shared dialog, `src/components/ui/ConfirmDialog.tsx`:

- Props: `open`, `title`, `description?`, `body?` (what is affected), `confirmLabel`, `tone` (`'success' | 'info' | 'warning'`), `icon` (a heroicon), `pending`, `onConfirm`, `onCancel`.
- Tone: `success` for positive completions (check in, approve), `info` for neutral changes and saves, `warning` for destructive, irreversible or forced actions (delete, revoke, reset, force).
- Logout: title "Log out?", `confirmLabel` "Log out", `tone="info"`, `icon={ArrowRightOnRectangleIcon}`.
- Never use `window.confirm()`, `confirm()` or `alert()`. Report results with `toast` from `react-hot-toast` (`<Toaster>` is already mounted in `App.tsx`).
- **When you edit an action that still uses native `confirm()` or `alert()`, replace them** with ConfirmDialog and toasts. As with icons, only in the code you are already changing.

Pattern (see `src/pages/admin/AdminTickets.tsx`):

1. The button does not call the handler. It stores what is about to happen, e.g. `setPendingAction({ kind, item })`.
2. One `<ConfirmDialog>` per page reads that state. The title says what will happen ("Delete this product?") and the body names the record affected.
3. `onConfirm` runs the handler. `pending` is true while the request is in flight, and the dialog closes when it finishes. `onCancel` clears the state.

## 3. Every page is responsive at every screen size

Whenever you change a page, or build a new one, make sure the **whole page** is responsive, not only the lines you touched. If it is not responsive yet, fix that as part of the same change. This applies to pages and to the components they render. It does not mean going through pages you are not otherwise editing.

"Responsive" means it works and looks right on every screen size, from a 320px phone up to a wide desktop monitor. Do not build for one width and patch the rest later.

- **Mobile first.** Write the base classes for the smallest screen, then add `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px) and `2xl:` (1536px) overrides as space allows. Do not write desktop styles and then undo them on mobile with `max-*:` variants.
- **No horizontal page scroll** at any width. Nothing may push the page wider than the viewport. Avoid fixed pixel widths on containers; use `w-full` with `max-w-*`, percentages, `grid` or `flex`. Give flex and grid children `min-w-0` when their text must be allowed to shrink, and use `truncate`, `break-words` or `line-clamp-*` on long names and values. Images and media get `max-w-full`.
- **Layouts reflow.** Multi-column grids collapse on small screens (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), rows of controls wrap (`flex-wrap`) or stack (`flex-col sm:flex-row`), and spacing and type sizes scale up with the breakpoint rather than being sized for desktop only.
- **Tables and wide content.** Wrap a table that is wider than a phone in `overflow-x-auto` so only the table scrolls, or switch to a stacked card layout on small screens. Do not hide columns that carry the information without offering it another way.
- **Touch targets.** Anything tappable is at least 44px tall and wide on touch screens (`min-h-11 min-w-11`, or enough padding), with room between neighbouring targets. Do not rely on hover for anything that matters; there is no hover on a phone.
- **Modals and dialogs** fit inside the viewport: `max-h-[calc(100dvh-2rem)]` (or similar) with `overflow-y-auto` on the body, and a width of `w-full` up to `max-w-*` with a margin on small screens. Buttons in the footer stack or wrap instead of overflowing. Prefer `dvh` over `vh` so mobile browser toolbars do not cut off the bottom.
- **Fixed chrome.** Layout already provides the page width (`--max-width-page`), the sticky navbar and the fixed bottom nav on mobile. Do not add your own page-level max-width. Leave room at the bottom of pages for the mobile bottom nav with `pb-mobile-nav-2x` (see `src/index.css`), and keep anything you pin to the screen edge clear of it and of the notch (`env(safe-area-inset-*)`).
- **Check it.** Before calling the work done, look at the page at about 320, 375, 768, 1024 and 1440px wide (browser devtools device toolbar is fine) and confirm there is no sideways scroll, no overlapping or clipped content, and that every control is reachable and usable.
