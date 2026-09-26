import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useId, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { AdminBottomNav } from "../../components/admin/AdminBottomNav";
import { AdminBrand } from "../../components/admin/AdminBrand";
import { AdminClock } from "../../components/admin/AdminClock";
import { AdminNavLinks } from "../../components/admin/AdminNavLinks";
import { AdminUserMenu } from "../../components/admin/AdminUserMenu";
import { adminSectionsFor } from "../../components/admin/adminNav";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronLeftIcon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const COLLAPSED_KEY = "sffl_admin_sidebar_collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

const iconButtonClass =
  "inline-flex items-center justify-center shrink-0 min-h-11 min-w-11 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sffl-red/40";

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  // Phone drawer. On desktop the sidebar is always there and only collapses.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const drawerId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen]);

  // While the drawer is open: focus its close button and let Escape close it.
  // When it closes, focus goes back to whatever opened it.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const opener = openerRef.current;
    closeButtonRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [isSidebarOpen]);

  const openDrawer = () => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setIsSidebarOpen(true);
  };
  const closeDrawer = () => setIsSidebarOpen(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: the sidebar just won't remember the choice.
    }
  };

  const handleLogout = () => {
    setConfirmLogout(false);
    logout();
    navigate("/");
  };

  const sections = adminSectionsFor(user?.role);
  const homePath = sections[0]?.links[0]?.path ?? "/admin";

  // Redirect users away from Dashboard if they lack permission
  useEffect(() => {
    if (!user) return;
    const isDashboard =
      location.pathname === "/admin" || location.pathname === "/admin/";

    if (isDashboard) {
      if (user.role === "ticketer") {
        navigate("/admin/tickets");
      } else if (user.role === "referee" || user.role === "stats") {
        navigate("/admin/matches");
      }
    }
  }, [user, location.pathname, navigate]);

  return (
    <div
      data-admin-shell
      className="h-dvh flex overflow-hidden bg-transparent w-full"
    >
      {/* Global Background - Atmospheric version */}
      <div className="fixed inset-0 -z-50 bg-slate-200 dark:bg-black">
        <div
          className="absolute inset-0 bg-[url('/images/branding/home-bg.jpeg')] bg-cover bg-center opacity-40 dark:opacity-20 transition-opacity duration-700"
          style={{ backgroundAttachment: "fixed" }}
        />

        {/* Dynamic Tints */}
        <div className="absolute inset-0 bg-linear-to-br from-sffl-red/10 via-white/50 dark:via-transparent to-sffl-navy/20 dark:from-sffl-red/5 dark:to-sffl-navy/60" />

        {/* Vignette for depth */}
        <div className="absolute inset-0 [background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] dark:[background:radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Sidebar (desktop). Only the link list scrolls; the brand block stays put.
          On phones the drawer below is the menu. */}
      <aside
        className={`hidden lg:flex relative z-20 shrink-0 flex-col h-full bg-white dark:bg-sffl-navy border-r border-gray-200 dark:border-white/10 shadow-sm transition-[width,background-color,border-color] duration-300 motion-reduce:transition-none ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div
          className={`h-18 shrink-0 flex items-center overflow-hidden border-b-2 border-sffl-red ${
            collapsed ? "justify-center px-2" : "px-5"
          }`}
        >
          <AdminBrand to={homePath} collapsed={collapsed} />
        </div>

        <AdminNavLinks sections={sections} collapsed={collapsed} />

        {/* Straddles the sidebar's right edge, just below the brand block. The
            before: layer stretches the hit area to 44px around the 28px circle. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="absolute top-22 -right-3.5 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 shadow hover:text-sffl-red dark:bg-sffl-navy dark:border-white/20 dark:text-gray-200 dark:hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sffl-red/60 before:absolute before:-inset-2"
        >
          <ChevronLeftIcon
            className={`w-4 h-4 transition-transform duration-300 motion-reduce:transition-none ${
              collapsed ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="relative z-30 shrink-0 h-16 lg:h-18 flex items-center gap-1 px-2 sm:px-4 lg:px-6 bg-white dark:bg-sffl-navy border-b-2 border-sffl-red shadow-sm transition-colors">
          <div className="lg:hidden flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Open menu"
              aria-expanded={isSidebarOpen}
              aria-controls={drawerId}
              className={iconButtonClass}
            >
              <Bars3Icon className="w-6 h-6" aria-hidden="true" />
            </button>
            <AdminBrand to={homePath} compact />
          </div>

          <div className="flex-1" />

          <AdminClock className="hidden md:flex" />
          <div
            aria-hidden="true"
            className="hidden md:block h-8 w-px mx-2 lg:mx-3 bg-gray-200 dark:bg-white/15"
          />
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className={iconButtonClass}
          >
            {isDarkMode ? (
              <SunIcon className="w-5 h-5" aria-hidden="true" />
            ) : (
              <MoonIcon className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <AdminUserMenu onLogout={() => setConfirmLogout(true)} />
        </header>

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 w-full p-4 lg:p-8 overflow-y-auto overscroll-y-none bg-transparent pb-[calc(9rem+2*env(safe-area-inset-bottom,0px))] lg:pb-8 relative z-10">
          <Outlet />
        </main>
      </div>

      {/* Admin Bottom Nav */}
      <AdminBottomNav onMoreClick={openDrawer} />

      {/* Phone drawer overlay */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={`fixed inset-0 z-60 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 invisible pointer-events-none"
        }`}
      />

      {/* Phone drawer. It is a dialog only while open: index.css hides the
          bottom nav whenever any [role="dialog"] is on the page, and this
          element stays mounted (off-screen) so it can slide. Closed, it is
          inert, so its off-screen links can't be tabbed to. */}
      <div
        id={drawerId}
        role={isSidebarOpen ? "dialog" : undefined}
        aria-modal={isSidebarOpen || undefined}
        aria-label={isSidebarOpen ? "Admin menu" : undefined}
        inert={!isSidebarOpen}
        className={`fixed inset-y-0 left-0 z-60 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-sffl-navy shadow-2xl lg:hidden transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 shrink-0 flex items-center justify-between gap-2 pl-4 pr-2 border-b-2 border-sffl-red">
          <AdminBrand to={homePath} onClick={closeDrawer} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className={iconButtonClass}
          >
            <XMarkIcon className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
        <AdminNavLinks sections={sections} onNavigate={closeDrawer} />
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        description="You will need to sign in again to use the admin panel."
        confirmLabel="Log out"
        tone="info"
        icon={ArrowRightOnRectangleIcon}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};
