import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts";
import { ROLE_LABELS } from "./dashboardNav";

// Same item styling as RowActions' menu.
const itemClass = (danger = false) =>
  `w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-left text-sm font-semibold outline-none transition-colors ${
    danger
      ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/20"
      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
  }`;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The top bar's account dropdown: the user's name and role with a chevron, and a
 * menu holding "Back to site" and "Log out". Logging out is handed to the
 * layout, which asks for confirmation first. Closes on an outside tap, Escape,
 * Tab, and after a pick.
 */
export const DashboardUserMenu = ({ onLogout }: { onLogout: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") focusAt(i + 1);
    else if (e.key === "ArrowUp") focusAt(i - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(items.length - 1);
    else if (e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  if (!user) return null;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 sm:gap-3 min-h-11 pl-1 pr-2 sm:pr-3 py-1 rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sffl-red/40 ${
          open
            ? "ring-2 ring-sffl-red/40 bg-gray-50 dark:bg-white/5"
            : "hover:bg-gray-100 dark:hover:bg-white/10"
        }`}
      >
        <span
          aria-hidden="true"
          className="w-9 h-9 shrink-0 rounded-full bg-sffl-red text-white text-xs font-black flex items-center justify-center"
        >
          {initialsOf(user.name)}
        </span>
        <span className="hidden sm:flex flex-col items-start min-w-0 text-left leading-tight">
          <span className="max-w-40 truncate text-sm font-bold text-sffl-navy dark:text-white transition-colors">
            {user.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{roleLabel}</span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 max-w-[calc(100vw-1rem)] p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          <div className="px-3 pt-2.5 pb-3 mb-1 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            <p className="sm:hidden mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-sffl-red/10 text-sffl-red dark:text-red-300 text-[11px] font-bold">
              {roleLabel}
            </p>
          </div>
          <div ref={menuRef} id={menuId} role="menu" aria-label="Account" onKeyDown={onMenuKeyDown}>
            <Link role="menuitem" to="/" onClick={() => setOpen(false)} className={itemClass()}>
              <ArrowUturnLeftIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              Back to site
            </Link>
            <div role="separator" className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                // Close first, so the confirm dialog isn't fighting the menu for focus.
                setOpen(false);
                onLogout();
              }}
              className={itemClass(true)}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
