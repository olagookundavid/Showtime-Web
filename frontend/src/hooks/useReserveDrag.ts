import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { FantasySlot } from "../types";

const DRAG_THRESHOLD_PX = 6; // mouse: movement before a press becomes a drag
const TOUCH_HOLD_MS = 220; // touch: press-and-hold before a drag starts
const TOUCH_SLOP_PX = 10; // touch: moving more than this first means "scrolling"
const EDGE_PX = 90; // distance from the scroll area's edge that triggers auto-scroll
const MAX_SCROLL_SPEED = 18; // px per frame at the very edge

export interface ReserveDragState {
  playerId: string;
  x: number;
  y: number;
  over: FantasySlot | null;
}

/** The pitch slot under a screen point (the drag ghost has pointer-events: none). */
function slotAtPoint(x: number, y: number): FantasySlot | null {
  const el = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-pitch-slot]");
  return (el?.dataset.pitchSlot as FantasySlot | undefined) ?? null;
}

/** Nearest scrollable ancestor, or null when the window itself scrolls. */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (
      (oy === "auto" || oy === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function edgeSpeed(y: number, top: number, bottom: number): number {
  if (y < top + EDGE_PX) {
    const ratio = Math.min(1, (top + EDGE_PX - y) / EDGE_PX);
    return -Math.max(1, Math.round(MAX_SCROLL_SPEED * ratio));
  }
  if (y > bottom - EDGE_PX) {
    const ratio = Math.min(1, (y - (bottom - EDGE_PX)) / EDGE_PX);
    return Math.max(1, Math.round(MAX_SCROLL_SPEED * ratio));
  }
  return 0;
}

/**
 * Drag a reserve from the bench onto a pitch slot. Call `startDrag` from a row's
 * onPointerDown; `onDrop` fires with the slot under the pointer on release.
 */
export function useReserveDrag(
  onDrop: (playerId: string, slot: FantasySlot) => void,
) {
  const [drag, setDrag] = useState<ReserveDragState | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);
  useEffect(() => () => stopRef.current?.(), []);

  const startDrag = (e: ReactPointerEvent<HTMLElement>, playerId: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Let the row's own buttons (Start, Sell) behave normally.
    if ((e.target as HTMLElement).closest("button, a, input, select")) return;
    stopRef.current?.();

    const { pointerId, pointerType } = e;
    const startX = e.clientX;
    const startY = e.clientY;
    const scroller = scrollParentOf(e.currentTarget);
    let active = false;
    let holdTimer: number | undefined;
    let raf = 0;
    let lastX = startX;
    let lastY = startY;

    function begin() {
      active = true;
      navigator.vibrate?.(8);
      setDrag({
        playerId,
        x: lastX,
        y: lastY,
        over: slotAtPoint(lastX, lastY),
      });
      raf = requestAnimationFrame(tick);
    }

    // Auto-scroll while the pointer sits near the top/bottom of the scroll area.
    function tick() {
      if (!active) return;
      const rect = scroller?.getBoundingClientRect();
      const top = Math.max(rect?.top ?? 0, 0);
      const bottom = Math.min(
        rect?.bottom ?? window.innerHeight,
        window.innerHeight,
      );
      const dy = edgeSpeed(lastY, top, bottom);
      if (dy !== 0) {
        if (scroller) scroller.scrollBy(0, dy);
        else window.scrollBy(0, dy);
        // The content moved under a still pointer, so re-check what is beneath it.
        const over = slotAtPoint(lastX, lastY);
        setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
      }
      raf = requestAnimationFrame(tick);
    }

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        const moved = Math.hypot(lastX - startX, lastY - startY);
        if (pointerType === "touch") {
          // Moved before the hold finished: the user is scrolling.
          if (moved > TOUCH_SLOP_PX) stop();
          return;
        }
        if (moved < DRAG_THRESHOLD_PX) return;
        begin();
        return;
      }
      setDrag({
        playerId,
        x: lastX,
        y: lastY,
        over: slotAtPoint(lastX, lastY),
      });
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const wasActive = active;
      const over = wasActive ? slotAtPoint(ev.clientX, ev.clientY) : null;
      stop();
      if (over) onDropRef.current(playerId, over);
    }

    function onCancel(ev: PointerEvent) {
      if (ev.pointerId === pointerId) stop();
    }

    // Once a drag is live, stop the page scrolling under the finger.
    function onTouchMove(ev: TouchEvent) {
      if (active && ev.cancelable) ev.preventDefault();
    }

    function stop() {
      active = false;
      window.clearTimeout(holdTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      stopRef.current = null;
      setDrag(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    stopRef.current = stop;

    if (pointerType === "touch") {
      holdTimer = window.setTimeout(begin, TOUCH_HOLD_MS);
    }
  };

  return { drag, startDrag };
}
