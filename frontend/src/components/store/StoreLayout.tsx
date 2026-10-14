import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBagIcon, TicketIcon } from "@heroicons/react/24/outline";
import { Tabs } from "../ui/Tabs";

// The store layout: a tab bar that switches between Tickets (which nests its own
// Season Pass / Game Pass / Gameday Tickets picker) and the Showtime Store. The
// active tab comes from the URL, so each tab is a real route and the browser back
// button works as expected.
export const StoreLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = pathname.startsWith("/tickets") ? "tickets" : "store";

  return (
    <div className="space-y-6 md:space-y-8">
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
      <Outlet />
    </div>
  );
};
