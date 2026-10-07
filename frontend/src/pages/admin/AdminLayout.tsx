import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../contexts";
import { DashboardShell, adminBottomNavFor, adminSectionsFor, adminBrandLabelFor } from "../../components";

export const AdminLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      } else if (user.role === "broadcast") {
        navigate("/admin/broadcast");
      }
    }
  }, [user, location.pathname, navigate]);

  return (
    <DashboardShell
      sections={sections}
      homePath={homePath}
      brandLabel={adminBrandLabelFor(user?.role)}
      navLabel="Admin"
      drawerLabel="Admin menu"
      bottomNavLabel="Admin shortcuts"
      moreLabel="More admin pages"
      collapsedStorageKey="sffl_admin_sidebar_collapsed"
      bottomNavItems={adminBottomNavFor(user?.role)}
      logoutDescription="You will need to sign in again to use the admin panel."
    />
  );
};
