import { useAuth } from "../../contexts";
import { DashboardShell, adminBottomNavFor, adminSectionsFor, adminBrandLabelFor } from "../../components";

export const AdminLayout = () => {
  const { user } = useAuth();

  // Everything here follows the signed-in role's permissions. A role that can't
  // open the Dashboard lands on the first page it can (FeatureGuard handles the
  // redirect), so no role needs a case written for it.
  const sections = adminSectionsFor(user);
  const homePath = sections[0]?.links[0]?.path ?? "/admin";

  return (
    <DashboardShell
      sections={sections}
      homePath={homePath}
      brandLabel={adminBrandLabelFor(user)}
      navLabel="Admin"
      drawerLabel="Admin menu"
      bottomNavLabel="Admin shortcuts"
      moreLabel="More admin pages"
      collapsedStorageKey="sffl_admin_sidebar_collapsed"
      bottomNavItems={adminBottomNavFor(user)}
      logoutDescription="You will need to sign in again to use the admin panel."
    />
  );
};
