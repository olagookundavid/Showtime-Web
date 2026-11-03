import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TrophyIcon,
  PlayIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { getCupState, setupCup, fillCupRound } from '../../services';
import type { CupState } from '../../types';
import { Button, ConfirmDialog, ConfirmSummary, Field, Input, Modal, Spinner } from '../ui';
import { getApiErrorMessage } from '../../utils';

interface AdminCupManagerProps {
  competitionId: string;
  isCompleted: boolean;
}

const CUP_ROUNDS = [
  { key: 'ROUND_1', label: 'Round 1', sublabel: 'Random draw', phase: 'swiss' },
  { key: 'ROUND_2', label: 'Round 2', sublabel: 'Same records meet', phase: 'swiss' },
  { key: 'ROUND_3', label: 'Round 3', sublabel: 'Last Swiss round', phase: 'swiss' },
  { key: 'QUARTERFINAL', label: 'Quarterfinals', sublabel: 'Top 8: 1v5 to 4v8', phase: 'knockout' },
  { key: 'SEMIFINAL', label: 'Semifinals', sublabel: 'Final 4', phase: 'knockout' },
  { key: 'FINAL', label: 'Final', sublabel: 'Championship', phase: 'knockout' },
];

const roundLabel = (key?: string) =>
  key === 'COMPLETED' ? 'Completed' : CUP_ROUNDS.find((r) => r.key === key)?.label ?? key ?? '';

const dayLabel = (date?: string) =>
  date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

const SCHEDULE_FORM_ID = 'cup-schedule-form';
// Cup days have run 13:20, 14:40, 16:00, 17:20, 18:40 at Showtime Arena.
const DEFAULT_KICKOFF = '13:20';
const DEFAULT_GAP_MINUTES = 80;
const DEFAULT_VENUE = 'Showtime Arena';

type PendingAction = 'setup' | 'fill' | null;
type RoundDay = { date: string; kickoff: string };

export const AdminCupManager: React.FC<AdminCupManagerProps> = ({ competitionId, isCompleted }) => {
  const queryClient = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [days, setDays] = useState<Record<string, RoundDay>>({});
  const [gapMinutes, setGapMinutes] = useState(String(DEFAULT_GAP_MINUTES));
  const [venue, setVenue] = useState(DEFAULT_VENUE);

  const { data: cupState, isLoading } = useQuery<CupState>({
    queryKey: ['adminCupState', competitionId],
    queryFn: () => getCupState(competitionId),
    enabled: !!competitionId,
  });

  const currentRound = cupState?.current_round || 'UNINITIALIZED';
  const notStarted = currentRound === 'UNINITIALIZED';
  const adopting = notStarted && !!cupState?.adopts_existing_matches;
  // Rounds that still need a date, in playing order.
  const missing = CUP_ROUNDS.filter((r) => cupState?.missing_rounds?.includes(r.key));
  const dayOf = (round: string): RoundDay => days[round] ?? { date: '', kickoff: DEFAULT_KICKOFF };
  const setDay = (round: string, patch: Partial<RoundDay>) =>
    setDays((d) => ({ ...d, [round]: { ...dayOf(round), ...patch } }));

  const onDone = (message: string) => {
    toast.success(message);
    setPending(null);
    setScheduleOpen(false);
    queryClient.invalidateQueries({ queryKey: ['adminCupState', competitionId] });
    queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
    queryClient.invalidateQueries({ queryKey: ['adminCompetitions'] });
    queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
    queryClient.invalidateQueries({ queryKey: ['publicStandings'] });
    queryClient.invalidateQueries({ queryKey: ['bracketMatches', competitionId] });
  };
  const onFail = (fallback: string) => (err: unknown) => {
    setPending(null);
    toast.error(getApiErrorMessage(err, fallback));
  };

  const setupMutation = useMutation({
    mutationFn: () =>
      setupCup(competitionId, {
        rounds: missing.map((r) => ({ round: r.key, date: dayOf(r.key).date, first_kickoff: dayOf(r.key).kickoff })),
        gap_minutes: Number(gapMinutes) || DEFAULT_GAP_MINUTES,
        venue,
      }),
    onSuccess: () => onDone(notStarted ? 'Cup set up: every round is dated' : 'Remaining rounds dated'),
    onError: onFail('Failed to set up the Cup'),
  });

  const fillMutation = useMutation({
    mutationFn: () => fillCupRound(competitionId),
    onSuccess: () => onDone(`${roundLabel(cupState?.next_round)} fixtures filled`),
    onError: onFail('Failed to fill the next round'),
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
        <Spinner label="Loading Cup stage..." />
      </div>
    );
  }

  const isCupCompleted = isCompleted || currentRound === 'COMPLETED';
  const activeIndex = CUP_ROUNDS.findIndex((r) => r.key === currentRound);
  const nextLabel = roundLabel(cupState?.next_round);
  const fillsQuarterfinals = cupState?.next_round === 'QUARTERFINAL';
  // Before the cup starts, can_advance means it can be set up.
  const canSetUp = notStarted ? !!cupState?.can_advance : missing.length > 0;
  const canFill = !notStarted && !!cupState?.can_advance;

  const getStepStatus = (index: number) => {
    if (isCupCompleted) return 'completed';
    if (notStarted) return 'upcoming';
    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'current';
    return 'upcoming';
  };

  const scheduleRows: [string, string][] = [
    ...(adopting ? ([['Round 1', 'The 5 matches already entered']] as [string, string][]) : []),
    ...missing.map(
      (r) => [r.label, `${dayLabel(dayOf(r.key).date)}, first game ${dayOf(r.key).kickoff}`] as [string, string],
    ),
    ['Between kickoffs', `${Number(gapMinutes) || DEFAULT_GAP_MINUTES} minutes`],
    ['Venue', venue],
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-sffl-navy text-white p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sffl-red flex items-center justify-center shrink-0 shadow-md">
            <TrophyIcon className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold">Cup Tournament</h2>
            <p className="text-xs md:text-sm text-gray-300 mt-0.5">
              Every round is dated up front. 10 teams play 3 Swiss rounds; the top 8 go into the knockout.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {!isCupCompleted && canSetUp && (
            <Button
              variant={canFill ? 'secondary' : 'primary'}
              tone="dark"
              icon={notStarted ? PlayIcon : CalendarDaysIcon}
              onClick={() => setScheduleOpen(true)}
            >
              {notStarted ? 'Set up Cup' : 'Date remaining rounds'}
            </Button>
          )}
          {!isCupCompleted && canFill && (
            <Button
              variant="primary"
              tone="dark"
              icon={ArrowRightIcon}
              iconPosition="right"
              onClick={() => setPending('fill')}
            >
              Fill {nextLabel}
            </Button>
          )}
          {isCupCompleted && (
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-bold">
              <CheckCircleIcon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Tournament completed
            </div>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/40">
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {CUP_ROUNDS.map((round, idx) => {
            const status = getStepStatus(idx);
            const undated = !notStarted && cupState?.missing_rounds?.includes(round.key);
            return (
              <li
                key={round.key}
                aria-current={status === 'current' ? 'step' : undefined}
                className={`p-3 rounded-xl border min-w-0 ${
                  status === 'current'
                    ? 'bg-red-50 dark:bg-red-950/30 border-sffl-red/40 shadow-sm'
                    : status === 'completed'
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40'
                      : 'bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      round.phase === 'swiss'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {round.phase}
                  </span>
                  {status === 'completed' && (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  {status === 'current' && (
                    <span className="flex h-2 w-2 relative" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sffl-red opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sffl-red" />
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm font-bold truncate ${
                    status === 'current'
                      ? 'text-sffl-red dark:text-red-400'
                      : status === 'completed'
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {round.label}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {undated ? 'No date yet' : round.sublabel}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Stage status */}
      <div className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <span className="text-xs uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
              Stage status
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white wrap-break-word">
            {cupState?.status_message || 'Tournament ready.'}
          </p>
          {!notStarted && missing.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 wrap-break-word">
              Not dated yet: {missing.map((r) => r.label).join(', ')}.
            </p>
          )}
        </div>

        {!isCupCompleted && (cupState?.matches_total ?? 0) > 0 && (
          <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-700/60 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 shrink-0">
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {adopting ? 'Matches already entered' : activeIndex >= 3 ? 'Knockout matches' : `${roundLabel(currentRound)} matches`}
              </div>
              <div className="text-base font-bold text-sffl-navy dark:text-white">
                {cupState?.matches_finished || 0} / {cupState?.matches_total || 0} played
              </div>
            </div>
            <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sffl-red h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    cupState?.matches_total
                      ? Math.round(((cupState.matches_finished || 0) / cupState.matches_total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dates for every round that has no fixtures yet */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={notStarted ? 'Set up the Cup' : 'Date the remaining rounds'}
        subtitle={
          notStarted
            ? adopting
              ? 'The 5 matches already entered stay as Round 1. Pick a day for each later round; their fixtures are filled as results come in.'
              : 'Pick a day for every round. Round 1 is drawn at random; later rounds are filled as results come in.'
            : 'Pick a day for each round that has none. Rounds already scheduled stay as they are.'
        }
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={SCHEDULE_FORM_ID} variant="primary">
              Continue
            </Button>
          </>
        }
      >
        <form
          id={SCHEDULE_FORM_ID}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setPending('setup');
          }}
        >
          <div className="space-y-3">
            {missing.map((r) => (
              <div key={r.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-3 items-end">
                <Field label={`${r.label} date`} htmlFor={`cup-date-${r.key}`}>
                  <Input
                    id={`cup-date-${r.key}`}
                    type="date"
                    required
                    value={dayOf(r.key).date}
                    onChange={(e) => setDay(r.key, { date: e.target.value })}
                  />
                </Field>
                <Field label="First kickoff" htmlFor={`cup-kickoff-${r.key}`}>
                  <Input
                    id={`cup-kickoff-${r.key}`}
                    type="time"
                    required
                    value={dayOf(r.key).kickoff}
                    onChange={(e) => setDay(r.key, { kickoff: e.target.value })}
                  />
                </Field>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Minutes between kickoffs"
              htmlFor="cup-gap"
              hint="Each game starts this long after the one before."
            >
              <Input
                id="cup-gap"
                type="number"
                min={10}
                max={360}
                required
                value={gapMinutes}
                onChange={(e) => setGapMinutes(e.target.value)}
              />
            </Field>
            <Field label="Venue" htmlFor="cup-venue">
              <Input
                id="cup-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Showtime Arena"
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can still change any single match's date, time or venue from the matches list afterwards.
          </p>
        </form>
      </Modal>

      {/* Rendered outside the Modal so its backdrop doesn't close the Modal. */}
      <ConfirmDialog
        open={pending === 'setup'}
        title={notStarted ? 'Set up the Cup?' : 'Date the remaining rounds?'}
        description={
          notStarted && !adopting
            ? 'Round 1 is drawn at random now, and every later round gets dated fixtures showing TBD until results fill them.'
            : 'Each round below gets its dated fixtures, showing TBD until results fill them.'
        }
        body={<ConfirmSummary rows={scheduleRows} />}
        confirmLabel={notStarted ? 'Set up Cup' : 'Save dates'}
        tone="info"
        icon={CalendarDaysIcon}
        pending={setupMutation.isPending}
        onConfirm={() => setupMutation.mutate()}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'fill'}
        title={`Fill ${nextLabel}?`}
        description={
          fillsQuarterfinals
            ? 'Round 3 results lock the order: ranks 9 and 10 are out, and the top 8 go into the quarterfinals (1v5, 2v6, 3v7, 4v8). From there winners move up on their own.'
            : `Teams with the same record are paired into the ${nextLabel} fixtures, with no rematches.`
        }
        body={
          <ConfirmSummary
            rows={[
              ['From', `${roundLabel(currentRound)} results`],
              ['Fills', nextLabel],
              ...(cupState?.auto_fill_on
                ? ([['Otherwise fills itself on', dayLabel(cupState.auto_fill_on)]] as [string, string][])
                : []),
            ]}
          />
        }
        confirmLabel={`Fill ${nextLabel}`}
        tone={fillsQuarterfinals ? 'warning' : 'info'}
        icon={ArrowRightIcon}
        pending={fillMutation.isPending}
        onConfirm={() => fillMutation.mutate()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
