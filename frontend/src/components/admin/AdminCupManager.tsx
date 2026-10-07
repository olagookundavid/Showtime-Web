import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TrophyIcon,
  PlayIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getCupState, initializeCup, advanceCupRound } from '../../services/api';
import type { CupState } from '../../types';
import { Button, ConfirmDialog, ConfirmSummary, Field, Input, Modal, Spinner } from '../ui';
import { getApiErrorMessage } from '../../utils';

interface AdminCupManagerProps {
  competitionId: string;
  isCompleted: boolean;
}

const CUP_ROUNDS = [
  { key: 'ROUND_1', label: 'Round 1', sublabel: 'Random draw', phase: 'swiss' },
  { key: 'ROUND_2', label: 'Round 2', sublabel: 'Paired by rank', phase: 'swiss' },
  { key: 'ROUND_3', label: 'Round 3', sublabel: 'Final Swiss round', phase: 'swiss' },
  { key: 'QUARTERFINAL', label: 'Quarterfinal', sublabel: 'Top 8 (1v5 to 4v8)', phase: 'knockout' },
  { key: 'SEMIFINAL', label: 'Semifinal', sublabel: 'Final 4', phase: 'knockout' },
  { key: 'FINAL', label: 'Final', sublabel: 'Championship', phase: 'knockout' },
];

const roundLabel = (key?: string) =>
  key === 'COMPLETED' ? 'Completed' : CUP_ROUNDS.find((r) => r.key === key)?.label ?? key ?? '';

// Rounds 1–3 and the knockout tree (built after Round 3) create new fixtures,
// so they need a date, kickoff and venue. Later steps only move the stage on:
// the semifinals and Final already exist and fill in as winners advance.
const CREATES_FIXTURES = new Set(['UNINITIALIZED', 'ROUND_1', 'ROUND_2', 'ROUND_3']);

const SCHEDULE_FORM_ID = 'cup-schedule-form';

export const AdminCupManager: React.FC<AdminCupManagerProps> = ({ competitionId, isCompleted }) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [scheduleVenue, setScheduleVenue] = useState('Showtime Stadium');

  const { data: cupState, isLoading } = useQuery<CupState>({
    queryKey: ['adminCupState', competitionId],
    queryFn: () => getCupState(competitionId),
    enabled: !!competitionId,
  });

  const currentRound = cupState?.current_round || 'UNINITIALIZED';
  const isInitialize = currentRound === 'UNINITIALIZED';
  const needsSchedule = CREATES_FIXTURES.has(currentRound);

  const onDone = (message: string) => {
    toast.success(message);
    setConfirmOpen(false);
    setModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['adminCupState', competitionId] });
    queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
    queryClient.invalidateQueries({ queryKey: ['adminCompetitions'] });
    queryClient.invalidateQueries({ queryKey: ['publicCompetitions'] });
    queryClient.invalidateQueries({ queryKey: ['publicStandings'] });
  };
  const onFail = (fallback: string) => (err: unknown) => {
    setConfirmOpen(false);
    toast.error(getApiErrorMessage(err, fallback));
  };

  const schedule = needsSchedule
    ? { date: scheduleDate, time: scheduleTime, venue: scheduleVenue }
    : undefined;

  const initMutation = useMutation({
    mutationFn: () => initializeCup(competitionId, schedule),
    onSuccess: (data) => onDone(data.message || 'Cup started with Round 1'),
    onError: onFail('Failed to start the Cup'),
  });

  const advanceMutation = useMutation({
    mutationFn: () => advanceCupRound(competitionId, schedule),
    onSuccess: (data) => onDone(data.message || 'Cup moved to the next stage'),
    onError: onFail('Failed to advance the Cup'),
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
  const nextLabel = isInitialize ? 'Round 1' : roundLabel(cupState?.next_round);
  const isFinishing = cupState?.next_round === 'COMPLETED';
  const pending = initMutation.isPending || advanceMutation.isPending;

  const getStepStatus = (index: number) => {
    if (isCupCompleted) return 'completed';
    if (isInitialize) return 'upcoming';
    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'current';
    return 'upcoming';
  };

  // Steps that create fixtures collect a schedule first; the rest go straight
  // to the confirm dialog.
  const startAction = () => (needsSchedule ? setModalOpen(true) : setConfirmOpen(true));

  const confirmTitle = isInitialize
    ? 'Start the Cup?'
    : isFinishing
      ? 'Complete the Cup?'
      : `Advance to ${nextLabel}?`;
  const confirmDescription = isInitialize
    ? 'Five Round 1 fixtures will be drawn at random between the 10 teams.'
    : currentRound === 'ROUND_3'
      ? 'The Swiss table is locked. Ranks 9 and 10 are eliminated, and the quarterfinals (1v5, 2v6, 3v7, 4v8), semifinals and Final are created.'
      : needsSchedule
        ? `Five ${nextLabel} fixtures will be paired from the current table, with no rematches.`
        : isFinishing
          ? 'The Cup is marked completed and can no longer be changed.'
          : `The Cup moves on to the ${nextLabel}. Its fixtures already exist and are filled in by the winners.`;

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
              10 teams play 3 Swiss rounds; the top 8 go into a knockout bracket.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isInitialize && !isCupCompleted && (
            <Button variant="primary" tone="dark" icon={PlayIcon} onClick={startAction}>
              Start Cup (Round 1)
            </Button>
          )}

          {!isInitialize && !isCupCompleted && cupState?.can_advance && (
            <Button variant="primary" tone="dark" icon={ArrowRightIcon} iconPosition="right" onClick={startAction}>
              {isFinishing ? 'Complete Cup' : `Advance to ${nextLabel}`}
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
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{round.sublabel}</div>
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
            {isInitialize
              ? 'Not started. Enrol exactly 10 active teams, then start the Cup to draw Round 1.'
              : cupState?.status_message || 'Tournament ready.'}
          </p>
        </div>

        {!isInitialize && !isCupCompleted && (
          <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-700/60 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 shrink-0">
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {roundLabel(currentRound)} matches
              </div>
              <div className="text-base font-bold text-sffl-navy dark:text-white">
                {cupState?.matches_finished || 0} / {cupState?.matches_total || 0} finished
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

      {/* Schedule for the fixtures this step creates */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isInitialize ? 'Schedule Round 1' : `Schedule the ${nextLabel}`}
        subtitle="Date, kickoff time and venue for the new fixtures. You can still edit each match afterwards."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmOpen(true);
          }}
        >
          {currentRound === 'ROUND_3' && (
            <div className="flex gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <div className="font-bold">Quarterfinal cutoff</div>
                <p>
                  Advancing locks the Swiss table. Ranks 9 and 10 are eliminated; the top 8 meet in the
                  quarterfinals (1v5, 2v6, 3v7, 4v8). The date below is for the quarterfinals; the semifinals
                  follow a week later and the Final a week after that.
                </p>
              </div>
            </div>
          )}

          <Field label="Fixture date" htmlFor="cup-schedule-date">
            <Input
              id="cup-schedule-date"
              type="date"
              required
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </Field>

          <Field label="Kickoff time" htmlFor="cup-schedule-time">
            <Input
              id="cup-schedule-time"
              type="time"
              required
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </Field>

          <Field label="Venue" htmlFor="cup-schedule-venue">
            <Input
              id="cup-schedule-venue"
              type="text"
              value={scheduleVenue}
              onChange={(e) => setScheduleVenue(e.target.value)}
              placeholder="e.g. Showtime Stadium"
            />
          </Field>
        </form>
      </Modal>

      {/* Rendered outside the Modal so its backdrop doesn't close the Modal. */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        body={
          <ConfirmSummary
            rows={[
              ['Stage', isInitialize ? 'Not started' : roundLabel(currentRound)],
              ['Moves to', nextLabel],
              ...(needsSchedule
                ? ([
                    ['Date', scheduleDate],
                    ['Kickoff', scheduleTime],
                    ['Venue', scheduleVenue],
                  ] as [string, string][])
                : []),
            ]}
          />
        }
        confirmLabel={isInitialize ? 'Start Cup' : isFinishing ? 'Complete Cup' : `Advance to ${nextLabel}`}
        tone={currentRound === 'ROUND_3' || isFinishing ? 'warning' : 'info'}
        icon={isInitialize ? PlayIcon : isFinishing ? CheckCircleIcon : ArrowRightIcon}
        pending={pending}
        onConfirm={() => (isInitialize ? initMutation.mutate() : advanceMutation.mutate())}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
