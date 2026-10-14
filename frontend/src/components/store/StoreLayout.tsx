import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBagIcon, TicketIcon } from "@heroicons/react/24/outline";
import { useIsScrolled } from "../../hooks";
import { Tabs } from "../ui/Tabs";

// The store layout: a tab bar that switches between Tickets (which nests its own
// Season Pass / Game Pass / Gameday Tickets picker) and the Showtime Store. The
// active tab comes from the URL, so each tab is a real route and the browser back
// button works as expected.
export const StoreLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = pathname.startsWith("/tickets") ? "tickets" : "store";

  // Fades in a shadow once pinned, so the bar reads as floating above the
  // content scrolling underneath it rather than flush against it.
  const isScrolled = useIsScrolled();

  // Pins directly under the sticky navbar (and scores carousel, where it
  // shows) while scrolling. Its own height is measured and published so the
  // nested ticket-mode tabs can stack sticky below it in turn.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--store-tabs-h",
        `${el.offsetHeight}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--store-tabs-h");
    };
  }, []);

  return (
    <div className="space-y-6 md:space-y-8">
      <div
        ref={tabsRef}
        className={`sticky z-40 bg-white transition-shadow duration-300 ease-out dark:bg-gray-900 ${
          isScrolled ? "shadow-md dark:shadow-black/40" : "shadow-none"
        }`}
        style={{ top: "var(--chrome-h)" }}
      >
        <Tabs
          fill
          aria-label="Store sections"
          items={[
            { value: "tickets", label: "Tickets", icon: TicketIcon },
            { value: "store", label: "Showtime Store", icon: ShoppingBagIcon },
          ]}
          value={active}
          onChange={(tab) => navigate(tab === "tickets" ? "/tickets" : "/store")}
        />
      </div>
      <Outlet />
    </div>
  );
};
