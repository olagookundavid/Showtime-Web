import { useMemo, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Button, ButtonLink, DashboardPageHeader, DataTable, Loader, Spinner, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaMatch, ArenaPlayer } from '../../../types';
import { Crest, EmptyState, MatchRow, Panel, PlayerFace, StatTile } from '../../components';
import { useArenaMe } from '../../hooks';
import { PLATFORMS, errorMessage, formatKickoffTime, formatMatchDate, squadRoleLabel } from '../../utils';
import { NO_CONTRACTS, isOpenContract, manageKeys, useTransferWindow } from './ContractShared';

const NO_PLAYERS: ArenaPlayer[] = [];
const NO_MATCHES: ArenaMatch[] = [];

/** A team sheet needs 11 starters, so a smaller squad can't field a side. */
const MIN_SQUAD = 11;

interface Todo {
  key: string;
  icon: ComponentType<{ className?: string }>;
  text: string;
  to: string;
  label: string;
}

const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

export const ArenaManageClub = () => {
  const me = useArenaMe();
  const clubQ = useQuery({ queryKey: manageKeys.club(), queryFn: () => arenaApi.manageClub() });
  const fixturesQ = useQuery({ queryKey: manageKeys.fixtures(), queryFn: () => arenaApi.manageFixtures() });
  const contractsQ = useQuery({ queryKey: manageKeys.contracts, queryFn: () => arenaApi.manageContracts() });
  const tw = useTransferWindow();

  const club = clubQ.data?.club ?? me.data?.managed_club ?? null;
  const roster = clubQ.data?.roster ?? NO_PLAYERS;
  const fixtures = fixturesQ.data ?? NO_MATCHES;
  const nextMatch = fixtures[0] ?? null;
  const myId = club?.id ?? '';

  // Whether the next match has a submitted sheet. This shares its cache entry with the Team Sheets page.
  const nextReady = !!nextMatch && !!nextMatch.home_club_id && !!nextMatch.away_club_id;
  const sheetQ = useQuery({
    queryKey: manageKeys.sheet(nextMatch?.id ?? '', undefined),
    queryFn: () => arenaApi.sheet(nextMatch!.id),
    enabled: nextReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const openOffers = useMemo(
    () => (contractsQ.data ?? NO_CONTRACTS).filter((c) => c.club_id === myId && isOpenContract(c)).length,
    [contractsQ.data, myId],
  );

  const columns = useMemo<Column<ArenaPlayer>[]>(
    () => [
      {
        header: 'Player',
        accessor: 'gamertag',
        sortable: true,
        cell: (p) => (
          <span className="flex min-w-0 items-center gap-3">
            <PlayerFace name={p.gamertag} src={p.avatar_url} size="sm" />
            <Link to={`/players/${p.id}`} className="truncate font-bold text-sffl-navy hover:underline dark:text-white">
              {p.gamertag}
            </Link>
          </span>
        ),
      },
      { header: 'Shirt', accessor: 'shirt_number', sortable: true, cell: (p) => (p.shirt_number ?? '—') },
      { header: 'Position', accessor: 'primary_position', sortable: true },
      { header: 'Platform', accessor: 'platform', sortable: true, cell: (p) => platformLabel(p.platform) },
      { header: 'Squad role', accessor: 'squad_role', sortable: true, cell: (p) => squadRoleLabel(p.squad_role) || '—' },
    ],
    [],
  );

  if (clubQ.isLoading || me.isLoading) return <Loader />;

  if (clubQ.isError || !club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="My Club" subtitle="Your squad, your next match and what needs doing." />
        <Panel title="We couldn't load your club">
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Something went wrong"
            description={errorMessage(clubQ.error, 'Your club could not be loaded. Please try again.')}
            action={<Button onClick={() => clubQ.refetch()}>Try again</Button>}
          />
        </Panel>
      </div>
    );
  }

  const pendingReleases = me.data?.pending_releases ?? 0;
  const sheetSubmitted = sheetQ.data?.sheet.status === 'submitted';
  const sheetKnown = sheetQ.isSuccess;
  const opponent = nextMatch ? (nextMatch.home_club_id === club.id ? nextMatch.away : nextMatch.home) : null;

  const todos: Todo[] = [];
  if (roster.length < MIN_SQUAD) {
    todos.push({
      key: 'squad',
      icon: UserGroupIcon,
      text: `Your squad has ${roster.length} ${roster.length === 1 ? 'player' : 'players'}. You need at least ${MIN_SQUAD} to field a team.`,
      to: '/manage/transfers?tab=free',
      label: 'Sign players',
    });
  }
  if (pendingReleases > 0) {
    todos.push({
      key: 'releases',
      icon: DocumentTextIcon,
      text: `${pendingReleases} ${pendingReleases === 1 ? 'club wants' : 'clubs want'} to sign one of your players and ${pendingReleases === 1 ? 'is' : 'are'} waiting for your answer.`,
      to: '/manage/transfers?tab=requests',
      label: 'Answer requests',
    });
  }
  if (nextMatch && nextReady && sheetKnown && !sheetSubmitted) {
    todos.push({
      key: 'sheet',
      icon: ClipboardDocumentListIcon,
      text: `Your team sheet for ${opponent?.name ?? 'your next match'} on ${formatMatchDate(nextMatch.kickoff_at)} hasn't been submitted.`,
      to: `/manage/teamsheets?match=${nextMatch.id}`,
      label: 'Pick your XI',
    });
  }

  const todosLoading = fixturesQ.isLoading || (nextReady && sheetQ.isLoading);

  return (
    <div className="space-y-6 pb-mobile-nav-2x">
      <DashboardPageHeader
        title="My Club"
        subtitle="Your squad, your next match and what needs doing."
        actions={
          <ButtonLink to="/manage/teamsheets" icon={ClipboardDocumentListIcon}>
            Pick team sheet
          </ButtonLink>
        }
      />

      <section className="flex min-w-0 items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:p-5">
        <Crest club={club} size="xl" />
        <div className="min-w-0">
          <h2 className="wrap-break-word text-2xl font-black text-sffl-navy dark:text-white">{club.name}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{club.division_name || 'Not in a division yet'}</p>
          <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
            Manager: <span className="font-bold text-sffl-navy dark:text-white">{club.manager_name || 'You'}</span>
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Squad size" value={roster.length} note={roster.length < MIN_SQUAD ? `${MIN_SQUAD - roster.length} more needed` : 'players registered'} icon={UserGroupIcon} />
        <StatTile
          label="Next match"
          value={nextMatch ? formatMatchDate(nextMatch.kickoff_at) : 'None'}
          note={nextMatch ? `${opponent ? `vs ${opponent.short}` : 'Opponent to be decided'}, ${formatKickoffTime(nextMatch.kickoff_at)} WAT` : 'No fixtures scheduled'}
          icon={CalendarDaysIcon}
        />
        <StatTile label="Open offers" value={openOffers} note="offers you've made, still waiting" icon={ArrowsRightLeftIcon} />
        <StatTile
          label="Transfer window"
          value={tw.isLoading ? '—' : tw.closed ? 'Closed' : 'Open'}
          note={tw.closed ? 'No offers or signings for now' : 'Offers and signings allowed'}
          icon={tw.closed ? LockClosedIcon : LockOpenIcon}
        />
      </div>

      <Panel title="What needs doing">
        {todosLoading ? (
          <Spinner size="sm" className="py-3" label="Checking your club" />
        ) : todos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            You're all set. Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {todos.map((t) => (
              <li key={t.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="flex min-w-0 items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
                  <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-sffl-red dark:text-arena-lime" aria-hidden="true" />
                  <span className="min-w-0 wrap-break-word">{t.text}</span>
                </p>
                <ButtonLink to={t.to} variant="outline" size="sm" className="self-start sm:self-auto">
                  {t.label}
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Squad" flush={roster.length > 0}>
        {roster.length === 0 ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No players in your squad yet"
            description="Players join your squad when they sign a contract you've offered. Free agents are the quickest way to start."
            action={
              <ButtonLink to="/manage/transfers?tab=free" icon={ArrowsRightLeftIcon}>
                Find players to sign
              </ButtonLink>
            }
          />
        ) : (
          <DataTable
            data={roster}
            columns={columns}
            getRowId={(p) => p.id}
            searchable={false}
            paginated={false}
            emptyMessage="No players in your squad yet."
          />
        )}
      </Panel>

      <Panel title="Next fixtures" link={{ to: '/matches', label: 'All matches' }} flush={fixtures.length > 0}>
        {fixturesQ.isLoading ? (
          <Spinner size="sm" className="py-3" label="Loading fixtures" />
        ) : fixtures.length === 0 ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title="No upcoming matches"
            description="Your fixtures appear here once the organiser has scheduled them."
          />
        ) : (
          fixtures.slice(0, 5).map((m) => <MatchRow key={m.id} match={m} />)
        )}
      </Panel>
    </div>
  );
};
