import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, type Match } from '../../services/api';
import { Spinner } from '../ui';
import { MatchCard } from './BracketView';

interface CompactMatchesWidgetProps {
    competitionId: string;
    title?: string;
    viewAllLink?: string;
}

/**
 * Compact matches list widget used in MatchHub sidebar and Standings page for
 * PRESEASON and CUP competitions where no league table/standings exist.
 * Displays matches with their latest scores, ordered with the last match first (newest to oldest),
 * without any playoff stages or wildcard markers.
 */
export const CompactMatchesWidget = ({
    competitionId,
    title = 'Matches',
    viewAllLink,
}: CompactMatchesWidgetProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['compactMatchesWidget', competitionId],
        queryFn: () => getMatches(competitionId, 1, 100),
        enabled: !!competitionId,
    });

    const allMatches = useMemo(() => data?.data || [], [data]);

    // Order matches latest first (date DESC, time DESC)
    const sortedMatches = useMemo(() => {
        return [...allMatches].sort((a: Match, b: Match) => {
            const d = b.date.localeCompare(a.date);
            if (d !== 0) return d;
            return (b.start_time || '').localeCompare(a.start_time || '');
        });
    }, [allMatches]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-sffl-navy text-white">
                    <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
                </div>
                <div className="py-12 flex justify-center">
                    <Spinner label="Loading matches…" />
                </div>
            </div>
        );
    }

    if (sortedMatches.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-sffl-navy text-white">
                    <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
                </div>
                <div className="p-8 text-center text-gray-400 text-xs font-semibold">
                    No matches scheduled yet.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-sffl-navy text-white">
                <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-300">
                        {sortedMatches.length} {sortedMatches.length === 1 ? 'Game' : 'Games'}
                    </span>
                    {viewAllLink && (
                        <Link to={viewAllLink} className="text-[10px] font-black uppercase tracking-wider text-sffl-red hover:underline">
                            View All →
                        </Link>
                    )}
                </div>
            </div>
            <div className="p-3 space-y-2 max-h-[620px] overflow-y-auto custom-scrollbar">
                {sortedMatches.map(m => (
                    <MatchCard
                        key={m.id}
                        m={m}
                        isFinal={false}
                    />
                ))}
            </div>
        </div>
    );
};
