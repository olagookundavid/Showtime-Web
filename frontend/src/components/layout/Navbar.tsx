import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  MoonIcon,
  SunIcon,
  Squares2X2Icon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useTheme } from "../../contexts/ThemeContext";
import { NotificationBell } from "./NotificationBell";
import { getInitials } from "../../utils/formatters";
import { IconButton } from "../ui";

type Menu = "league" | "stats" | "awards" | "user";

const PORTAL_LINKS: Record<string, { to: string; label: string }> = {
  admin: { to: "/admin", label: "Admin" },
  app_admin: { to: "/admin", label: "App Admin" },
  referee: { to: "/admin/matches", label: "Referee Portal" },
  stats: { to: "/admin/matches", label: "Stats Portal" },
  team_head: { to: "/team-head", label: "My Team" },
  player: { to: "/player-portal", label: "Player Portal" },
  ticketer: { to: "/admin/tickets", label: "Ticketing Portal" },
  seller: { to: "/seller", label: "Store Portal" },
  commissioner: { to: "/admin", label: "Commissioner Portal" },
  fantasy_commissioner: { to: "/admin/fantasy", label: "Fantasy Portal" },
  head_referee: { to: "/admin/matches", label: "Head Referee Portal" },
  news_head: { to: "/admin/news", label: "News Portal" },
  content_creator: { to: "/admin/news", label: "Content Portal" },
  store_manager: { to: "/admin/store", label: "Store Portal" },
  // `user` has no business-side portal — their only landing page is their own profile.
  user: { to: "/account", label: "My Account" },
};

const menuItemClass =
  "flex items-center gap-3 px-3 py-2 min-h-11 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red transition-colors";

const navItemBase =
  "relative min-h-11 inline-flex items-center font-bold transition-colors duration-300 " +
  "after:absolute after:left-0 after:bottom-1 after:h-0.75 after:w-full after:rounded-full " +
  "after:bg-sffl-red after:origin-left after:scale-x-0 after:transition-transform " +
  "after:duration-300 after:ease-out motion-reduce:after:transition-none " +
  "hover:after:scale-x-100 focus-visible:after:scale-x-100 " +
  "outline-none focus-visible:text-sffl-red";

// Active keeps its own colour and holds the bar; idle turns red on hover.
const navItem = (active: boolean, color = "text-white") =>
  `${navItemBase} ${color} ${active ? "after:scale-x-100" : "hover:text-sffl-red"}`;

// Dropdown rows: the hover style, held permanently for the current page.
const dropdownItem = (active: boolean) =>
  `block px-4 py-2 font-bold transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sffl-red ${
    active ? "bg-gray-100 dark:bg-gray-700 text-sffl-red" : ""
  }`;
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
  const initials = getInitials(user?.name);
  const navigate = useNavigate();
  const location = useLocation();
  const closeTimeoutRef = useRef<number | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  const { pathname, search } = location;
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  const tab = new URLSearchParams(search).get("tab");

  const leagueActive = ["/matches", "/standings", "/teams"].some(isActive);
  const statsActive = isActive("/stats");
  const awardsActive = ["/totw", "/potw"].some(isActive);
  const storeActive = ["/tickets", "/store"].some(isActive);

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
              aria-current={pathname === "/" ? "page" : undefined}
              className={navItem(pathname === "/")}
            >
              Home
            </Link>

            {/* League */}
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
                className={`${navItem(leagueActive)} gap-1 uppercase aria-expanded:after:scale-x-100`}
              >
                League
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "league" && (
                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/matches"
                      aria-current={isActive("/matches") ? "page" : undefined}
                      className={dropdownItem(isActive("/matches"))}
                    >
                      Matches
                    </Link>
                    <Link
                      to="/standings"
                      aria-current={isActive("/standings") ? "page" : undefined}
                      className={dropdownItem(isActive("/standings"))}
                    >
                      Standings
                    </Link>
                    <Link
                      to="/teams"
                      aria-current={isActive("/teams") ? "page" : undefined}
                      className={dropdownItem(isActive("/teams"))}
                    >
                      Teams
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
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
                className={`${navItem(statsActive)} gap-1 uppercase aria-expanded:after:scale-x-100`}
              >
                Stats
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "stats" && (
                <div className="absolute top-full left-0 w-48 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/stats"
                      aria-current={statsActive && !tab ? "page" : undefined}
                      className={dropdownItem(statsActive && !tab)}
                    >
                      Stats Hub
                    </Link>
                    <Link
                      to="/stats?tab=players"
                      aria-current={
                        statsActive && tab === "players" ? "page" : undefined
                      }
                      className={dropdownItem(statsActive && tab === "players")}
                    >
                      Player Stats
                    </Link>
                    <Link
                      to="/stats?tab=teams"
                      aria-current={
                        statsActive && tab === "teams" ? "page" : undefined
                      }
                      className={dropdownItem(statsActive && tab === "teams")}
                    >
                      Team Stats
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Awards */}
            <div
              className="relative group"
              onMouseEnter={() => openOnHover("awards")}
              onMouseLeave={closeOnLeave}
            >
              <button
                type="button"
                onClick={() => toggleMenu("awards")}
                aria-expanded={openMenu === "awards"}
                aria-haspopup="true"
                className={`${navItem(awardsActive)} gap-1 uppercase aria-expanded:after:scale-x-100`}
              >
                Awards
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              </button>

              {openMenu === "awards" && (
                <div className="absolute top-full left-0 w-52 z-50 pt-2">
                  <div className="bg-white dark:bg-gray-800 text-sffl-navy dark:text-white rounded-lg shadow-2xl py-2 normal-case font-bold text-sm border border-gray-200 dark:border-gray-700">
                    <Link
                      to="/totw"
                      aria-current={isActive("/totw") ? "page" : undefined}
                      className={dropdownItem(isActive("/totw"))}
                    >
                      Team of the Week
                    </Link>
                    <Link
                      to="/potw"
                      aria-current={isActive("/potw") ? "page" : undefined}
                      className={dropdownItem(isActive("/potw"))}
                    >
                      Player of the Week
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/news"
              aria-current={isActive("/news") ? "page" : undefined}
              className={navItem(isActive("/news"))}
            >
              News
            </Link>
            <Link
              to="/fantasy"
              aria-current={isActive("/fantasy") ? "page" : undefined}
              className={navItem(isActive("/fantasy"), "text-yellow-400")}
            >
              Fantasy
            </Link>

            {/* Store: one link into the store layout, which holds the
                Gameday Tickets and Showtime Store tabs. */}
            <Link
              to="/store"
              aria-current={storeActive ? "page" : undefined}
              className={navItem(storeActive)}
            >
              Store
            </Link>
          </div>

          {/* Actions - Right: cart icon and the account dropdown. */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Cart icon with item-count badge */}
            <Link
              to="/store/cart"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative min-h-11 min-w-11 flex items-center justify-center text-white hover:text-sffl-red transition-colors"
            >
              <ShoppingBagIcon className="w-6 h-6" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0 bg-sffl-red text-white text-[10px] font-black rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <IconButton
              tone="dark"
              variant="ghost"
              icon={isDarkMode ? SunIcon : MoonIcon}
              label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleDarkMode}
            />

            {/* Notifications (e.g. a Player of the Week vote opening) for signed-in fans */}
            {isAuthenticated && <NotificationBell onDark />}

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
                    {initials}
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
                          {initials}
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
                        <Link to="/account" className={menuItemClass}>
                          <UserCircleIcon
                            className="w-5 h-5 text-sffl-red"
                            aria-hidden="true"
                          />
                          Edit Profile
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

          {/* Mobile Right Controls: Cart & Menu Button */}
          <div className="flex lg:hidden items-center gap-1 sm:gap-1.5">
            {isAuthenticated && <NotificationBell onDark />}

            {/* Mobile Cart Icon */}
            <Link
              to="/store/cart"
              aria-label={`Cart, ${cartCount} items`}
              className="relative min-h-11 min-w-11 flex items-center justify-center text-white hover:text-sffl-red transition-colors"
            >
              <ShoppingBagIcon className="w-6 h-6" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-sffl-red text-white text-[9px] font-black rounded-full min-w-4 h-4 flex items-center justify-center px-1 shadow-md">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <IconButton
              tone="dark"
              variant="ghost"
              icon={isDarkMode ? SunIcon : MoonIcon}
              label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleDarkMode}
            />

            {/* Mobile Menu Button - More icon */}
            <IconButton
              tone="dark"
              variant="ghost"
              icon={Bars3Icon}
              label="Open navigation menu"
              onClick={onMoreClick}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
