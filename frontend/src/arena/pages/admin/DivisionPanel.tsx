import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  TrashIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { Button, ConfirmDialog, ConfirmSummary, DataTable, RowActions, Select, Spinner, type Column, type RowAction } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaClubRef, ArenaDivision, ArenaMatch, ArenaSeason } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge } from '../../components';
import { errorMessage, formatKickoffTime, formatMatchDate, matchRound } from '../../utils';
import { DivisionClubsModal } from './DivisionClubsModal';
import { DivisionFormModal } from './DivisionFormModal';
import { FixturePreviewModal } from './FixturePreviewModal';
import { RescheduleModal } from './RescheduleModal';
import { NO_MATCHES, describeSchedule, invalidateArena, isPlayed, playoffRule, playoffSummary, seasonKeys } from './seasonHelpers';

type Pending = { kind: 'deleteFixtures' } | { kind: 'deleteDivision' } | { kind: 'playoffs' };

const TeamLine = ({ club }: { club: ArenaClubRef | null }) => (
  <span className="flex min-w-0 items-center gap-2">
    {club && <Crest club={club} size="sm" />}
    <span className="truncate">{club?.name ?? 'To be decided'}</span>
  </span>
);

const ResultCell = ({ m }: { m: ArenaMatch }) => {
  if (isPlayed(m) && m.home_score !== null && m.away_score !== null) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="tabular text-base font-black text-sffl-navy dark:text-white">
          {m.home_score} : {m.away_score}
        </span>
        {m.status === 'forfeit' && <StatusBadge tone="danger">Forfeit</StatusBadge>}
        {m.penalty_winner && <StatusBadge tone="neutral">Pens</StatusBadge>}
      </span>
    );
  }
  return m.status === 'postponed' ? <StatusBadge tone="pending">Postponed</StatusBadge> : <StatusBadge tone="neutral">Not played</StatusBadge>;
};

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-0.5 text-sm font-bold text-sffl-navy dark:text-white">{children}</dd>
  </div>
);

interface DivisionPanelProps {
  season: ArenaSeason;
  division: ArenaDivision;
  /** Every division of the season. */
  divisions: ArenaDivision[];
  /** Registered clubs by id, when the user may see the Clubs section. */
  clubsById: Map<string, ArenaClub> | null;
  canManageClubs: boolean;
  canEnterResults: boolean;
}

/** One division: its facts, clubs, fixtures and playoffs, and everything the organiser can do to it. */
export const DivisionPanel = ({ season, division, divisions, clubsById, canManageClubs, canEnterResults }: DivisionPanelProps) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [managingClubs, setManagingClubs] = useState(false);
  const [makingFixtures, setMakingFixtures] = useState(false);
  const [rescheduling, setRescheduling] = useState<ArenaMatch | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [round, setRound] = useState('');

  const readOnly = season.status === 'completed';
  const matchesQuery = useQuery({
    queryKey: seasonKeys.divisionMatches(division.id),
    queryFn: () => arenaApi.matches(division.id),
  });
  const matches = matchesQuery.data?.matches ?? NO_MATCHES;

  const league = useMemo(() => matches.filter((m) => m.stage === 'league'), [matches]);
  const leaguePlayed = league.filter(isPlayed).length;
  const hasPlayoffs = matches.length > league.length;
  const fixturesKnown = matchesQuery.isSuccess;
  const hasFixtures = league.length > 0;
  const allPlayed = hasFixtures && leaguePlayed === league.length;

  const rounds = useMemo(() => [...new Set(matches.map(matchRound))], [matches]);
  const rows = useMemo(() => (round ? matches.filter((m) => matchRound(m) === round) : matches), [matches, round]);

  const done = () => {
    invalidateArena(qc);
    setPending(null);
  };
  const failed = (err: unknown) => {
    setPending(null);
    toast.error(errorMessage(err));
  };

  const deleteFixtures = useMutation({
    mutationFn: () => arenaApi.deleteFixtures(division.id),
    onSuccess: () => {
      toast.success(`Fixtures deleted for ${division.name}.`);
      done();
    },
    onError: failed,
  });
  const deleteDivision = useMutation({
    mutationFn: () => arenaApi.deleteDivision(division.id),
    onSuccess: () => {
      toast.success(`${division.name} deleted.`);
      done();
    },
    onError: failed,
  });
  const makePlayoffs = useMutation({
    mutationFn: () => arenaApi.generatePlayoffs(division.id),
    onSuccess: () => {
      toast.success(`Playoffs made for ${division.name}.`);
      done();
    },
    onError: failed,
  });

  const clubsHint = readOnly
    ? "A completed season can't change its clubs."
    : hasFixtures
      ? "Clubs can't change once fixtures exist. Delete the fixtures first (only possible before any result is entered)."
      : !canManageClubs
        ? 'You need access to the Clubs section to choose clubs.'
        : '';
  const clubsDisabled = Boolean(clubsHint);

  const columns = useMemo<Column<ArenaMatch>[]>(
    () => [
      {
        header: 'Match',
        sortValue: (m) => m.home?.name ?? '',
        cell: (m) => (
          <span className="flex min-w-40 max-w-64 flex-col gap-1 font-bold text-sffl-navy dark:text-white">
            <TeamLine club={m.home} />
            <TeamLine club={m.away} />
          </span>
        ),
      },
      { header: 'Round', cell: (m) => <span className="whitespace-nowrap">{matchRound(m)}</span> },
      {
        header: 'Kick-off (WAT)',
        sortValue: (m) => m.kickoff_at ?? '',
        cell: (m) => (m.kickoff_at ? <span className="whitespace-nowrap">{`${formatMatchDate(m.kickoff_at)}, ${formatKickoffTime(m.kickoff_at)}`}</span> : <span className="text-gray-500">To be confirmed</span>),
      },
      { header: 'Result', cell: (m) => <ResultCell m={m} /> },
      {
        header: 'Actions',
        align: 'right',
        cell: (m) => {
          const played = isPlayed(m);
          const actions: RowAction[] = [
            {
              label: 'Reschedule',
              icon: ClockIcon,
              onSelect: () => setRescheduling(m),
              disabled: played,
              hint: played ? 'It already has a result.' : undefined,
            },
          ];
          if (canEnterResults) {
            const waiting = !m.home_club_id || !m.away_club_id;
            actions.push({
              label: played ? 'Edit result' : 'Enter result',
              icon: ClipboardDocumentListIcon,
              onSelect: () => navigate(`/admin/results/${m.id}`),
              disabled: waiting,
              hint: waiting ? 'Both clubs must be known first.' : undefined,
            });
          }
          return <RowActions label={`Actions for ${m.home?.name ?? 'TBD'} v ${m.away?.name ?? 'TBD'}`} actions={actions} />;
        },
      },
    ],
    [canEnterResults, navigate],
  );

  const moreActions: RowAction[] = [
    {
      label: 'Delete all fixtures',
      icon: CalendarDaysIcon,
      danger: true,
      onSelect: () => setPending({ kind: 'deleteFixtures' }),
      disabled: !hasFixtures || division.locked || readOnly,
      hint: division.locked ? 'Results are already in.' : !hasFixtures ? 'There are no fixtures yet.' : readOnly ? 'The season is completed.' : undefined,
    },
    {
      label: 'Delete division',
      icon: TrashIcon,
      danger: true,
      onSelect: () => setPending({ kind: 'deleteDivision' }),
      disabled: division.locked,
      hint: division.locked ? 'Results are already in, so it is locked.' : undefined,
    },
  ];

  const dialog = (() => {
    switch (pending?.kind) {
      case 'deleteFixtures':
        return {
          title: `Delete all fixtures in ${division.name}?`,
          description: 'Every league match is removed from the calendar so you can make new ones. This can only be done before any result is entered.',
          label: 'Delete fixtures',
          tone: 'danger' as const,
          icon: CalendarDaysIcon,
          busy: deleteFixtures.isPending,
          run: () => deleteFixtures.mutate(),
          rows: [['Division', division.name], ['Matches', String(matches.length)]] as [string, string][],
        };
      case 'deleteDivision':
        return {
          title: `Delete ${division.name}?`,
          description: 'The division and its fixtures are removed. Its clubs stay registered and can be put in another division. This cannot be undone.',
          label: 'Delete division',
          tone: 'danger' as const,
          icon: TrashIcon,
          busy: deleteDivision.isPending,
          run: () => deleteDivision.mutate(),
          rows: [['Division', division.name], ['Clubs', String(division.club_count)], ['Matches', String(matches.length)]] as [string, string][],
        };
      case 'playoffs':
        return {
          title: `Make the playoffs for ${division.name}?`,
          description: `${playoffRule(division.playoff_spots)} The clubs are picked from the final league table.`,
          label: 'Make playoffs',
          tone: 'success' as const,
          icon: TrophyIcon,
          busy: makePlayoffs.isPending,
          run: () => makePlayoffs.mutate(),
          rows: [['Division', division.name], ['Playoff places', String(division.playoff_spots)]] as [string, string][],
        };
      default:
        return null;
    }
  })();

  const clubs = clubsById ? division.club_ids.map((id) => clubsById.get(id)).filter((c): c is ArenaClub => Boolean(c)) : [];

  return (
    <Panel title={division.name}>
      <div className="flex flex-col gap-5">
        {division.description && <p className="-mt-2 text-sm text-gray-600 dark:text-gray-400">{division.description}</p>}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Fact label="Clubs">
            {division.club_count} {division.club_count === 1 ? 'club' : 'clubs'}
          </Fact>
          <Fact label="Match day">{describeSchedule(division)}</Fact>
          <Fact label="Playoffs">{playoffSummary(division.playoff_spots)}</Fact>
        </dl>

        {clubs.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={`Clubs in ${division.name}`}>
            {clubs.map((c) => (
              <li key={c.id} className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 dark:border-white/10">
                <Crest club={c} size="sm" className="rounded-full" />
                <span className="truncate text-xs font-bold text-sffl-navy dark:text-white">{c.name}</span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button shape="square" variant="outline" size="sm" icon={ShieldCheckIcon} disabled={clubsDisabled} onClick={() => setManagingClubs(true)}>
              Manage clubs
            </Button>
            <Button shape="square" variant="outline" size="sm" icon={PencilSquareIcon} onClick={() => setEditing(true)}>
              Edit division
            </Button>
            <RowActions label={`More actions for ${division.name}`} actions={moreActions} />
          </div>
          {clubsHint && <p className="mt-2 max-w-2xl text-xs text-gray-500 dark:text-gray-400">{clubsHint}</p>}
        </div>

        <div className="border-t border-gray-100 pt-4 dark:border-white/10">
          <h3 className="text-base font-extrabold text-sffl-navy dark:text-white">Fixtures</h3>

          {matchesQuery.isLoading ? (
            <Spinner label="Loading fixtures" className="py-8" />
          ) : matchesQuery.error ? (
            <EmptyState
              icon={CalendarDaysIcon}
              title="Fixtures could not be loaded"
              description={errorMessage(matchesQuery.error)}
              action={<Button shape="square" variant="outline" onClick={() => matchesQuery.refetch()}>Try again</Button>}
            />
          ) : division.club_count === 0 && !hasFixtures ? (
            <EmptyState
              icon={ShieldCheckIcon}
              title="No clubs in this division yet"
              description="Choose the clubs that will play here. You need at least 2 before you can make fixtures."
              action={
                <Button shape="square" icon={ShieldCheckIcon} disabled={clubsDisabled} onClick={() => setManagingClubs(true)}>
                  Add clubs
                </Button>
              }
            />
          ) : !hasFixtures && fixturesKnown ? (
            <EmptyState
              icon={CalendarDaysIcon}
              title="No fixtures yet"
              description={
                division.club_count < 2
                  ? 'Add at least one more club, then make the fixtures.'
                  : `Make the league calendar for the ${division.club_count} clubs. You will see a preview before anything is saved.`
              }
              action={
                readOnly ? undefined : division.club_count < 2 ? (
                  <Button shape="square" icon={ShieldCheckIcon} disabled={clubsDisabled} onClick={() => setManagingClubs(true)}>
                    Add clubs
                  </Button>
                ) : (
                  <Button shape="square" icon={CalendarDaysIcon} onClick={() => setMakingFixtures(true)}>
                    Make fixtures
                  </Button>
                )
              }
            />
          ) : (
            <div className="mt-2 flex flex-col gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                {leaguePlayed} of {league.length} league matches played.
              </p>

              {division.playoff_spots > 0 && (
                <div className="flex flex-col gap-3 border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sffl-navy dark:text-white">Playoffs</p>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{playoffRule(division.playoff_spots)}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {hasPlayoffs
                        ? 'The playoff matches are in the list below.'
                        : allPlayed
                          ? 'Every league match has a result, so the playoffs can be made now.'
                          : `Available once every league match has a result (${league.length - leaguePlayed} to go).`}
                    </p>
                  </div>
                  {!hasPlayoffs && (
                    <Button shape="square"
                      icon={TrophyIcon}
                      className="shrink-0"
                      disabled={!allPlayed || readOnly}
                      onClick={() => setPending({ kind: 'playoffs' })}
                    >
                      Make playoffs
                    </Button>
                  )}
                </div>
              )}

              <DataTable
                data={rows}
                columns={columns}
                getRowId={(m) => m.id}
                searchable={false}
                itemsPerPage={10}
                emptyMessage="No matches in this round."
                headerActions={
                  rounds.length > 1 ? (
                    <Select shape="square" aria-label={`Show round in ${division.name}`} value={round} onChange={(e) => setRound(e.target.value)} className="w-full sm:w-52">
                      <option value="">All rounds</option>
                      {rounds.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {editing && <DivisionFormModal seasonId={season.id} division={division} onClose={() => setEditing(false)} />}
      {managingClubs && <DivisionClubsModal division={division} divisions={divisions} onClose={() => setManagingClubs(false)} />}
      {makingFixtures && <FixturePreviewModal division={division} season={season} onClose={() => setMakingFixtures(false)} />}
      {rescheduling && <RescheduleModal match={rescheduling} onClose={() => setRescheduling(null)} />}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        body={dialog ? <ConfirmSummary rows={dialog.rows} /> : undefined}
        confirmLabel={dialog?.label ?? 'Confirm'}
        tone={dialog?.tone ?? 'warning'}
        icon={dialog?.icon}
        pending={dialog?.busy}
        onConfirm={() => dialog?.run()}
        onCancel={() => setPending(null)}
      />
    </Panel>
  );
};
