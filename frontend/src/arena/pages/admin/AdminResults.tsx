import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDaysIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, ButtonLink, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, Field, RowActions, Select, Tabs, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaMatch } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge, type StatusTone } from '../../components';
import { useArenaScope } from '../../scope';
import { errorMessage, formatKickoffTime, formatMatchDate, matchRound } from '../../utils';

type MatchState = 'played' | 'forfeit' | 'overdue' | 'upcoming' | 'postponed' | 'waiting';
type Filter = 'all' | 'needs' | 'played';

/** A match with the extra fields this page shows and searches. */
interface ResultRowData extends ArenaMatch {
  fixture: string;
  round: string;
  state: MatchState;
}

const NO_ROWS: ResultRowData[] = [];

const STATE_LABEL: Record<MatchState, string> = {
  played: 'Played',
  forfeit: 'Forfeit',
  overdue: 'Needs a result',
  upcoming: 'Upcoming',
  postponed: 'Postponed',
  waiting: 'Waiting for clubs',
};
const STATE_TONE: Record<MatchState, StatusTone> = {
  played: 'success',
  forfeit: 'info',
  overdue: 'pending',
  upcoming: 'neutral',
  postponed: 'neutral',
  waiting: 'neutral',
};

const toRow = (m: ArenaMatch, now: number): ResultRowData => {
  let state: MatchState;
  if (m.status === 'completed') state = 'played';
  else if (m.status === 'forfeit') state = 'forfeit';
  else if (!m.home || !m.away) state = 'waiting';
  else if (m.status === 'postponed') state = 'postponed';
  else if (m.kickoff_at && new Date(m.kickoff_at).getTime() < now) state = 'overdue';
  else state = 'upcoming';
  return { ...m, fixture: `${m.home?.name ?? 'To be decided'} v ${m.away?.name ?? 'To be decided'}`, round: matchRound(m), state };
};

export const ArenaAdminResults = () => {
  const { divisions, divisionId, setDivisionId, isLoading: scopeLoading } = useArenaScope();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>('all');
  const [clearing, setClearing] = useState<ResultRowData | null>(null);

  const select = useCallback((view: { matches: ArenaMatch[] }) => {
    const now = Date.now();
    return view.matches.map((m) => toRow(m, now));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['arena', 'admin', 'matches', divisionId],
    queryFn: () => arenaApi.matches(divisionId),
    enabled: !!divisionId,
    select,
  });
  const all = data ?? NO_ROWS;

  const counts = useMemo(
    () => ({
      needs: all.filter((m) => m.state === 'overdue').length,
      played: all.filter((m) => m.state === 'played' || m.state === 'forfeit').length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    if (filter === 'needs') return all.filter((m) => m.state === 'overdue');
    if (filter === 'played') return all.filter((m) => m.state === 'played' || m.state === 'forfeit');
    return all;
  }, [all, filter]);

  const clear = useMutation({
    mutationFn: (m: ResultRowData) => arenaApi.clearResult(m.id),
    onSuccess: (_r, m) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`The result for ${m.fixture} was cleared.`);
      setClearing(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setClearing(null);
    },
  });

  const columns = useMemo<Column<ResultRowData>[]>(
    () => [
      {
        header: 'Match',
        accessor: 'fixture',
        sortable: true,
        cell: (m) => (
          <Link to={`/admin/results/${m.id}`} className="flex min-h-11 items-center gap-2 font-bold text-sffl-navy hover:underline dark:text-white">
            {m.home && <Crest club={m.home} size="sm" />}
            <span className="max-w-64 truncate">{m.fixture}</span>
            {m.away && <Crest club={m.away} size="sm" />}
          </Link>
        ),
      },
      { header: 'Round', accessor: 'round', sortValue: (m) => (m.stage === 'league' ? m.matchweek : 1000 + m.matchweek), sortable: true },
      {
        header: 'Kick-off (WAT)',
        sortValue: (m) => m.kickoff_at ?? '',
        sortable: true,
        cell: (m) => (m.kickoff_at ? `${formatMatchDate(m.kickoff_at)}, ${formatKickoffTime(m.kickoff_at)}` : 'To be confirmed'),
      },
      {
        header: 'Score',
        align: 'center',
        cell: (m) =>
          m.state === 'played' || m.state === 'forfeit' ? (
            <span className="tabular font-black text-sffl-navy dark:text-white">
              {m.home_score} - {m.away_score}
              {m.penalty_winner && <span className="ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400">({m.penalty_winner === 'home' ? m.home?.short : m.away?.short} on pens)</span>}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">No result</span>
          ),
      },
      { header: 'Status', accessor: 'state', cell: (m) => <StatusBadge tone={STATE_TONE[m.state]}>{STATE_LABEL[m.state]}</StatusBadge> },
      {
        header: 'Actions',
        align: 'right',
        cell: (m) => {
          const played = m.state === 'played' || m.state === 'forfeit';
          return (
            <RowActions
              label={`Actions for ${m.fixture}`}
              actions={[
                {
                  label: played ? 'Edit result' : 'Enter result',
                  icon: PencilSquareIcon,
                  disabled: m.state === 'waiting',
                  hint: m.state === 'waiting' ? 'Waiting for the earlier round to finish' : undefined,
                  onSelect: () => navigate(`/admin/results/${m.id}`),
                },
                { label: 'Clear result', icon: TrashIcon, danger: true, disabled: !played, hint: played ? undefined : 'There is no result to clear', onSelect: () => setClearing(m) },
              ]}
            />
          );
        },
      },
    ],
    [navigate],
  );

  if (!scopeLoading && divisions.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Results" subtitle="Enter the score and player stats for every match." />
        <Panel title="No divisions yet">
          <EmptyState
            icon={ClipboardDocumentListIcon}
            title="There is nothing to enter results for yet"
            description="Results belong to fixtures, and fixtures belong to a division. Set up a season, add a division and generate its fixtures first."
            action={<ButtonLink shape="square" to="/admin/seasons">Go to Seasons</ButtonLink>}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Results" subtitle="Enter the score and player stats for every match. Open a match to start." />

      <div className="w-full sm:max-w-xs">
        <Field label="Division" htmlFor="results-division">
          <Select shape="square" id="results-division" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {counts.needs > 0 && filter !== 'needs' && (
        <div role="status" className="flex flex-col gap-2 border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {counts.needs === 1 ? '1 match has kicked off and is waiting for a result.' : `${counts.needs} matches have kicked off and are waiting for a result.`}
          </p>
          <Button shape="square" variant="warning" size="sm" onClick={() => setFilter('needs')}>
            Show them
          </Button>
        </div>
      )}

      <Tabs
        aria-label="Filter matches"
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: `All (${all.length})` },
          { value: 'needs', label: `Needs a result (${counts.needs})` },
          { value: 'played', label: `Played (${counts.played})` },
        ]}
      />

      {!isLoading && all.length === 0 ? (
        <Panel title="No fixtures">
          <EmptyState
            icon={CalendarDaysIcon}
            title="This division has no fixtures yet"
            description="Generate the league fixtures from the season's page, then come back to enter results as matches are played."
            action={<ButtonLink shape="square" to="/admin/seasons">Go to Seasons</ButtonLink>}
          />
        </Panel>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading || scopeLoading}
          getRowId={(m) => m.id}
          searchPlaceholder="Search by club or matchweek"
          emptyMessage={filter === 'needs' ? 'Nothing is waiting for a result. All caught up.' : filter === 'played' ? 'No results have been entered yet.' : 'No matches found.'}
          itemsPerPage={20}
        />
      )}

      <ConfirmDialog
        open={!!clearing}
        title="Clear this result?"
        description="The score and every player's stats for this match are removed, and the match goes back to waiting for a result. For a knockout match, the winner is taken out of the next round."
        confirmLabel="Clear result"
        tone="danger"
        icon={TrashIcon}
        pending={clear.isPending}
        body={clearing && <ConfirmSummary rows={[['Match', clearing.fixture], ['Round', clearing.round], ['Score', `${clearing.home_score ?? '-'} - ${clearing.away_score ?? '-'}`]]} />}
        onConfirm={() => clearing && clear.mutate(clearing)}
        onCancel={() => setClearing(null)}
      />
    </div>
  );
};
