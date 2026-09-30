import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  MoonIcon,
  ShoppingCartIcon,
  SunIcon,
  Squares2X2Icon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useTheme } from "../../contexts/ThemeContext";

type Menu = "league" | "stats" | "store" | "user";

const PORTAL_LINKS: Record<string, { to: string; label: string }> = {
  admin: { to: "/admin", label: "Admin" },
  app_admin: { to: "/admin", label: "App Admin" },
  referee: { to: "/admin/matches", label: "Referee Portal" },
  stats: { to: "/admin/matches", label: "Stats Portal" },
  team_head: { to: "/team-head", label: "My Team" },
  player: { to: "/player-portal", label: "Player Portal" },
  ticketer: { to: "/admin/tickets", label: "Ticketing Portal" },
  seller: { to: "/seller", label: "Store Portal" },
};

const menuItemClass =
  "flex items-center gap-3 px-3 py-2 min-h-11 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors";

interface NavbarProps {
  onMoreClick?: () => void;
}

export const Navbar = ({ onMoreClick }: NavbarProps) => {
  // One dropdown open at a time. Hover opens it with a mouse; a click or
  // Enter toggles it, so it also works on touch screens and keyboards.
  const [openMenu, setOpenMenu] = useState<Menu | null>(null);
  const { isAuthenticated, user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const portalLink = user?.role ? PORTAL_LINKS[user.role] : undefined;
  const initial = (user?.name?.trim()[0] ?? "?").toUpperCase();
  const navigate = useNavigate();
  const location = useLocation();
  const closeTimeoutRef = useRef<number | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  const openOnHover = (menu: Menu) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setOpenMenu(menu);
  };

  const closeOnLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => setOpenMenu(null), 200);
  };

  const toggleMenu = (menu: Menu) =>
    setOpenMenu((current) => (current === menu ? null : menu));

  // Close on navigation, Escape, or a tap anywhere outside the menus.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpenMenu(null));
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    const onPointer = (e: PointerEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openMenu]);

  const handleLogout = () => {
    setOpenMenu(null);
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-sffl-navy sticky top-0 z-50 shadow-lg border-b-4 border-sffl-red">
      <div className="max-w-shell mx-auto px-4 py-2.5 md:py-3">
        <div
          ref={menusRef}
          className="relative flex items-center justify-between text-white"
        >
          {/* Logo - Left */}
          <Link
            to="/"
            className="flex items-center shrink-0"
            aria-label="Showtime Home"
          >
            <img
              src="/images/branding/showtime-logo.png"
              alt="Showtime Flag Football"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-all duration-300 hover:scale-110"
            />
          </Link>

          {/* Main Navigation - Center. Wider spacing now that the
                        About Us dropdown is gone — the remaining items get
                        room to breathe. */}
          <div className="hidden lg:flex items-center gap-9 xl:gap-12 uppercase font-bold text-xs xl:text-sm tracking-wide">
            <Link
              to="/"
              className="min-h-11 inline-flex items-center hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105"
            >
              Home
            </Link>
            {/* League Dropdown — groups Matches, Standings, Teams */}
            <div
              className="relative group"
              onMouseEnter={() => openOnHover("league")}
              onMouseLeave={closeOnLeave}
            >
              <button
                type="button"
                onClick={() => toggleMenu("league")}
                aria-expanded={openMenu === "league"}
                aria-haspopup="true"
                className="min-h-11 hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase"
              >
                League
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "league" && (
                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/matches"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Matches
                    </Link>
                    <Link
                      to="/standings"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Standings
                    </Link>
                    <Link
                      to="/teams"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Teams
                    </Link>
                  </div>
                </div>
              )}
            </div>
            {/* Stats Dropdown */}
            <div
              className="relative group"
              onMouseEnter={() => openOnHover("stats")}
              onMouseLeave={closeOnLeave}
            >
              <button
                type="button"
                onClick={() => toggleMenu("stats")}
                aria-expanded={openMenu === "stats"}
                aria-haspopup="true"
                className="min-h-11 hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase"
              >
                Stats
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "stats" && (
                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/stats"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Stats Hub
                    </Link>
                    <Link
                      to="/stats?tab=players"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Player Stats
                    </Link>
                    <Link
                      to="/stats?tab=teams"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Team Stats
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/totw"
              className="min-h-11 inline-flex items-center hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105"
            >
              Team of the Week
            </Link>
            <Link
              to="/news"
              className="min-h-11 inline-flex items-center hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105"
            >
              News
            </Link>
            <Link
              to="/fantasy"
              className="min-h-11 inline-flex items-center hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 uppercase text-yellow-400"
            >
              Fantasy
            </Link>

            {/* Store Dropdown */}
            <div
              className="relative group"
              onMouseEnter={() => openOnHover("store")}
              onMouseLeave={closeOnLeave}
            >
              <button
                type="button"
                onClick={() => toggleMenu("store")}
                aria-expanded={openMenu === "store"}
                aria-haspopup="true"
                className="min-h-11 hover:text-sffl-red font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1 uppercase"
              >
                STORE
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "store" && (
                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/tickets"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Gameday Tickets
                    </Link>
                    <Link
                      to="/store"
                      className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                    >
                      Merch Store
                    </Link>
                    {isAuthenticated && (
                      <Link
                        to="/store/orders"
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors font-bold"
                      >
                        My Orders
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions - Right: cart icon and the account dropdown. */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Cart icon with item-count badge */}
            <Link
              to="/store/cart"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative min-h-11 min-w-11 flex items-center justify-center text-white hover:text-sffl-red transition-colors"
            >
              <ShoppingCartIcon className="w-6 h-6" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0 bg-sffl-red text-white text-[10px] font-black rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className="min-h-11 min-w-11 flex items-center justify-center cursor-pointer text-white hover:text-sffl-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg"
            >
              {isDarkMode ? (
                <SunIcon className="w-6 h-6" aria-hidden="true" />
              ) : (
                <MoonIcon className="w-6 h-6" aria-hidden="true" />
              )}
            </button>

            {/* Account: sign-in buttons for guests, profile dropdown once signed in */}
            {isAuthenticated ? (
              <div className="relative ml-1">
                <button
                  type="button"
                  onClick={() => toggleMenu("user")}
                  aria-expanded={openMenu === "user"}
                  aria-haspopup="true"
                  aria-label="Account menu"
                  className="min-h-11 flex items-center gap-1 pl-1 pr-1.5 cursor-pointer rounded-full text-white hover:text-sffl-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <span
                    className="w-9 h-9 rounded-full bg-sffl-red text-white font-black text-sm flex items-center justify-center ring-2 ring-white/30 shadow-md"
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <ChevronDownIcon
                    className={`w-3 h-3 transition-transform ${openMenu === "user" ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {openMenu === "user" && (
                  <div className="absolute top-full right-0 w-64 z-50 pt-2">
                    <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-2xl shadow-2xl overflow-hidden normal-case text-sm border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 px-4 py-4 bg-linear-to-br from-sffl-navy to-[#1c2f5a] text-white border-b-4 border-sffl-red">
                        <span
                          className="w-11 h-11 shrink-0 rounded-full bg-sffl-red font-black text-lg flex items-center justify-center ring-2 ring-white/30"
                          aria-hidden="true"
                        >
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-extrabold leading-tight">
                            {user?.name}
                          </p>
                          <span className="mt-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            {portalLink?.label ?? "Fan"}
                          </span>
                        </div>
                      </div>

                      <div className="p-2">
                        {portalLink && (
                          <Link to={portalLink.to} className={menuItemClass}>
                            <Squares2X2Icon
                              className="w-5 h-5 text-sffl-red"
                              aria-hidden="true"
                            />
                            {portalLink.label}
                          </Link>
                        )}
                        <Link to="/store/orders" className={menuItemClass}>
                          <ShoppingBagIcon
                            className="w-5 h-5 text-sffl-red"
                            aria-hidden="true"
                          />
                          My Orders
                        </Link>
                      </div>

                      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2 min-h-11 rounded-xl cursor-pointer font-bold text-sffl-red hover:bg-sffl-red/10 transition-colors"
                        >
                          <ArrowRightOnRectangleIcon
                            className="w-5 h-5"
                            aria-hidden="true"
                          />
                          Log out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link
                  to="/login?role=fan"
                  className="min-h-11 inline-flex items-center px-4 rounded-full border border-white/40 text-white text-xs font-bold uppercase tracking-wide hover:bg-white hover:text-sffl-navy transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="min-h-11 inline-flex items-center px-4 rounded-full bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold uppercase tracking-wide transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Center Greeting */}
          {isAuthenticated && user?.name && (
            <div className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none max-w-[45%] sm:max-w-[55%] text-center">
              <span className="text-white/90 text-xs sm:text-sm font-bold truncate">
                Hi{" "}
                <span className="font-extrabold text-white">
                  {user.name.split(" ")[0]}
                </span>
              </span>
            </div>
          )}

          {/* Mobile Right Controls: Cart & Menu Button */}
          <div className="flex lg:hidden items-center gap-1 sm:gap-1.5">
            {/* Mobile Cart Icon */}
            <Link
              to="/store/cart"
              aria-label={`Cart, ${cartCount} items`}
              className="relative min-h-11 min-w-11 flex items-center justify-center text-white hover:text-sffl-red transition-colors"
            >
              <ShoppingCartIcon className="w-6 h-6" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-sffl-red text-white text-[9px] font-black rounded-full min-w-4 h-4 flex items-center justify-center px-1 shadow-md">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className="min-h-11 min-w-11 flex items-center justify-center cursor-pointer text-white hover:text-sffl-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg"
            >
              {isDarkMode ? (
                <SunIcon className="w-6 h-6" aria-hidden="true" />
              ) : (
                <MoonIcon className="w-6 h-6" aria-hidden="true" />
              )}
            </button>

            {/* Mobile Menu Button - More icon */}
            <button
              type="button"
              onClick={onMoreClick}
              className="min-h-11 min-w-11 flex items-center justify-center text-white hover:text-sffl-red transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Bars3Icon className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
