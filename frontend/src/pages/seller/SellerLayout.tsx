import { DashboardShell, SELLER_BOTTOM_NAV, SELLER_HOME, SELLER_NAV_SECTIONS } from '../../components';

export const SellerLayout = () => (
    <DashboardShell
        sections={SELLER_NAV_SECTIONS}
        homePath={SELLER_HOME}
        brandLabel="Seller Portal"
        navLabel="Seller portal"
        drawerLabel="Seller portal menu"
        bottomNavLabel="Seller portal shortcuts"
        moreLabel="More seller portal pages"
        collapsedStorageKey="sffl_seller_sidebar_collapsed"
        bottomNavItems={SELLER_BOTTOM_NAV}
        logoutDescription="You will need to sign in again to log sales."
    />
);
