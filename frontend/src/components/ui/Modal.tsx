import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { IconButton } from "./IconButton";
import type { Shape } from "./Button";

type Props = {
  open: boolean;
  /** Omit to make a gate that can't be dismissed: no close button, Escape or backdrop click. */
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Action buttons pinned below the body. Put Cancel first and the primary action last. */
  footer?: React.ReactNode;
  /** `full` fills almost the whole screen, for working surfaces like the rich-text editor. */
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  /** `square` for sharp corners (store pages). */
  shape?: Shape;
};

const widthClass: Record<NonNullable<Props["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  full: "max-w-[96rem]",
};

// Open modals, oldest first. Escape closes only the newest, so a dialog opened
// from inside another one (a policy from the quick view) doesn't close both.
const openModals: string[] = [];

// Lightweight modal: dark backdrop, scrollable inner card, ESC + click-outside
// to close. Rendered through a portal so it escapes whatever stacking context
// the trigger lives in.
export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "xl",
  shape = "round",
}: Props) => {
  const id = useId();

  useEffect(() => {
    if (!open) return;
    openModals.push(id);
    // Prevent background scroll while the modal is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      const index = openModals.indexOf(id);
      if (index >= 0) openModals.splice(index, 1);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openModals[openModals.length - 1] === id) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, id]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn"
      data-dialog
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-gray-800 ${shape === "square" ? "rounded-none" : "rounded-2xl"} ${widthClass[maxWidth]} w-full shadow-2xl ${maxWidth === "full" ? "h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-3rem)]" : "max-h-[calc(100dvh-5rem)] sm:max-h-[85dvh]"} flex flex-col overflow-hidden my-auto border border-gray-100 dark:border-gray-700`}
      >
        {(title || subtitle || onClose) && (
          <div className="flex justify-between items-start gap-4 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-xl font-black text-sffl-navy dark:text-white"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-bold">
                  {subtitle}
                </p>
              )}
            </div>
            {onClose && (
              <IconButton
                icon={XMarkIcon}
                label="Close"
                onClick={onClose}
                className="-mx-2.5 -mb-2.5 -mt-3.5"
              />
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 pb-10 sm:pb-6 flex-1 min-h-0">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 sm:p-6 pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
};
