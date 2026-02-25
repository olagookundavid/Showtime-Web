import React from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../../services/api';
import { generateGoogleCalendarLink } from '../../utils/calendarUtils';

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

    const formatTime = (timeString: string) => {
        // timeString might be full timestamp or just time. 
        // Logic: new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 dark:border-gray-700 group"
        >
            {/* Header: Date/Time or Status */}
            <div className={`p-3 text-center text-sm font-bold uppercase tracking-wider ${isLive ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {isLive ? 'LIVE NOW' : isFinished ? 'Final Score' : `${formatDate(match.date)} • ${formatTime(match.start_time)}`}
            </div>

            {/* Teams & Score */}
            <div className="p-6 flex justify-between items-center">
                {/* Home Team */}
                <div className="flex flex-col items-center w-1/3">
                    <img src={match.home_team?.logo || 'https://via.placeholder.com/60'} alt={match.home_team?.name} className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-center font-bold text-sffl-navy dark:text-white leading-tight">{match.home_team?.short_name || match.home_team?.name || 'Home'}</span>
                </div>

                {/* Score vs VS */}
                <div className="flex flex-col items-center w-1/3">
                    {isFinished || isLive ? (
                        <div className="text-4xl font-black text-sffl-navy dark:text-white">
                            {match.home_score} - {match.away_score}
                        </div>
                    ) : (
                        <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">VS</div>
                    )}
                    <span className="text-xs text-gray-500 mt-2 text-center uppercase">{match.venue}</span>
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center w-1/3">
                    <img src={match.away_team?.logo || 'https://via.placeholder.com/60'} alt={match.away_team?.name} className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-center font-bold text-sffl-navy dark:text-white leading-tight">{match.away_team?.short_name || match.away_team?.name || 'Away'}</span>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-center space-x-3 bg-gray-50 dark:bg-gray-700/50">
                {isFinished ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (match.highlights_url) window.open(match.highlights_url, '_blank', 'noopener,noreferrer');
                        }}
                        className="px-4 py-2 bg-sffl-red text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors w-full"
                    >
                        Watch Highlights
                    </button>
                ) : (
                    <>
                        <Link
                            to={`/tickets?date=${match.date.split('T')[0]}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-4 py-2 bg-sffl-navy text-white text-sm font-bold rounded-lg hover:bg-blue-900 transition-colors w-full text-center block"
                        >
                            🎟️ Get Tickets
                        </Link>
                        <button
                            className="px-4 py-2 bg-white text-sffl-navy border border-gray-300 text-sm font-bold rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 transition-colors w-full"
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
        </div>
    );
};
