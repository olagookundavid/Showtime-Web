import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export type RowAction = {
    label: string;
    icon: ComponentType<{ className?: string }>;
    onSelect?: () => void;
    /** Renders the item as a link that opens in a new tab. */
    href?: string;
    /** Red text, for delete, revoke and the like. */
    danger?: boolean;
    disabled?: boolean;
    /** One short line under the label, e.g. why the action is disabled. */
    hint?: string;
};

type Props = {
    /** Accessible name for the button and the menu, e.g. "Actions for Week 3". */
    label: string;
    actions: RowAction[];
};

const GAP = 4; // between the button and the menu
const EDGE = 8; // minimum distance from the viewport edge

const itemClass = (a: RowAction) =>
    `w-full flex items-start gap-3 px-3 py-2.5 min-h-11 rounded-lg text-left text-sm font-semibold outline-none transition-colors ${
        a.disabled
            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700'
            : a.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:bg-red-50 dark:focus-visible:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700'
    }`;

/**
 * The three-dot button in a DataTable's Actions column. It opens a dropdown of
 * every action for that row. The menu is portalled to <body> with fixed
 * positioning, because DataTable's sideways-scrolling wrapper would clip it.
 * It closes on an outside tap, Escape, resize, any scroll, and after a pick.
 */
export const RowActions = ({ label, actions }: Props) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    // Right-aligned under the button, flipped above it when there is no room
    // below, and kept inside the viewport. Written straight to the node so the
    // menu is placed before the browser paints it.
    useLayoutEffect(() => {
        const trigger = triggerRef.current;
        const menu = menuRef.current;
        if (!open || !trigger || !menu) return;
        const t = trigger.getBoundingClientRect();
        const { offsetWidth: w, offsetHeight: h } = menu;
        let top = t.bottom + GAP;
        if (top + h > window.innerHeight - EDGE && t.top - GAP - h >= EDGE) top = t.top - GAP - h;
        const left = Math.max(EDGE, Math.min(t.right - w, window.innerWidth - w - EDGE));
        menu.style.top = `${Math.max(EDGE, top)}px`;
        menu.style.left = `${left}px`;
        menu.style.visibility = 'visible';
        menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
        };
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            close();
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        // Capture catches scrolling in any container, including the table's own sideways scroll.
        document.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const focusAt = (n: number) => items[(n + items.length) % items.length]?.focus();
        if (e.key === 'ArrowDown') focusAt(i + 1);
        else if (e.key === 'ArrowUp') focusAt(i - 1);
        else if (e.key === 'Home') focusAt(0);
        else if (e.key === 'End') focusAt(items.length - 1);
        else if (e.key === 'Tab') setOpen(false);
        else return;
        if (e.key !== 'Tab') e.preventDefault();
    };

    // Close first, so a ConfirmDialog opened by the action is not fighting the menu for focus.
    const choose = (a: RowAction) => {
        if (a.disabled) return;
        setOpen(false);
        a.onSelect?.();
    };

    const content = (a: RowAction) => (
        <>
            <a.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
                <span className="block">{a.label}</span>
                {a.hint && (
                    <span className="block mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">{a.hint}</span>
                )}
            </span>
        </>
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
            >
                <EllipsisVerticalIcon className="w-5 h-5" aria-hidden="true" />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={menuRef}
                        id={menuId}
                        role="menu"
                        aria-label={label}
                        onKeyDown={onMenuKeyDown}
                        style={{ top: 0, left: 0, visibility: 'hidden' }}
                        className="fixed z-90 w-max min-w-48 max-w-[min(18rem,calc(100vw-1rem))] p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg"
                    >
                        {actions.map((a) =>
                            a.href && !a.disabled ? (
                                <a
                                    key={a.label}
                                    role="menuitem"
                                    href={a.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpen(false)}
                                    className={itemClass(a)}
                                >
                                    {content(a)}
                                </a>
                            ) : (
                                <button
                                    key={a.label}
                                    type="button"
                                    role="menuitem"
                                    aria-disabled={a.disabled || undefined}
                                    onClick={() => choose(a)}
                                    className={itemClass(a)}
                                >
                                    {content(a)}
                                </button>
                            ),
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
};
