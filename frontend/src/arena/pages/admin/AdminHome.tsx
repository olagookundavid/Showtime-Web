import { useMemo, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { Button, ButtonLink, DashboardPageHeader, Spinner } from '../../../components';
import { usePermissions } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaSeason } from '../../../types';
import { EmptyState, Panel, StatTile } from '../../components';
import { errorMessage } from '../../utils';
import { SEASON_STATUS, isPlayed, seasonKeys } from './seasonHelpers';

interface StepAction {
  to: string;
  label: string;
}

interface Step {
  title: string;
  description: string;
  done: boolean;
  actions: StepAction[];
}

const SHORT_STATUS = { setup: 'Setup', active: 'Live', playoffs: 'Playoffs', completed: 'Done' } as const;

const pickCurrent = (seasons: ArenaSeason[]): ArenaSeason | undefined => {
  const newest = [...seasons].sort((a, b) => b.number - a.number);
  return (
    newest.find((s) => s.status === 'active' || s.status === 'playoffs') ?? newest.find((s) => s.status === 'setup') ?? newest[0]
  );
};

const QUICK_LINKS: { to: string; label: string; description: string; icon: ComponentType<{ className?: string }>; feature: 'arena_seasons' | 'arena_clubs' | 'arena_results' | 'arena_transfers' }[] = [
  { to: '/admin/seasons', label: 'Seasons', description: 'Seasons, divisions, fixtures and playoffs.', icon: TrophyIcon, feature: 'arena_seasons' },
  { to: '/admin/clubs', label: 'Clubs', description: 'Register clubs and assign managers.', icon: ShieldCheckIcon, feature: 'arena_clubs' },
  { to: '/admin/players', label: 'Players', description: 'Players and their registrations.', icon: UserGroupIcon, feature: 'arena_clubs' },
  { to: '/admin/results', label: 'Results', description: 'Enter scores and player stats.', icon: ClipboardDocumentListIcon, feature: 'arena_results' },
  { to: '/admin/transfers', label: 'Transfers', description: 'Every contract and the transfer window.', icon: ArrowsRightLeftIcon, feature: 'arena_transfers' },
];

export const ArenaAdminHome = () => {
  const { canView } = usePermissions();
  const canSeasons = canView('arena_seasons');
  const canClubs = canView('arena_clubs');
  const canTransfers = canView('arena_transfers');

  const seasonsQuery = useQuery({ queryKey: seasonKeys.all, queryFn: arenaApi.adminSeasons, enabled: canSeasons });
  const current = useMemo(() => pickCurrent(seasonsQuery.data ?? []), [seasonsQuery.data]);

  const detailQuery = useQuery({
    queryKey: seasonKeys.one(current?.id ?? ''),
    queryFn: () => arenaApi.adminSeason(current!.id),
    enabled: Boolean(current),
  });
  const season = detailQuery.data;
  const divisions = useMemo(() => season?.divisions ?? [], [season]);

  const clubsQuery = useQuery({ queryKey: seasonKeys.clubs, queryFn: () => arenaApi.adminClubs(), enabled: canClubs });
  const offersQuery = useQuery({
    queryKey: ['arena', 'admin', 'contracts', 'open'],
    queryFn: () => arenaApi.adminContracts('open'),
    enabled: canTransfers,
  });

  const matchQueries = useQueries({
    queries: divisions.map((d) => ({ queryKey: seasonKeys.divisionMatches(d.id), queryFn: () => arenaApi.matches(d.id) })),
  });

  const placed = divisions.reduce((n, d) => n + d.club_count, 0);
  const registered = clubsQuery.data?.length;
  const leagueMatches = matchQueries.flatMap((q) => (q.data?.matches ?? []).filter((m) => m.stage === 'league'));
  const matchesLoaded = matchQueries.every((q) => q.isSuccess);
  const played = leagueMatches.filter(isPlayed).length;
  const readyDivisions = divisions.filter((d) => d.club_count >= 2);
  const fixturesMade =
    matchesLoaded &&
    readyDivisions.length > 0 &&
    readyDivisions.every((d) => {
      const i = divisions.indexOf(d);
      return (matchQueries[i]?.data?.matches ?? []).some((m) => m.stage === 'league');
    });

  const seasonPath = season ? `/admin/seasons/${season.id}` : '/admin/seasons';
  const steps: Step[] = season
    ? [
        {
          title: 'Create a season',
          description: `${season.name} exists.`,
          done: true,
          actions: [{ to: '/admin/seasons', label: 'All seasons' }],
        },
        {
          title: 'Add divisions',
          description: divisions.length ? `${divisions.length} ${divisions.length === 1 ? 'division' : 'divisions'} added.` : 'A division is a league of clubs. Add at least one.',
          done: divisions.length > 0,
          actions: [{ to: seasonPath, label: divisions.length ? 'Manage divisions' : 'Add a division' }],
        },
        {
          title: 'Register clubs and put them in divisions',
          description: `${registered !== undefined ? `${registered} registered, ` : ''}${placed} in divisions. You need at least 2 clubs in a division.`,
          done: placed >= 2,
          actions: [...(canClubs ? [{ to: '/admin/clubs', label: 'Register clubs' }] : []), { to: seasonPath, label: 'Choose division clubs' }],
        },
        {
          title: 'Make fixtures',
          description: fixturesMade ? 'Every division with clubs has its fixtures.' : 'Preview and create the league calendar for each division.',
          done: fixturesMade,
          actions: [{ to: seasonPath, label: 'Make fixtures' }],
        },
        {
          title: 'Start the season',
          description: season.status === 'setup' ? 'Go live so results can be entered.' : `The season is ${SEASON_STATUS[season.status].label.toLowerCase()}.`,
          done: season.status !== 'setup',
          actions: [{ to: seasonPath, label: 'Start season' }],
        },
        {
          title: 'Open the transfer window',
          description: season.transfer_window_open ? 'The window is open: managers can offer contracts.' : 'Let managers offer contracts and players sign them.',
          done: season.transfer_window_open,
          actions: [{ to: seasonPath, label: 'Open window' }],
        },
      ]
    : [];
  const doneCount = steps.filter((s) => s.done).length;
  const currentStep = steps.findIndex((s) => !s.done);
  const finished = season?.status === 'completed';

  const links = QUICK_LINKS.filter((l) => canView(l.feature));
  const loading = canSeasons && (seasonsQuery.isLoading || (Boolean(current) && detailQuery.isLoading));
  const loadError = seasonsQuery.error ?? detailQuery.error;

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title="Organiser Dashboard"
        subtitle={
          canSeasons
            ? 'Follow the checklist to get a season running, then jump to anything you look after.'
            : 'Jump to the parts of Clubs Arena you look after.'
        }
        actions={
          canSeasons &&
          (season ? (
            <ButtonLink shape="square" to={seasonPath} variant="outline" icon={CalendarDaysIcon}>
              Open {season.name}
            </ButtonLink>
          ) : null)
        }
      />

      {loading ? (
        <Spinner label="Loading your season" />
      ) : loadError ? (
        <Panel title="Season">
          <EmptyState
            icon={TrophyIcon}
            title="Your season could not be loaded"
            description={errorMessage(loadError)}
            action={
              <Button shape="square"
                variant="outline"
                onClick={() => {
                  void seasonsQuery.refetch();
                  void detailQuery.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        </Panel>
      ) : canSeasons && !season ? (
        <Panel title="Get started">
          <EmptyState
            icon={TrophyIcon}
            title="No season yet"
            description="A season holds your divisions, clubs and fixtures. Create the first one and this page will walk you through the rest."
            action={
              <ButtonLink shape="square" to="/admin/seasons" icon={PlusIcon}>
                Create the first season
              </ButtonLink>
            }
          />
        </Panel>
      ) : season ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={TrophyIcon} label="Season" value={SHORT_STATUS[season.status]} note={season.name} />
            <StatTile
              icon={ShieldCheckIcon}
              label="Clubs"
              value={registered ?? placed}
              note={registered !== undefined ? `${placed} in divisions` : 'In divisions'}
            />
            <StatTile
              icon={CalendarDaysIcon}
              label="Matches played"
              value={matchesLoaded ? `${played} / ${leagueMatches.length}` : '...'}
              note={matchesLoaded && leagueMatches.length === 0 ? 'No fixtures yet' : 'League matches'}
            />
            {canTransfers && (
              <StatTile
                icon={ArrowsRightLeftIcon}
                label="Open offers"
                value={offersQuery.data?.length ?? (offersQuery.isError ? '-' : '...')}
                note={season.transfer_window_open ? 'Window open' : 'Window closed'}
              />
            )}
          </div>

          {finished ? (
            <Panel title="Season complete">
              <EmptyState
                icon={TrophyIcon}
                title={`${season.name} is finished`}
                description="Its tables and results are final. Create the next season when you are ready to start again."
                action={
                  <ButtonLink shape="square" to="/admin/seasons" icon={PlusIcon}>
                    Create the next season
                  </ButtonLink>
                }
              />
            </Panel>
          ) : (
            <Panel title="Setup checklist">
              <p className="-mt-2 mb-4 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                {doneCount} of {steps.length} steps done for {season.name}.
              </p>
              <ol className="flex flex-col gap-3">
                {steps.map((step, i) => {
                  const isCurrent = i === currentStep;
                  return (
                    <li
                      key={step.title}
                      className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between ${
                        isCurrent ? 'border-sffl-red bg-red-50 dark:bg-sffl-red/5' : 'border-gray-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        {step.done ? (
                          <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-xs font-black text-gray-500 dark:border-white/30 dark:text-gray-400"
                          >
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-sffl-navy dark:text-white">
                            {step.title} <span className="sr-only">{step.done ? '(done)' : '(to do)'}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                        </div>
                      </div>
                      {canSeasons && (
                        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                          {step.actions.map((a, n) => (
                            <ButtonLink shape="square"
                              key={a.label}
                              to={a.to}
                              variant={isCurrent && n === step.actions.length - 1 ? 'primary' : 'outline'}
                              size="sm"
                              icon={ArrowRightIcon}
                              iconPosition="right"
                            >
                              {a.label}
                            </ButtonLink>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Panel>
          )}
        </>
      ) : null}

      {links.length > 0 && (
        <Panel title="Quick links">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="flex min-h-11 items-center gap-3 border border-gray-200 p-4 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-sffl-red dark:border-white/10 dark:hover:bg-white/5"
                >
                  <l.icon className="h-6 w-6 shrink-0 text-sffl-red" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-sffl-navy dark:text-white">{l.label}</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400">{l.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
};
