import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, type Match } from '../../services/api';
import { Spinner } from '../ui';

/**
 * Knockout bracket for a KNOCKOUT-format competition.
 *
 * Columns are ordered by each match's STAGE tag (Wildcard → Quarter-Finals →
 * Semi-Finals → Bowl) — the admin tags every playoff match with its stage, so
 * the bracket arranges itself without needing advancement wiring. This also
 * lets a single stage hold several matches (e.g. two-legged semifinals).
 * Where no stage tags exist (older / wizard brackets), we fall back to the
 * feeds_match_id pointer depth.
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

// The fixed knockout stages, in playing order. `value` is what's stored in the
// match's `round`; `label` is what the admin picks in the form.
export const KNOCKOUT_STAGES = [
    { value: 'Wildcard', label: 'Wildcard' },
    { value: 'Playoff 1', label: 'Playoffs 1' },
    { value: 'Playoff 2', label: 'Playoffs 2' },
    { value: 'Bowl', label: 'Bowl — Final' },
] as const;

// Friendly column titles per stage rank.
const STAGE_TITLES = ['Wildcard', 'Playoffs 1', 'Playoffs 2', 'Bowl'];
const UNKNOWN_RANK = 99;

// Rank a round/stage label robustly — recognises the manual stage values, the
// wizard's "Playoff 1/2" labels, and common synonyms. Order of checks matters:
// "Quarter-Final"/"Semi-Final" contain "final", so they must be tested before
// the bowl/final check.
export const stageRank = (round?: string): number => {
    const r = (round || '').toLowerCase();
    if (!r) return UNKNOWN_RANK;
    if (r.includes('wild')) return 0;
    if (r.includes('quarter') || r.includes('playoff 1') || r.includes('playoffs 1')) return 1;
    if (r.includes('semi') || r.includes('playoff 2') || r.includes('playoffs 2')) return 2;
    if (r.includes('bowl') || r.includes('final')) return 3;
    return UNKNOWN_RANK;
};

export const isBowlStage = (round?: string): boolean => stageRank(round) === 3;

export const winnerSide = (m: Match): 'HOME' | 'AWAY' | null => {
    if (m.status !== 'FINISHED' || m.home_score == null || m.away_score == null) return null;
    if (m.home_score > m.away_score) return 'HOME';
    if (m.away_score > m.home_score) return 'AWAY';
    return null;
};

export const buildBracketColumns = (matches: Match[]): BracketColumn[] => {
    if (matches.length === 0) return [];

    const sortCol = (col: Match[]) =>
        col.sort((a, b) => (a.bracket_pos ?? 999) - (b.bracket_pos ?? 999) || a.date.localeCompare(b.date));

    // Primary path: order by stage tag when any match carries a recognised one.
    const anyStaged = matches.some(m => stageRank(m.round) !== UNKNOWN_RANK);
    if (anyStaged) {
        const groups = new Map<number, Match[]>();
        matches.forEach(m => {
            const rank = stageRank(m.round);
            if (!groups.has(rank)) groups.set(rank, []);
            groups.get(rank)!.push(m);
        });
        return [...groups.keys()]
            .sort((a, b) => a - b)
            .map(rank => ({
                title: rank === UNKNOWN_RANK ? 'Other' : STAGE_TITLES[rank],
                matches: sortCol(groups.get(rank)!),
            }));
    }

    // Fallback: derive columns from feeds_match_id pointer depth (hops to final).
    const byId = new Map(matches.map(m => [m.id, m]));
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
    matches.forEach(m => { cols[maxDepth - depthOf(m, new Set())].push(m); });

    return cols
        .filter(col => col.length > 0)
        .map((col, i, arr) => {
            sortCol(col);
            const labels = [...new Set(col.map(m => m.round).filter(Boolean))];
            const title = labels.length === 1 ? labels[0]! : i === arr.length - 1 ? 'Final' : `Round ${i + 1}`;
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
// Bowl (the final). Prefers the match tagged with the Bowl stage; falls back to
// the lone match that advances nowhere. Undefined until the final is FINISHED.
export const championOf = (matches: Match[]): Match['home_team'] | undefined => {
    const bowls = matches.filter(m => isBowlStage(m.round));
    let final: Match | undefined;
    if (bowls.length === 1) {
        final = bowls[0];
    } else if (bowls.length === 0) {
        const noFeed = matches.filter(m => !m.feeds_match_id);
        if (noFeed.length === 1) final = noFeed[0];
    }
    if (!final) return undefined;
    const side = winnerSide(final);
    if (!side) return undefined;
    return side === 'HOME' ? final.home_team : final.away_team;
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
