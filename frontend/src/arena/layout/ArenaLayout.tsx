import { useMemo } from 'react';
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline';
import { ButtonLink, DashboardShell, Select } from '../../components';
import { useAuth } from '../../contexts';
import { arenaBottomNav, arenaSectionsFor } from './arenaNav';
import { useArenaMe } from '../hooks';
import { useArenaScope } from '../scope';

const BRAND = {
  logoSrc: '/logo.svg',
  name: (
    <>
      CLUBS<span className="text-sffl-red dark:text-arena-lime">ARENA</span>
    </>
  ),
};

/** Chooses which division the competition pages show. Hidden while there is only one. */
const DivisionPicker = () => {
  const { divisions, divisionId, setDivisionId } = useArenaScope();
  if (divisions.length < 2) return null;
  return (
    <Select
      aria-label="Division"
      value={divisionId}
      onChange={(e) => setDivisionId(e.target.value)}
      className="w-32 sm:w-52"
    >
      {divisions.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </Select>
  );
};

/** The frame around every Arena page: sidebar, top bar and phone navigation. */
export const ArenaLayout = () => {
  const { user, isAuthenticated } = useAuth();
  const me = useArenaMe();
  const sections = useMemo(() => arenaSectionsFor(user, me.data), [user, me.data]);
  const badges = useMemo(
    () => ({ '/me/contracts': me.data?.open_offers ?? 0, '/manage/transfers': me.data?.pending_releases ?? 0 }),
    [me.data],
  );

  return (
    <DashboardShell
      sections={sections}
      homePath="/"
      brandLabel="Pro Clubs, connected"
      navLabel="Clubs Arena"
      drawerLabel="Clubs Arena menu"
      bottomNavLabel="Clubs Arena shortcuts"
      moreLabel="More pages"
      collapsedStorageKey="arena_sidebar_collapsed"
      bottomNavItems={arenaBottomNav}
      badges={badges}
      logoutDescription="You will need to log in again to manage your club or contracts."
      brand={BRAND}
      plainBackground
      topBarActions={
        <>
          <DivisionPicker />
          {!isAuthenticated && (
            <ButtonLink to="/login" size="sm" variant="navy" icon={ArrowRightEndOnRectangleIcon} className="ml-2">
              Log in
            </ButtonLink>
          )}
        </>
      }
    />
  );
};
