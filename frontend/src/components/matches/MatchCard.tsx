import React from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../../services/api';
import { generateGoogleCalendarLink } from '../../utils/calendarUtils';
import { LightboxImage } from '../ui';

interface MatchCardProps {
    match: Match;
    onClick: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onClick }) => {
    const isFinished = match.status === 'FINISHED';
    const isLive = match.status === 'LIVE';

    const formatDate = (dateString: string) => {
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const formatTime = (timeString: string, dateString?: string) => {
        if (!timeString || timeString.includes('T00:00:00') || timeString === '00:00:00' || timeString === '00:00') return 'TBD';

        // timeString might be full timestamp or just time.
        // If it's just a time like '15:00:00', combine it with the date to make it valid for Date constructor
        let validDateString = timeString;
        
        if (dateString && timeString && !timeString.includes('T') && !timeString.includes('-')) {
            const datePart = dateString.split('T')[0];
            validDateString = `${datePart}T${timeString}Z`;
        }

        return new Date(validDateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 dark:border-gray-700 group"
        >
            {/* Header: Date/Time or Status */}
            <div className={`p-2.5 md:p-3 text-center text-[10px] md:text-sm font-bold uppercase tracking-wider ${isLive ? 'bg-sffl-red text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white'}`}>
                {match.round && <span className="mr-2 px-1.5 py-0.5 rounded bg-sffl-navy/80 text-white text-[9px] md:text-xs">{match.round}</span>}
                {isLive ? 'LIVE NOW' : isFinished ? 'Final Score' : `${formatDate(match.date)} • ${formatTime(match.start_time, match.date)}`}
            </div>

            {/* Teams & Score - Condensed for Density */}
            <div className="p-2 md:p-6 flex items-center w-full gap-2">
                {/* Home Team */}
                <div className="flex items-center gap-1.5 w-1/3">
                    <LightboxImage
                        src={match.home_team?.logo || 'https://via.placeholder.com/60'}
                        alt={match.home_team?.name}
                        thumbnailClassName="w-6 h-6 md:w-16 md:h-16 object-contain rounded-md"
                    />
                    {match.home_team?.id ? (
                        <Link
                            to={`/teams/${match.home_team.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-[10px] md:text-sm text-sffl-navy dark:text-white leading-tight truncate uppercase hover:text-sffl-red transition-colors"
                        >
                            {match.home_team?.short_name || match.home_team?.name}
                        </Link>
                    ) : (
                        <span className="font-bold text-[10px] md:text-sm text-gray-400 dark:text-gray-500 italic leading-tight truncate uppercase">TBD</span>
                    )}
                </div>

                {/* Score vs VS */}
                <div className="flex flex-col items-center justify-center w-1/3">
                    {isFinished || isLive ? (
                        <div className="text-base md:text-4xl font-black text-sffl-navy dark:text-white whitespace-nowrap">
                            {match.home_score} - {match.away_score}
                        </div>
                    ) : (
                        <div className="text-sm md:text-2xl font-bold text-gray-400 dark:text-gray-300">VS</div>
                    )}
                    <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-300 uppercase leading-none truncate max-w-full">{match.venue}</span>
                </div>

                {/* Away Team */}
                <div className="flex items-center justify-end gap-1.5 w-1/3 text-right">
                    {match.away_team?.id ? (
                        <Link
                            to={`/teams/${match.away_team.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-[10px] md:text-sm text-sffl-navy dark:text-white leading-tight truncate uppercase hover:text-sffl-red transition-colors"
                        >
                            {match.away_team?.short_name || match.away_team?.name}
                        </Link>
                    ) : (
                        <span className="font-bold text-[10px] md:text-sm text-gray-400 dark:text-gray-500 italic leading-tight truncate uppercase">TBD</span>
                    )}
                    <LightboxImage
                        src={match.away_team?.logo || 'https://via.placeholder.com/60'}
                        alt={match.away_team?.name}
                        thumbnailClassName="w-6 h-6 md:w-16 md:h-16 object-contain rounded-md"
                    />
                </div>
            </div>

            {/* Footer Actions - Compact */}
            {(!isFinished || (isFinished && match.highlights_url)) && (
                <div className="p-2 md:p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-center gap-1.5 md:gap-3 bg-gray-50 dark:bg-gray-700/50">
                    {isFinished ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (match.highlights_url) window.open(match.highlights_url, '_blank', 'noopener,noreferrer');
                            }}
                            className="px-3 py-1.5 bg-sffl-red text-white text-[10px] md:text-sm font-bold flex items-center justify-center min-h-[36px] md:min-h-[44px] rounded-lg hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 w-full"
                        >
                            Highlights
                        </button>
                    ) : (
                        <>
                            <Link
                                to={`/tickets?date=${match.date.split('T')[0]}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 bg-sffl-navy text-white text-[10px] md:text-sm font-bold flex items-center justify-center min-h-[36px] md:min-h-[44px] rounded-lg hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 w-full block"
                            >
                                🎟️ Tickets
                            </Link>
                            <button
                                className="px-3 py-1.5 bg-white text-sffl-navy border border-gray-300 text-[10px] md:text-sm font-bold flex items-center justify-center min-h-[36px] md:min-h-[44px] rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 w-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const link = generateGoogleCalendarLink(match);
                                    window.open(link, '_blank', 'noopener,noreferrer');
                                }}
                            >
                                + Calendar
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
