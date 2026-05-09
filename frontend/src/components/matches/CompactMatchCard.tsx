import React from 'react';
import type { Match } from '../../services/api';
import { LightboxImage } from '../ui';

interface CompactMatchCardProps {
    match: Match;
    onClick?: () => void;
    hideHeaderAndVenue?: boolean;
}

export const CompactMatchCard: React.FC<CompactMatchCardProps> = ({ match, onClick, hideHeaderAndVenue = false }) => {
    const isFinished = match.status === 'FINISHED';
    const isLive = match.status === 'LIVE';

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const formatTime = (timeString: string, dateString?: string) => {
        if (!timeString || timeString.includes('T00:00:00') || timeString === '00:00:00') return 'TBD';
        
        let validDateString = timeString;
        if (dateString && !timeString.includes('T') && !timeString.includes('-')) {
            const datePart = dateString.split('T')[0];
            validDateString = `${datePart}T${timeString}Z`;
        }
        return new Date(validDateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            onClick={onClick}
            className="flex-none w-[260px] md:w-[280px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer group snap-center"
        >
            {/* Header */}
            {!hideHeaderAndVenue && (
                <div className={`py-2 px-4 text-center text-[10px] font-black uppercase tracking-widest ${isLive ? 'bg-sffl-red text-white animate-pulse' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                    {isLive ? 'LIVE NOW' : isFinished ? 'Final Result' : `${formatDate(match.date)} • ${formatTime(match.start_time, match.date)}`}
                </div>
            )}

            {/* Content */}
            <div className="p-4 flex items-center justify-between gap-3">
                {/* Home Team */}
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <LightboxImage 
                        src={match.home_team?.logo || ''} 
                        alt={match.home_team?.name} 
                        thumbnailClassName="w-10 h-10 md:w-12 md:h-12 rounded-md object-contain bg-gray-50 dark:bg-gray-900/50 p-1"
                    />
                    <span className="text-[10px] md:text-xs font-bold text-sffl-navy dark:text-white truncate pb-1 uppercase">
                        {match.home_team?.short_name || match.home_team?.name || 'Home'}
                    </span>
                </div>

                {/* Score vs VS */}
                <div className="flex flex-col items-center justify-center px-2">
                    {isFinished || isLive ? (
                        <div className="text-xl md:text-2xl font-black text-sffl-navy dark:text-white italic tracking-tighter">
                            {match.home_score} - {match.away_score}
                        </div>
                    ) : (
                        <div className="text-lg font-black text-gray-300 dark:text-gray-600 italic">VS</div>
                    )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <LightboxImage 
                        src={match.away_team?.logo || ''} 
                        alt={match.away_team?.name} 
                        thumbnailClassName="w-10 h-10 md:w-12 md:h-12 rounded-md object-contain bg-gray-50 dark:bg-gray-900/50 p-1"
                    />
                    <span className="text-[10px] md:text-xs font-bold text-sffl-navy dark:text-white truncate pb-1 uppercase">
                        {match.away_team?.short_name || match.away_team?.name || 'Away'}
                    </span>
                </div>
            </div>
            
            {/* Tiny Venue badge */}
            {!hideHeaderAndVenue && (
                <div className="px-4 pb-2 text-center">
                    <span className="text-[8px] uppercase text-gray-400 dark:text-gray-500 font-bold tracking-tighter">
                        🏟️ {match.venue || 'Main Stadium'}
                    </span>
                </div>
            )}
        </div>
    );
};
