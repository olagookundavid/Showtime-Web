import { CheckCircleIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { MyPlayerTicket } from '../../types';

// Game days are dated in Lagos time, so "today" is too.
const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

/** What the ticket is worth to the player right now. */
const statusOf = (t: MyPlayerTicket) => {
    if (t.checked_in_at) return 'in' as const;
    if (t.match.date < lagosToday()) return 'past' as const;
    return 'ready' as const;
};

/** A player's own ticket for one match: the code to show at the gate. */
export const PlayerGameDayTicket = ({ ticket }: { ticket: MyPlayerTicket }) => {
    const status = statusOf(ticket);
    const { match } = ticket;
    const today = match.date === lagosToday();

    return (
        <article
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow border overflow-hidden ${
                status === 'ready' ? 'border-sffl-red/40' : 'border-gray-100 dark:border-gray-700'
            }`}
        >
            <div className="p-4 sm:p-5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white wrap-break-word min-w-0">
                        {ticket.team_name} <span className="font-normal text-gray-500 dark:text-gray-400">vs {ticket.opponent || 'TBD'}</span>
                    </h2>
                    {status === 'in' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                            <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                            Checked in at {formatTime(ticket.checked_in_at as string)}
                        </span>
                    ) : status === 'past' ? (
                        <span className="rounded-md bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            Match played
                        </span>
                    ) : (
                        <span className="rounded-md bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 text-xs font-bold text-yellow-800 dark:text-yellow-400 whitespace-nowrap">
                            {today ? 'Match day' : 'Upcoming'}
                        </span>
                    )}
                </div>
                {match.competition && <p className="text-sm text-gray-500 dark:text-gray-400">{match.competition}</p>}
                <p className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300 pt-1">
                    <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="w-4 h-4" aria-hidden="true" />
                        {formatDate(match.date)}
                        {match.kickoff ? ` · ${match.kickoff}` : ''}
                    </span>
                    {match.venue && (
                        <span className="inline-flex items-center gap-1.5">
                            <MapPinIcon className="w-4 h-4" aria-hidden="true" />
                            {match.venue}
                        </span>
                    )}
                </p>
            </div>

            <div
                className={`px-4 py-5 sm:py-6 text-center ${
                    status === 'ready' ? 'bg-sffl-navy text-white' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white'
                }`}
            >
                <p
                    className={`text-xs font-bold uppercase tracking-widest mb-2 ${
                        status === 'ready' ? 'text-sffl-red' : 'text-gray-500 dark:text-gray-400'
                    }`}
                >
                    Your ticket code
                </p>
                <p className="font-mono text-2xl sm:text-4xl font-extrabold tracking-widest break-all">{ticket.ticket_code}</p>
                {status === 'ready' && (
                    <p className="mt-2 text-sm text-gray-300">Show this code at the entrance. It admits you only, for this match.</p>
                )}
            </div>
        </article>
    );
};
