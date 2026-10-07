import { NotificationBell, DashboardShell, PLAYER_PORTAL_BOTTOM_NAV, PLAYER_PORTAL_HOME, PLAYER_PORTAL_NAV_SECTIONS } from '../../components';

export const PlayerPortalLayout = () => (
    <DashboardShell
        sections={PLAYER_PORTAL_NAV_SECTIONS}
        homePath={PLAYER_PORTAL_HOME}
        brandLabel="Player Portal"
        navLabel="Player portal"
        drawerLabel="Player portal menu"
        bottomNavLabel="Player portal shortcuts"
        moreLabel="More player portal pages"
        collapsedStorageKey="sffl_player_portal_sidebar_collapsed"
        bottomNavItems={PLAYER_PORTAL_BOTTOM_NAV}
        logoutDescription="You will need to sign in again to use the player portal."
        topBarActions={<NotificationBell />}
    />
);

export default PlayerPortalLayout;
