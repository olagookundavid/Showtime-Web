import { useState, useEffect, useRef } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useTheme } from "../../contexts/ThemeContext";

// Keeps the toggle inside the viewport and, on the breakpoints where the fixed
// bottom nav is on screen (below lg), above it. Applied on load as well as on
// drag: the position is persisted, so a spot saved before the nav existed — or
// saved on a desktop window and later opened on a phone — would otherwise be
// restored sitting underneath it.
const clampPosition = (pos: { x: number; y: number }) => {
  const minBottom = window.innerWidth < 1024 ? 9 : 1;
  return {
    x: Math.max(1, Math.min(pos.x, 96)),
    y: Math.max(minBottom, Math.min(pos.y, 96)),
  };
};

// Saved position, read once on mount.
const loadPosition = () => {
  try {
    const savedPos = localStorage.getItem("sffl_toggle_pos");
    if (savedPos) {
      const parsed = JSON.parse(savedPos);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return clampPosition(parsed);
      }
    }
  } catch (e) {
    console.error("Failed to parse toggle position", e);
  }
  return { x: 2, y: 92 }; // Default position: top-right corner
};

export const FloatingThemeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [position, setPosition] = useState(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Re-clamp when the viewport changes. Crossing the lg breakpoint — rotating a
  // tablet, or dragging a desktop window narrow — brings the fixed bottom nav
  // into play, and a position that was legal a moment ago can end up underneath
  // it. Skipped mid-drag so this never fights the pointer.
  useEffect(() => {
    if (isDragging) return;
    const onResize = () =>
      setPosition((prev) => {
        const next = clampPosition(prev);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = position;

    if (dragRef.current) {
      dragRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    // Convert delta to percentages based on window size
    const dxPct = (dx / window.innerWidth) * 100;
    const dyPct = (dy / window.innerHeight) * 100;

    // Position is relative to the bottom-right origin.
    setPosition(
      clampPosition({
        x: posStartRef.current.x - dxPct,
        y: posStartRef.current.y - dyPct,
      }),
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (dragRef.current) {
      dragRef.current.releasePointerCapture(e.pointerId);
    }

    if (hasMovedRef.current) {
      localStorage.setItem("sffl_toggle_pos", JSON.stringify(position));
    }
  };

  const handleClick = () => {
    if (!hasMovedRef.current) {
      toggleDarkMode();
    }
  };

  // Use derived styles based on standard right/bottom CSS
  const style = {
    right: `${position.x}vw`,
    bottom: `${position.y}vh`,
    touchAction: "none", // Prevent scrolling while dragging on mobile
  };

  return (
    <button
      ref={dragRef}
      // The admin shell has its own theme button in its top bar, so index.css
      // hides this one there.
      data-floating-theme-toggle
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={style}
      className={`fixed z-9999 p-3 rounded-full backdrop-blur-md shadow-2xl transition-transform active:scale-90 flex items-center justify-center border-2
                ${
                  isDarkMode
                    ? "bg-sffl-navy/90 text-yellow-400 border-white/20"
                    : "bg-white/90 text-sffl-navy border-sffl-navy/10"
                }
                ${isDragging ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-110"}
            `}
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? (
        <SunIcon className="w-6 h-6 shrink-0" aria-hidden="true" />
      ) : (
        <MoonIcon className="w-6 h-6 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
};
