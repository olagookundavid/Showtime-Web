import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, type Match } from '../../services/api';
import { Spinner } from '../ui';

/**
 * Knockout bracket for a KNOCKOUT-format competition.
 *
 * The tree is derived purely from feeds_match_id pointers: a match with no
 * pointer is the final (the Bowl); every other match sits one column to the
 * left of the match it feeds. Round labels are display-only. TBD slots render
 * until the feeder match finishes and auto-advance fills them in.
 */

interface BracketViewProps {
    competitionId: string;
    /** Compact mode: vertical round-by-round list (used in the MatchHub sidebar). */
    compact?: boolean;
    viewAllLink?: string;
}

export interface BracketColumn {
    title: string;
    matches: Match[];
}

export const winnerSide = (m: Match): 'HOME' | 'AWAY' | null => {
    if (m.status !== 'FINISHED' || m.home_score == null || m.away_score == null) return null;
    if (m.home_score > m.away_score) return 'HOME';
    if (m.away_score > m.home_score) return 'AWAY';
    return null;
};

export const buildBracketColumns = (matches: Match[]): BracketColumn[] => {
    if (matches.length === 0) return [];
    const byId = new Map(matches.map(m => [m.id, m]));

    // Depth = hops from this match to the final. Cycle-guarded.
    const depthCache = new Map<string, number>();
    const depthOf = (m: Match, seen: Set<string>): number => {
        const cached = depthCache.get(m.id);
        if (cached !== undefined) return cached;
        let d = 0;
        if (m.feeds_match_id && byId.has(m.feeds_match_id) && !seen.has(m.id)) {
            seen.add(m.id);
            d = 1 + depthOf(byId.get(m.feeds_match_id)!, seen);
        }
        depthCache.set(m.id, d);
        return d;
    };

    const maxDepth = Math.max(...matches.map(m => depthOf(m, new Set())));
    const cols: Match[][] = Array.from({ length: maxDepth + 1 }, () => []);
    matches.forEach(m => {
        cols[maxDepth - depthOf(m, new Set())].push(m);
    });

    return cols
        .filter(col => col.length > 0)
        .map((col, i, arr) => {
            col.sort((a, b) => (a.bracket_pos ?? 999) - (b.bracket_pos ?? 999) || a.date.localeCompare(b.date));
            // Use the admin's round label when the column agrees on one.
            const labels = [...new Set(col.map(m => m.round).filter(Boolean))];
            const title = labels.length === 1
                ? labels[0]!
                : i === arr.length - 1 ? 'Final' : `Round ${i + 1}`;
            return { title, matches: col };
        });
};

const TeamRow = ({ m, side }: { m: Match; side: 'HOME' | 'AWAY' }) => {
    const team = side === 'HOME' ? m.home_team : m.away_team;
    const score = side === 'HOME' ? m.home_score : m.away_score;
    const winner = winnerSide(m);
    const finished = winner !== null;
    const isWinner = winner === side;
    const isTbd = !team?.id;

    return (
        <div className={`flex items-center gap-2 px-3 py-2 ${finished && !isWinner ? 'opacity-50' : ''}`}>
            {team?.logo ? (
                <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain shrink-0" />
            ) : (
                <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-black text-gray-500 dark:text-gray-400 shrink-0">
                    {isTbd ? '?' : (team.short_name || team.name.substring(0, 2)).toUpperCase().substring(0, 3)}
                </div>
            )}
            <span className={`text-xs truncate flex-1 ${isTbd ? 'text-gray-400 dark:text-gray-500 italic font-semibold' : isWinner ? 'font-black text-sffl-navy dark:text-white' : 'font-bold text-gray-700 dark:text-gray-300'}`}>
                {isTbd ? 'TBD' : team.name.toUpperCase()}
            </span>
            <span className={`text-sm tabular-nums ${isWinner ? 'font-black text-sffl-red' : 'font-bold text-gray-500 dark:text-gray-400'}`}>
                {m.status === 'FINISHED' || m.status === 'LIVE' ? score ?? '' : ''}
            </span>
        </div>
    );
};

// championOf finds the decided winner of the bracket: the team that won the
// terminal match (the Bowl). Undefined until the final is FINISHED.
export const championOf = (matches: Match[]): Match['home_team'] | undefined => {
    const finals = matches.filter(m => !m.feeds_match_id);
    if (finals.length !== 1) return undefined;
    const side = winnerSide(finals[0]);
    if (!side) return undefined;
    return side === 'HOME' ? finals[0].home_team : finals[0].away_team;
};

/** Gold champion card shown to the right of the Bowl once it has been won. */
export const ChampionCard = ({ team, compact = false }: { team: NonNullable<Match['home_team']>; compact?: boolean }) => {
    if (compact) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950">
                <span className="text-2xl drop-shadow">👑</span>
                {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-9 h-9 object-contain drop-shadow" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-amber-950/10 flex items-center justify-center text-[10px] font-black">
                        {(team.short_name || team.name.substring(0, 3)).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Champion</div>
                    <div className="font-black text-sm uppercase truncate">{team.name}</div>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col w-56 md:w-64">
            <div className="text-center text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-md">
                Champion
            </div>
            <div className="flex flex-col justify-center items-center flex-1 gap-3 rounded-xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-amber-900/10 shadow-lg p-6 text-center">
                <div className="text-5xl drop-shadow-md animate-bounce">👑</div>
                {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-lg" />
                ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-2xl font-black text-amber-900 dark:text-amber-200">
                        {(team.short_name || team.name.substring(0, 3)).toUpperCase()}
                    </div>
                )}
                <div className="font-black text-base md:text-lg uppercase tracking-tight text-amber-900 dark:text-amber-200 leading-tight">
                    {team.name}
                </div>
                <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
                    🏆 Winner 🏆
                </div>
            </div>
        </div>
    );
};

const MatchCard = ({ m, isFinal }: { m: Match; isFinal: boolean }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden w-full ${isFinal ? 'border-sffl-red/40 ring-1 ring-sffl-red/20' : 'border-gray-100 dark:border-gray-700'}`}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-widest ${m.status === 'LIVE' ? 'text-red-500 animate-pulse' : m.status === 'FINISHED' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {m.status === 'FINISHED' ? 'FT' : m.status}
            </span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            <TeamRow m={m} side="HOME" />
            <TeamRow m={m} side="AWAY" />
        </div>
    </div>
);

export const BracketView = ({ competitionId, compact = false, viewAllLink }: BracketViewProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['bracketMatches', competitionId],
        queryFn: () => getMatches(competitionId, 1, 100),
        enabled: !!competitionId,
    });

    const columns = useMemo(() => buildBracketColumns(data?.data || []), [data]);
    const champion = useMemo(() => championOf(data?.data || []), [data]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
                <Spinner label="Loading bracket…" className="py-12" />
            </div>
        );
    }

    if (columns.length === 0) {
        return (
            <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-xl text-center">
                <div className="text-4xl mb-3">🏈</div>
                <p className="text-gray-500 font-semibold">The bracket hasn't been set yet.</p>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-sffl-navy text-white">
                    <h3 className="text-sm font-black uppercase tracking-wider">Playoff Bracket</h3>
                    {viewAllLink && (
                        <Link to={viewAllLink} className="text-[10px] font-black uppercase tracking-wider text-sffl-red hover:underline">
                            Full Bracket →
                        </Link>
                    )}
                </div>
                {champion && <ChampionCard team={champion} compact />}
                <div className="p-3 space-y-4">
                    {columns.map(col => (
                        <div key={col.title}>
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">{col.title}</div>
                            <div className="space-y-2">
                                {col.matches.map(m => <MatchCard key={m.id} m={m} isFinal={!m.feeds_match_id && col === columns[columns.length - 1]} />)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="md:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
                Swipe to follow the road to the Bowl →
            </div>
            <div className="overflow-x-auto pb-4 -mx-2 px-2">
                <div className="flex gap-4 md:gap-8 min-w-max items-stretch">
                    {columns.map((col, i) => {
                        const isLast = i === columns.length - 1;
                        return (
                            <div key={col.title} className="flex flex-col w-56 md:w-64">
                                <div className={`text-center text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 rounded-lg ${isLast ? 'bg-sffl-red text-white' : 'bg-sffl-navy text-white'}`}>
                                    {isLast ? `🏆 ${col.title}` : col.title}
                                </div>
                                {/* justify-around spreads matches so later rounds sit between their feeders */}
                                <div className="flex flex-col justify-around flex-1 gap-3">
                                    {col.matches.map(m => <MatchCard key={m.id} m={m} isFinal={isLast} />)}
                                </div>
                            </div>
                        );
                    })}
                    {champion && <ChampionCard team={champion} />}
                </div>
            </div>
        </div>
    );
};
