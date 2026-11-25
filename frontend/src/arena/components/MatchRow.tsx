import { Link } from 'react-router-dom';
import type { ArenaMatch } from '../../types';
import { formatKickoffTime, formatMatchDate, matchRound } from '../utils';
import { Crest } from './Crest';

/** One fixture or result: both clubs, the score or kick-off time, and the round. */
export const MatchRow = ({ match: m, showRound = true }: { match: ArenaMatch; showRound?: boolean }) => {
  const played = (m.status === 'completed' || m.status === 'forfeit') && m.home_score !== null && m.away_score !== null;
  const homeName = m.home?.name ?? 'To be decided';
  const awayName = m.away?.name ?? 'To be decided';
  const pens = m.penalty_winner ? (m.penalty_winner === 'home' ? homeName : awayName) : null;

  return (
    <Link
      to={`/matches/${m.id}`}
      aria-label={`${homeName} versus ${awayName}, open match details`}
      className="block min-h-11 px-3 py-3 sm:px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sffl-red/50"
    >
      {showRound && (
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {matchRound(m)} <span aria-hidden="true">&middot;</span> {formatMatchDate(m.kickoff_at)}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {m.home && <Crest club={m.home} size="sm" />}
          <span className="truncate font-bold text-sffl-navy dark:text-white">{homeName}</span>
        </div>
        <div className="text-center min-w-16">
          {played ? (
            <p className="tabular text-xl font-black text-sffl-navy dark:text-white">
              {m.home_score} <span className="text-gray-400">:</span> {m.away_score}
            </p>
          ) : (
            <p className="tabular text-sm font-extrabold text-sffl-navy dark:text-white">{m.status === 'postponed' ? 'PP' : formatKickoffTime(m.kickoff_at)}</p>
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {m.status === 'forfeit' ? 'Forfeit' : played ? 'Full time' : m.status === 'postponed' ? 'Postponed' : 'WAT'}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right font-bold text-sffl-navy dark:text-white">{awayName}</span>
          {m.away && <Crest club={m.away} size="sm" />}
        </div>
      </div>
      {pens && <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">{pens} won on penalties</p>}
    </Link>
  );
};
