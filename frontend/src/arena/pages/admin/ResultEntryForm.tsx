import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Checkbox, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, Field, Input, Select, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClubRef, ArenaResultForm, ArenaResultInput, ArenaStatLine } from '../../../types';
import { Crest, Panel } from '../../components';
import { errorMessage, formatKickoffTime, formatMatchDate, matchRound } from '../../utils';

type Side = 'home' | 'away';

/** One squad member's row in the grid. Numbers are text so a field can be empty while typing. */
interface EntryRow {
  player_id: string;
  gamertag: string;
  position: string;
  shirt_number: number | null;
  included: boolean;
  started: boolean;
  goals: string;
  assists: string;
  rating: string;
  motm: boolean;
}

interface SideRows {
  home: EntryRow[];
  away: EntryRow[];
}

const toEntryRows = (players: ArenaResultForm['home']['players']): EntryRow[] =>
  players.map((p) => ({
    player_id: p.player_id,
    gamertag: p.gamertag,
    position: p.position,
    shirt_number: p.shirt_number,
    included: p.included,
    started: p.started,
    goals: String(p.goals),
    assists: String(p.assists),
    rating: p.rating === null ? '' : String(p.rating),
    motm: p.motm,
  }));

/** A whole number from 0 to 99, or null when the text isn't one. */
const parseCount = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};
const countOrZero = (s: string): number => (s.trim() === '' ? 0 : (parseCount(s) ?? NaN));
const ratingOf = (s: string): number | null | undefined => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : undefined;
};

const sideScore = (rows: EntryRow[]) => {
  const played = rows.filter((r) => r.included);
  return {
    count: played.length,
    goals: played.reduce((t, r) => t + countOrZero(r.goals), 0),
    assists: played.reduce((t, r) => t + countOrZero(r.assists), 0),
    started: played.filter((r) => r.started).length,
    badRating: played.some((r) => ratingOf(r.rating) === undefined),
    badNumber: played.some((r) => Number.isNaN(countOrZero(r.goals)) || Number.isNaN(countOrZero(r.assists))),
  };
};

const cellInput = 'w-20';

/** The editable grid columns for one side. They only read the row they're given, so they stay stable. */
const buildColumns = (update: (id: string, patch: Partial<EntryRow>) => void, setMotm: (id: string, on: boolean) => void): Column<EntryRow>[] => [
  {
    header: 'Player',
    accessor: 'gamertag',
    cell: (r) => (
      <span className="block min-h-11 max-w-48 py-1">
        <span className="block truncate font-bold text-sffl-navy dark:text-white">{r.gamertag}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {r.shirt_number ? `#${r.shirt_number} · ` : ''}
          {r.position}
        </span>
      </span>
    ),
  },
  {
    header: 'Played',
    align: 'center',
    cell: (r) => (
      <label className="flex min-h-11 min-w-11 items-center justify-center">
        <Checkbox
          aria-label={`${r.gamertag} played`}
          checked={r.included}
          onChange={(e) => update(r.player_id, e.target.checked ? { included: true } : { included: false, started: false, motm: false })}
        />
      </label>
    ),
  },
  {
    header: 'Started',
    align: 'center',
    cell: (r) => (
      <label className="flex min-h-11 min-w-11 items-center justify-center">
        <Checkbox aria-label={`${r.gamertag} started`} checked={r.started} onChange={(e) => update(r.player_id, e.target.checked ? { started: true, included: true } : { started: false })} />
      </label>
    ),
  },
  {
    header: 'Goals',
    cell: (r) => (
      <Input shape="square"
        aria-label={`${r.gamertag} goals`}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={r.goals}
        disabled={!r.included}
        onChange={(e) => update(r.player_id, { goals: e.target.value })}
        className={cellInput}
      />
    ),
  },
  {
    header: 'Assists',
    cell: (r) => (
      <Input shape="square"
        aria-label={`${r.gamertag} assists`}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={r.assists}
        disabled={!r.included}
        onChange={(e) => update(r.player_id, { assists: e.target.value })}
        className={cellInput}
      />
    ),
  },
  {
    header: 'Rating (0-10)',
    cell: (r) => (
      <Input shape="square"
        aria-label={`${r.gamertag} rating`}
        type="number"
        inputMode="decimal"
        min={0}
        max={10}
        step={0.1}
        value={r.rating}
        disabled={!r.included}
        invalid={r.included && ratingOf(r.rating) === undefined}
        onChange={(e) => update(r.player_id, { rating: e.target.value })}
        placeholder="Optional"
        className="w-24"
      />
    ),
  },
  {
    header: 'Man of the match',
    align: 'center',
    cell: (r) => (
      <label className="flex min-h-11 min-w-11 items-center justify-center">
        <Checkbox aria-label={`${r.gamertag} man of the match`} checked={r.motm} disabled={!r.included} onChange={(e) => setMotm(r.player_id, e.target.checked)} />
      </label>
    ),
  },
];

const Total = ({ label, value, of, ok }: { label: string; value: number; of: number; ok: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
    {ok ? <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
    {label} {value} / {of}
  </span>
);

interface SectionProps {
  club: ArenaClubRef;
  rows: EntryRow[];
  score: number | null;
  columns: Column<EntryRow>[];
}

/** One club's player grid, with live totals against the score. */
const PlayersSection = ({ club, rows, score, columns }: SectionProps) => {
  const t = sideScore(rows);
  const target = score ?? 0;
  const goalsOk = t.count === 0 || (t.goals === target && !t.badNumber);
  const assistsOk = t.assists <= target;
  return (
    <section className="space-y-3" aria-label={`${club.name} players`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-sffl-navy dark:text-white">
          <Crest club={club} size="sm" />
          <span className="truncate">{club.name}</span>
        </h3>
        {t.count > 0 && (
          <>
            <Total label="Goals entered" value={t.goals} of={target} ok={goalsOk} />
            <Total label="Assists" value={t.assists} of={target} ok={assistsOk} />
          </>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t.count} played, {t.started} started
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="border border-gray-200 p-4 text-sm text-gray-600 dark:border-white/10 dark:text-gray-400">
          {club.name} has no players registered, so there are no stats to enter.{' '}
          <Link to="/admin/clubs" className="font-bold text-sffl-red hover:underline">
            Add players on the Clubs page
          </Link>
          .
        </p>
      ) : (
        <DataTable data={rows} columns={columns} getRowId={(r) => r.player_id} searchable={false} paginated={false} compact emptyMessage="No players." />
      )}
    </section>
  );
};

/**
 * The result entry screen once the form has loaded. Its state starts from the
 * form (earlier entry, or the submitted team sheets), so mount it with a key.
 */
export const ResultEntryForm = ({ form }: { form: ArenaResultForm }) => {
  const { match } = form;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const played = match.status === 'completed' || match.status === 'forfeit';
  const knockout = match.stage !== 'league';
  const hadStats = played && [...form.home.players, ...form.away.players].some((p) => p.included);

  const [homeScore, setHomeScore] = useState(played && match.status === 'completed' && match.home_score !== null ? String(match.home_score) : '');
  const [awayScore, setAwayScore] = useState(played && match.status === 'completed' && match.away_score !== null ? String(match.away_score) : '');
  const [forfeit, setForfeit] = useState<boolean>(match.status === 'forfeit');
  const [forfeitWinner, setForfeitWinner] = useState<'' | Side>(match.status === 'forfeit' ? ((match.home_score ?? 0) > (match.away_score ?? 0) ? 'home' : 'away') : '');
  const [penalty, setPenalty] = useState<'' | Side>(match.penalty_winner ?? '');
  const [withStats, setWithStats] = useState(hadStats);
  const [rows, setRows] = useState<SideRows>(() => ({ home: toEntryRows(form.home.players), away: toEntryRows(form.away.players) }));
  const [clearing, setClearing] = useState(false);

  const updateRow = useCallback((side: Side) => (id: string, patch: Partial<EntryRow>) => setRows((r) => ({ ...r, [side]: r[side].map((x) => (x.player_id === id ? { ...x, ...patch } : x)) })), []);
  const setMotm = useCallback(
    (side: Side) => (id: string, on: boolean) =>
      // Only one player in the whole match can be man of the match.
      setRows((r) => ({
        home: r.home.map((x) => ({ ...x, motm: side === 'home' && x.player_id === id ? on : false })),
        away: r.away.map((x) => ({ ...x, motm: side === 'away' && x.player_id === id ? on : false })),
      })),
    [],
  );
  const homeColumns = useMemo(() => buildColumns(updateRow('home'), setMotm('home')), [updateRow, setMotm]);
  const awayColumns = useMemo(() => buildColumns(updateRow('away'), setMotm('away')), [updateRow, setMotm]);

  const home = parseCount(homeScore);
  const away = parseCount(awayScore);
  const level = !forfeit && home !== null && away !== null && home === away;
  const needsPenalty = knockout && level;

  const problems = useMemo(() => {
    const out: string[] = [];
    if (forfeit) {
      if (!forfeitWinner) out.push('Choose which club won the forfeit.');
      return out;
    }
    if (home === null || away === null) out.push('Enter a whole-number score from 0 to 99 for both clubs.');
    if (needsPenalty && !penalty) out.push('A knockout match cannot end level. Choose who won on penalties.');
    if (withStats && home !== null && away !== null) {
      ([['home', home, form.home.club], ['away', away, form.away.club]] as const).forEach(([side, score, club]) => {
        const t = sideScore(rows[side]);
        if (t.badNumber) out.push(`${club.name}: goals and assists must be whole numbers from 0 to 99.`);
        if (t.badRating) out.push(`${club.name}: ratings run from 0 to 10.`);
        if (t.count > 0 && !t.badNumber) {
          if (t.goals !== score) out.push(`${club.name} scored ${score}, but the players' goals add up to ${t.goals}.`);
          if (t.assists > score) out.push(`${club.name} scored ${score}, so they can't have ${t.assists} assists.`);
        }
      });
    }
    return out;
  }, [forfeit, forfeitWinner, home, away, needsPenalty, penalty, withStats, rows, form.home.club, form.away.club]);

  const save = useMutation({
    mutationFn: () => {
      let body: ArenaResultInput;
      if (forfeit) {
        body = { home_score: 0, away_score: 0, forfeit_winner: forfeitWinner, stats: [] };
      } else {
        const stats: ArenaStatLine[] = [];
        if (withStats) {
          (['home', 'away'] as const).forEach((side) => {
            const clubId = form[side].club.id;
            rows[side]
              .filter((r) => r.included)
              .forEach((r) =>
                stats.push({
                  player_id: r.player_id,
                  club_id: clubId,
                  started: r.started,
                  goals: countOrZero(r.goals),
                  assists: countOrZero(r.assists),
                  rating: ratingOf(r.rating) ?? null,
                  motm: r.motm,
                }),
              );
          });
        }
        body = { home_score: home ?? 0, away_score: away ?? 0, penalty_winner: needsPenalty ? penalty : '', stats };
      }
      return arenaApi.recordResult(match.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success('Result saved.');
      navigate('/admin/results');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const clear = useMutation({
    mutationFn: () => arenaApi.clearResult(match.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success('The result was cleared.');
      navigate('/admin/results');
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setClearing(false);
    },
  });

  const fixture = `${form.home.club.name} v ${form.away.club.name}`;
  const when = match.kickoff_at ? `${formatMatchDate(match.kickoff_at)}, ${formatKickoffTime(match.kickoff_at)} WAT` : 'Kick-off to be confirmed';

  const scoreBox = (label: string, value: string, set: (v: string) => void, shown?: number) => (
    <Input shape="square"
      aria-label={label}
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={forfeit && shown !== undefined ? String(shown) : value}
      disabled={forfeit}
      onChange={(e) => set(e.target.value)}
      placeholder="0"
      className="w-24 [&_input]:min-h-16 [&_input]:text-center [&_input]:text-3xl [&_input]:font-black"
    />
  );

  const winnerScore = (side: Side) => (forfeitWinner === side ? 3 : forfeitWinner ? 0 : undefined);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={fixture}
        subtitle={`${matchRound(match)}, ${when}. Enter the final score; player stats are optional but feed the leaderboards.`}
        back={{ to: '/admin/results', label: 'Results' }}
        actions={
          played ? (
            <Button shape="square" variant="danger" icon={TrashIcon} onClick={() => setClearing(true)}>
              Clear result
            </Button>
          ) : undefined
        }
      />

      <Panel title="Final score">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-6">
          {([['home', form.home.club, homeScore, setHomeScore], ['away', form.away.club, awayScore, setAwayScore]] as const).map(([side, club, value, set], i) => (
            <div key={side} className={`flex min-w-0 flex-col items-center gap-2 text-center ${i === 1 ? 'order-3' : 'order-1'}`}>
              <Crest club={club} size="lg" />
              <p className="w-full truncate text-sm font-bold text-sffl-navy sm:text-base dark:text-white">{club.name}</p>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{side === 'home' ? 'Home' : 'Away'}</p>
              {scoreBox(`${club.name} score`, value, set, winnerScore(side))}
            </div>
          ))}
          <p aria-hidden="true" className="order-2 self-center pt-16 text-2xl font-black text-gray-400">
            :
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 dark:border-white/10">
          <div>
            <Checkbox label="This match was a forfeit" hint="The winner is given a 3-0 win and no player stats are kept." checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
            {forfeit && (
              <Field label="Who won?" htmlFor="forfeit-winner" className="mt-2">
                <Select shape="square" id="forfeit-winner" value={forfeitWinner} onChange={(e) => setForfeitWinner(e.target.value as '' | Side)} invalid={!forfeitWinner}>
                  <option value="">Choose the winner</option>
                  <option value="home">{form.home.club.name}</option>
                  <option value="away">{form.away.club.name}</option>
                </Select>
              </Field>
            )}
          </div>
          {needsPenalty && (
            <Field label="Level after extra time? Who won on penalties?" htmlFor="penalty-winner" hint="A knockout match can't end in a draw.">
              <Select shape="square" id="penalty-winner" value={penalty} onChange={(e) => setPenalty(e.target.value as '' | Side)} invalid={!penalty}>
                <option value="">Choose the winner</option>
                <option value="home">{form.home.club.name}</option>
                <option value="away">{form.away.club.name}</option>
              </Select>
            </Field>
          )}
        </div>
      </Panel>

      {forfeit ? (
        <p className="flex items-start gap-2 border border-gray-200 p-4 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
          <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          Forfeits are recorded as a 3-0 win and no player stats are kept.
        </p>
      ) : (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-sffl-navy dark:text-white">Player stats</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Optional, but they feed the goals, assists and ratings leaderboards. Tick who played, then enter their numbers.</p>
            <Checkbox
              label="Record player stats for this match"
              hint={hadStats ? 'Turn this off to remove the stats already saved for this match.' : 'Leave off to save just the score.'}
              checked={withStats}
              onChange={(e) => setWithStats(e.target.checked)}
            />
          </div>
          {withStats && (
            <>
              <PlayersSection club={form.home.club} rows={rows.home} score={home} columns={homeColumns} />
              <PlayersSection club={form.away.club} rows={rows.away} score={away} columns={awayColumns} />
            </>
          )}
        </section>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-white/10">
        {problems.length > 0 && (
          <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <p className="font-bold">Fix this to save:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button shape="square" variant="secondary" onClick={() => navigate('/admin/results')} disabled={save.isPending}>
            Cancel
          </Button>
          <Button shape="square" onClick={() => save.mutate()} loading={save.isPending} disabled={problems.length > 0}>
            {played ? 'Save changes' : 'Save result'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={clearing}
        title="Clear this result?"
        description="The score and every player's stats for this match are removed. For a knockout match, the winner is taken out of the next round."
        confirmLabel="Clear result"
        tone="danger"
        icon={TrashIcon}
        pending={clear.isPending}
        body={<ConfirmSummary rows={[['Match', fixture], ['Round', matchRound(match)], ['Score', `${match.home_score ?? '-'} - ${match.away_score ?? '-'}`]]} />}
        onConfirm={() => clear.mutate()}
        onCancel={() => setClearing(false)}
      />
    </div>
  );
};
