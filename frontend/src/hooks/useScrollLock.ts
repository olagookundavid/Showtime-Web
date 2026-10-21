import { useEffect, useId } from "react";

// Lockers currently wanting the background frozen, oldest first. A stack
// (not a boolean) so a dialog opened from inside a drawer, or a confirm
// dialog opened from inside another modal, doesn't unlock the page when the
// inner one closes while the outer one is still open.
const lockers: string[] = [];
let savedScrollY = 0;

/**
 * Freezes the page at its current scroll position while `active` is true.
 * `overflow: hidden` on body alone doesn't reliably stop it on iOS Safari —
 * touch-drag can still nudge the page. Taking body out of the scroll flow
 * with `position: fixed` (and restoring the exact scroll offset after)
 * is the standard fix that actually holds on touch devices.
 */
export const useScrollLock = (active: boolean) => {
  const id = useId();

  useEffect(() => {
    if (!active) return;

    if (lockers.length === 0) {
      savedScrollY = window.scrollY;
      const { style } = document.body;
      style.position = "fixed";
      style.top = `-${savedScrollY}px`;
      style.left = "0";
      style.right = "0";
      style.width = "100%";
    }
    lockers.push(id);

    return () => {
      const index = lockers.indexOf(id);
      if (index >= 0) lockers.splice(index, 1);
      if (lockers.length === 0) {
        const { style } = document.body;
        style.position = "";
        style.top = "";
        style.left = "";
        style.right = "";
        style.width = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active, id]);
};
