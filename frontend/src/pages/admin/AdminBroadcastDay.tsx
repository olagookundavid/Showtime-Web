import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SignalIcon, SignalSlashIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  Loader,
} from '../../components';
import { getBroadcastDay, setBroadcastDayOnAir } from '../../services/broadcastApi';
import { formatMatchDate, formatMatchTime, getApiErrorMessage } from '../../utils';
import type { BroadcastDayMatch } from '../../types';
import { BroadcastControlPanel } from './AdminBroadcastStudio';

const NO_MATCHES: BroadcastDayMatch[] = [];

function matchTitle(m: BroadcastDayMatch) {
  return `${m.home_team.name || 'Home'} vs ${m.away_team.name || 'Away'}`;
}

function scoreText(m: BroadcastDayMatch) {
  return m.home_score == null && m.away_score == null ? '' : `${m.home_score ?? 0}–${m.away_score ?? 0}`;
}

const STATUS_STYLES: Record<string, string> = {
  LIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  FINISHED: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
  POSTPONED: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
};
const SCHEDULED_STYLE = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';

type PendingSwitch = { match: BroadcastDayMatch | null };

/**
 * Event-day studio: one live stream covers a whole match day, so vMix loads the
 * day's overlay links once and the producer puts each match on air in turn.
 * Every match keeps its own score and clock; the controls below drive whichever
 * match is selected, which need not be the one on air (set up the next game
 * while the current one is still showing).
 */
export function AdminBroadcastDay() {
  const { date = '' } = useParams<{ date: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['broadcastDay', date],
    queryFn: () => getBroadcastDay(date),
    enabled: !!date,
    // Statuses and scores change during the day; the on-air choice may be
    // switched from another device.
    refetchInterval: 15000,
  });
  const day = data?.day;
  const matches = data?.matches ?? NO_MATCHES;
  const onAirId = day?.on_air_match_id || '';
  const onAirMatch = matches.find((m) => m.id === onAirId) ?? null;

  // The match the controls drive: chosen in the URL, else the one on air, else
  // a live one, else the first of the day.
  const pickedId = searchParams.get('match') || '';
  const selected =
    matches.find((m) => m.id === pickedId) ||
    onAirMatch ||
    matches.find((m) => m.status === 'LIVE') ||
    matches[0] ||
    null;

  const selectMatch = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('match', id);
        return next;
      },
      { replace: true },
    );
  };

  const switchMutation = useMutation({
    mutationFn: (matchId: string | null) => setBroadcastDayOnAir(date, matchId),
    onSuccess: (_, matchId) => {
      const m = matches.find((x) => x.id === matchId);
      toast.success(m ? `${matchTitle(m)} is now on air` : 'Nothing is on air now');
      setPendingSwitch(null);
      queryClient.invalidateQueries({ queryKey: ['broadcastDay', date] });
      queryClient.invalidateQueries({ queryKey: ['broadcastDays'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not switch the on-air match')),
  });

  const dayLabel = formatMatchDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const title = day?.event_title || dayLabel || 'Match day';

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        back={{ to: '/admin/broadcast', label: 'Back to match days' }}
        title={title}
        subtitle={
          <>
            {day?.event_title ? `${dayLabel} · ` : ''}
            One stream for the whole day: pick a match to control, and put it on air when it kicks off.
          </>
        }
      />

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="font-semibold text-gray-700 dark:text-gray-200">This match day couldn't be loaded.</p>
          <ButtonLink to="/admin/broadcast" variant="outline">
            Back to match days
          </ButtonLink>
        </div>
      ) : matches.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="font-semibold text-gray-700 dark:text-gray-200">No matches are scheduled on {dayLabel}.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Matches appear here once they're scheduled for this date. Pick another day in the meantime.
          </p>
          <ButtonLink to="/admin/broadcast" variant="outline">
            Back to match days
          </ButtonLink>
        </div>
      ) : (
        <>
          {/* On air now */}
          <section
            aria-labelledby="on-air-heading"
            className={`rounded-xl md:rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              onAirMatch
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              {onAirMatch ? (
                <SignalIcon className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <SignalSlashIcon className="w-6 h-6 shrink-0 text-gray-400" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <h2 id="on-air-heading" className="text-sm font-bold text-gray-500 dark:text-gray-400">
                  On air now
                </h2>
                <p className="font-black text-lg text-gray-900 dark:text-white break-words">
                  {onAirMatch ? matchTitle(onAirMatch) : 'Nothing on air'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {onAirMatch
                    ? 'The day overlay in vMix is showing this match.'
                    : 'The day overlay in vMix is blank. Put a match on air below.'}
                </p>
              </div>
            </div>
            {onAirMatch && (
              <Button
                variant="outline"
                icon={SignalSlashIcon}
                onClick={() => setPendingSwitch({ match: null })}
                className="w-full sm:w-auto shrink-0"
              >
                Take off air
              </Button>
            )}
          </section>

          {/* The day's matches */}
          <section aria-labelledby="day-matches-heading" className="space-y-3">
            <h2 id="day-matches-heading" className="font-black text-gray-900 dark:text-white text-base md:text-lg">
              Matches on this day ({matches.length})
            </h2>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {matches.map((m) => {
                const isOnAir = m.id === onAirId;
                const isSelected = m.id === selected?.id;
                const score = scoreText(m);
                return (
                  <li
                    key={m.id}
                    className={`rounded-xl border p-4 flex flex-col gap-3 bg-white dark:bg-gray-800 ${
                      isSelected
                        ? 'border-sffl-navy ring-2 ring-sffl-navy/30 dark:border-blue-400 dark:ring-blue-400/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">
                        {formatMatchTime(m.time)} · {m.competition_name || 'Competition'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLES[m.status] ?? SCHEDULED_STYLE}`}
                      >
                        {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                      </span>
                      {isOnAir && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sffl-red text-white font-bold">
                          <SignalIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          On air
                        </span>
                      )}
                    </div>
                    <p className="font-black text-gray-900 dark:text-white break-words">
                      {matchTitle(m)}
                      {score && <span className="ml-2 font-bold text-gray-500 dark:text-gray-400">{score}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={isSelected ? 'navy' : 'secondary'}
                        size="sm"
                        icon={AdjustmentsHorizontalIcon}
                        onClick={() => selectMatch(m.id)}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? 'Controlling' : 'Control'}
                      </Button>
                      {!isOnAir && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={SignalIcon}
                          onClick={() => setPendingSwitch({ match: m })}
                        >
                          Put on air
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Controls for the selected match */}
          {selected && (
            <BroadcastControlPanel
              key={selected.id}
              matchId={selected.id}
              overlayTarget={{ kind: 'day', date }}
              header={() => (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h2 className="font-black text-gray-900 dark:text-white text-base md:text-lg">
                    Controls: {matchTitle(selected)}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selected.id === onAirId
                      ? 'This match is on air: changes show on the stream straight away.'
                      : 'This match is not on air. Set it up here; it shows on the stream once you put it on air.'}
                  </p>
                </div>
              )}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingSwitch !== null}
        title={pendingSwitch?.match ? 'Put this match on air?' : 'Take the stream off air?'}
        description={
          pendingSwitch?.match
            ? 'The day overlay in vMix switches to this match straight away. Any lower-third on screen is cleared.'
            : 'The day overlay in vMix goes blank until you put a match on air again.'
        }
        body={
          <ConfirmSummary
            rows={[
              ['Day', title],
              ['Now on air', onAirMatch ? matchTitle(onAirMatch) : 'Nothing'],
              ['After', pendingSwitch?.match ? matchTitle(pendingSwitch.match) : 'Nothing'],
            ]}
          />
        }
        confirmLabel={pendingSwitch?.match ? 'Put on air' : 'Take off air'}
        tone={pendingSwitch?.match ? 'info' : 'warning'}
        icon={pendingSwitch?.match ? SignalIcon : SignalSlashIcon}
        pending={switchMutation.isPending}
        onConfirm={() => switchMutation.mutate(pendingSwitch?.match?.id ?? null)}
        onCancel={() => setPendingSwitch(null)}
      />
    </div>
  );
}

export default AdminBroadcastDay;
