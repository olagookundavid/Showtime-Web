import {
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  CalendarDaysIcon as CalendarDaysSolid,
  HomeIcon as HomeSolid,
  ShieldCheckIcon as ShieldCheckSolid,
  TableCellsIcon as TableCellsSolid,
} from '@heroicons/react/24/solid';
import type { DashboardBottomNavItem, DashboardNavSection } from '../components';
import type { User } from '../contexts';
import { accessFor } from '../config/featureAccess';
import type { ArenaMe } from '../types';

/** The sidebar: the competition for everyone, then what each person's account unlocks. */
export const arenaSectionsFor = (user: User | null, me: ArenaMe | undefined): DashboardNavSection[] => {
  const sections: DashboardNavSection[] = [
    {
      title: 'Competition',
      links: [
        { name: 'Overview', path: '/', icon: HomeIcon, end: true, description: 'The season at a glance.' },
        { name: 'Matches', path: '/matches', icon: CalendarDaysIcon, description: 'Every fixture and result.' },
        { name: 'Standings', path: '/standings', icon: TableCellsIcon, description: 'The league table.' },
        { name: 'Player Stats', path: '/players', icon: ChartBarIcon, description: 'Goals, assists and ratings.' },
        { name: 'Clubs', path: '/clubs', icon: ShieldCheckIcon, description: 'Every club and its squad.' },
        { name: 'Tournament', path: '/tournament', icon: TrophyIcon, description: 'Format, divisions and the playoffs.' },
      ],
    },
  ];
  if (!user) return sections;

  const mine: DashboardNavSection = {
    title: 'My Arena',
    links: [
      { name: 'My Profile', path: '/me', icon: UserCircleIcon, end: true, description: 'Your player profile and followed club.' },
      { name: 'My Contracts', path: '/me/contracts', icon: DocumentTextIcon, description: 'Offers from clubs, to sign or turn down.' },
    ],
  };
  sections.push(mine);

  if (me?.managed_club) {
    sections.push({
      title: me.managed_club.name,
      links: [
        { name: 'My Club', path: '/manage', icon: Squares2X2Icon, end: true, description: 'Your squad and what needs doing.' },
        { name: 'Transfers', path: '/manage/transfers', icon: ArrowsRightLeftIcon, description: 'Offer contracts and answer release requests.' },
        { name: 'Team Sheets', path: '/manage/teamsheets', icon: ClipboardDocumentListIcon, description: 'Pick your XI for each match.' },
      ],
    });
  }

  const can = (f: Parameters<typeof accessFor>[1]) => accessFor(user, f) !== 'none';
  const organiser: DashboardNavSection = { title: 'Organiser', links: [] };
  if (can('arena_seasons') || can('arena_clubs') || can('arena_results') || can('arena_transfers')) {
    organiser.links.push({ name: 'Dashboard', path: '/admin', icon: Cog6ToothIcon, end: true, description: 'What needs doing this season.' });
  }
  if (can('arena_seasons')) organiser.links.push({ name: 'Seasons', path: '/admin/seasons', icon: TrophyIcon, description: 'Seasons, divisions, fixtures and playoffs.' });
  if (can('arena_clubs')) {
    organiser.links.push({ name: 'Clubs', path: '/admin/clubs', icon: ShieldCheckIcon, description: 'Register clubs and assign managers.' });
    organiser.links.push({ name: 'Players', path: '/admin/players', icon: UserGroupIcon, description: 'Players and their registrations.' });
  }
  if (can('arena_results')) organiser.links.push({ name: 'Results', path: '/admin/results', icon: ClipboardDocumentListIcon, description: 'Enter scores and player stats.' });
  if (can('arena_transfers')) organiser.links.push({ name: 'Transfers', path: '/admin/transfers', icon: ArrowsRightLeftIcon, description: 'Every contract and the transfer window.' });
  if (organiser.links.length) sections.push(organiser);

  return sections;
};

export const arenaBottomNav: DashboardBottomNavItem[] = [
  { name: 'Overview', path: '/', end: true, icon: HomeIcon, solidIcon: HomeSolid },
  { name: 'Matches', path: '/matches', icon: CalendarDaysIcon, solidIcon: CalendarDaysSolid },
  { name: 'Table', path: '/standings', icon: TableCellsIcon, solidIcon: TableCellsSolid },
  { name: 'Clubs', path: '/clubs', icon: ShieldCheckIcon, solidIcon: ShieldCheckSolid },
];
