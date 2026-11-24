import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, CalendarDaysIcon, ExclamationTriangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Button, ButtonLink, ConfirmDialog, DashboardPageHeader, Spinner } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaMatch, ArenaSheetEditor } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge } from '../../components';
import { useArenaMe } from '../../hooks';
import { errorMessage, formatKickoffTime, formatMatchDate, matchRound } from '../../utils';
import { manageKeys } from './ContractShared';
import { SheetEditorView } from './SheetEditorView';

const NO_MATCHES: ArenaMatch[] = [];
/** How many matches show before "Show all matches", and how many get a status badge up front. */
const PREVIEW = 6;

const sheetQuery = (matchId: string, clubId: string | undefined) => ({
  queryKey: manageKeys.sheet(matchId, clubId),
  queryFn: () => arenaApi.sheet(matchId, clubId),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});

const sheetBadge = (editor: ArenaSheetEditor | undefined) => {
  if (!editor) return null;
  if (editor.locked) return <StatusBadge tone="neutral">Locked</StatusBadge>;
  return editor.sheet.status === 'submitted' ? <StatusBadge tone="success">Submitted</StatusBadge> : <StatusBadge tone="pending">Draft</StatusBadge>;
};

export const ArenaManageTeamSheets = () => {
  const [params] = useSearchParams();
  const clubId = params.get('club_id') || undefined;
  const wanted = params.get('match');
  const me = useArenaMe();
  const myId = clubId ?? me.data?.managed_club?.id ?? '';

  const fixturesQ = useQuery({ queryKey: manageKeys.fixtures(clubId), queryFn: () => arenaApi.manageFixtures(clubId) });
  const actingQ = useQuery({ queryKey: manageKeys.club(clubId), queryFn: () => arenaApi.manageClub(clubId), enabled: !!clubId });
  const fixtures = fixturesQ.data ?? NO_MATCHES;

  const [chosen, setChosen] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selectedId = chosen ?? (wanted && fixtures.some((f) => f.id === wanted) ? wanted : (fixtures[0]?.id ?? ''));
  const selectedIndex = fixtures.findIndex((f) => f.id === selectedId);
  const expanded = showAll || selectedIndex >= PREVIEW;
  const visible = expanded ? fixtures : fixtures.slice(0, PREVIEW);

  // A badge for each of the first few matches. These share their cache entry with the editor below.
  const previews = fixtures.slice(0, PREVIEW);
  const badgeQueries = useQueries({ queries: previews.map((m) => ({ ...sheetQuery(m.id, clubId), enabled: !!m.home_club_id && !!m.away_club_id })) });
  const editorOf = (id: string) => badgeQueries[previews.findIndex((m) => m.id === id)]?.data;

  const editorQ = useQuery({ ...sheetQuery(selectedId, clubId), enabled: !!selectedId });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const choose = (id: string) => {
    if (id === selectedId) return;
    if (dirty) setSwitchTo(id);
    else setChosen(id);
  };

  const header = <DashboardPageHeader title="Team Sheets" subtitle="Pick your starting XI, captain and substitutes for each upcoming match." />;

  if (fixturesQ.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <Spinner label="Loading your matches" />
      </div>
    );
  }

  if (fixturesQ.isError) {
    return (
      <div className="space-y-6">
        {header}
        <Panel title="We couldn't load your matches">
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Something went wrong"
            description={errorMessage(fixturesQ.error)}
            action={<Button onClick={() => fixturesQ.refetch()}>Try again</Button>}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-mobile-nav-2x">
      {header}

      {clubId && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          <UserCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-bold">Acting for {actingQ.data?.club.name ?? 'another club'}.</span> You are editing this club's team sheets as organiser staff.
          </p>
        </div>
      )}

      {fixtures.length === 0 ? (
        <Panel title="Upcoming matches">
          <EmptyState
            icon={CalendarDaysIcon}
            title="No upcoming matches"
            description="You can pick a team sheet once the organiser has scheduled your next fixture."
            action={
              <ButtonLink to="/matches" variant="outline">
                See all matches
              </ButtonLink>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel title="Choose a match">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((m) => {
                const opponent = m.home_club_id === myId ? m.away : m.home;
                const selected = m.id === selectedId;
                return (
                  <li key={m.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => choose(m.id)}
                      aria-pressed={selected}
                      className={`flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sffl-red ${
                        selected
                          ? 'border-sffl-red bg-lime-50 dark:border-arena-lime dark:bg-white/10'
                          : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                      }`}
                    >
                      {opponent ? <Crest club={opponent} size="md" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-gray-200 dark:bg-white/10" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-sffl-navy dark:text-white">
                          {m.home_club_id === myId ? 'vs' : 'at'} {opponent?.name ?? 'To be decided'}
                        </span>
                        <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                          {matchRound(m)} &middot; {formatMatchDate(m.kickoff_at)}, {formatKickoffTime(m.kickoff_at)} WAT
                        </span>
                        <span className="mt-1 block">{sheetBadge(selected ? (editorQ.data ?? editorOf(m.id)) : editorOf(m.id))}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {fixtures.length > PREVIEW && !expanded && (
              <div className="mt-3">
                <Button variant="ghost" icon={ArrowRightIcon} iconPosition="right" onClick={() => setShowAll(true)}>
                  Show all {fixtures.length} matches
                </Button>
              </div>
            )}
          </Panel>

          {editorQ.isLoading ? (
            <Spinner label="Loading your team sheet" />
          ) : editorQ.isError || !editorQ.data ? (
            <Panel title="We couldn't load this team sheet">
              <EmptyState
                icon={ExclamationTriangleIcon}
                title="Something went wrong"
                description={errorMessage(editorQ.error)}
                action={<Button onClick={() => editorQ.refetch()}>Try again</Button>}
              />
            </Panel>
          ) : (
            <SheetEditorView key={`${selectedId}:${clubId ?? ''}`} editor={editorQ.data} clubId={clubId} onDirtyChange={setDirty} />
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Looking for something else? Browse the{' '}
            <Link to="/matches" className="font-bold text-sffl-red hover:underline dark:text-arena-lime">
              full match list
            </Link>
            .
          </p>
        </>
      )}

      <ConfirmDialog
        open={switchTo !== null}
        title="Leave without saving?"
        description="You have changes to this team sheet that are not saved. If you switch matches now, they are lost."
        confirmLabel="Discard and switch"
        tone="warning"
        onConfirm={() => {
          setChosen(switchTo);
          setSwitchTo(null);
          setDirty(false);
        }}
        onCancel={() => setSwitchTo(null)}
      />
    </div>
  );
};
