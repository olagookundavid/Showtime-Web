import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, getMatchPlays, type GamePlay } from '../../services/api';

const who = (p?: { name: string; jersey_number: number }) => (p ? (p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name) : '');

// Friendly labels for the codes that matter to a reader. Screen / Hail Mary /
// Sweep / Reverse are retired play types — no longer enterable — so they're not
// listed here; any legacy row falls back to showing its raw code.
const PLAY_LABEL: Record<string, string> = {
    CP: 'Complete pass', INC: 'Incomplete', TDP: 'TD pass',
    TA: 'Thrown away', RUN: 'Run', QBR: 'QB run',
    SACK: 'Sack', INT: 'Interception', PUNT: 'Punt', KO: 'Throw-off',
    'XP-P': '2-pt pass', 'PAT-R': 'Extra point', SAF: 'Safety',
};
const RESULT_LABEL: Record<string, string> = {
    '1D': 'First down', '1DG': 'First & goal', TD: 'TOUCHDOWN', XP: 'Extra point good',
    XPF: 'Extra point failed', TO: 'Turnover on downs', INT: 'Intercepted', OB: 'Out of bounds',
    FG: 'Flag pull', DB: 'Dead ball', IH: 'Injury', EH: 'End of half', EG: 'End of game', SAF: 'SAFETY',
    INC: 'Incomplete',
};

const isScore = (p: GamePlay) => p.result === 'TD' || p.result === 'XP' || p.result === 'SAF';
const isInterception = (p: GamePlay) => p.result === 'INT' || p.play_type === 'INT';

function describe(p: GamePlay): string {
    if (p.penalty && !p.play_type) {
        return `Penalty — ${p.penalty}${p.penalty_player ? ' on ' + who(p.penalty_player) : ''}${p.penalty_yards != null ? ` (${p.penalty_yards} yd)` : ''}`;
    }
    // Injury event: the affected player is stored in off_qb. Show their name so
    // the timeline reads e.g. "#7 Jane Doe · [Injury]" instead of a bare label.
    if (p.result === 'IH' && !p.play_type) {
        return p.off_qb ? who(p.off_qb) : '';
    }
    const parts: string[] = [];
    if (p.off_qb) parts.push(who(p.off_qb));
    if (p.target) parts.push(`→ ${who(p.target)}`);
    if (p.batted_down) {
        const batter = p.rusher || p.defender;
        parts.push(`— batted down${batter ? ` by ${who(batter)}` : ''}`);
    } else if (p.defender) {
        parts.push(`(${who(p.defender)})`);
    }
    return parts.join(' ');
}

const formatDown = (p: GamePlay): string => {
    if (!p.down) return '';
    return `Down: ${p.down}`;
};

export const PlayByPlayTimeline = ({ matchId, isLive, showEmpty = false }: { matchId: string; isLive: boolean; showEmpty?: boolean }) => {
    const queryClient = useQueryClient();

    const { data: plays = [] } = useQuery({
        queryKey: ['publicMatchPlays', matchId],
        queryFn: () => getMatchPlays(matchId),
        enabled: !!matchId,
        refetchInterval: isLive ? 30000 : false, // 30s fallback poll when live, SSE handles instant updates
    });

    useEffect(() => {
        if (!isLive || !matchId) return;

        const streamUrl = `${API_URL}/matches/${matchId}/plays/stream`;
        const es = new EventSource(streamUrl);

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['publicMatchPlays', matchId] });
        };

        es.addEventListener('play_added', invalidate);
        es.addEventListener('play_updated', invalidate);
        es.addEventListener('play_deleted', invalidate);
        es.addEventListener('score_updated', invalidate);

        return () => {
            es.close();
        };
    }, [matchId, isLive, queryClient]);

    if (plays.length === 0) {
        // In a tab we show a friendly empty state; inline (stacked) usage stays invisible.
        if (!showEmpty) return null;
        return (
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 py-14 text-center">
                <div className="text-4xl mb-4">🏈</div>
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">No play-by-play logged for this match yet.</p>
            </div>
        );
    }

    // Group consecutive plays into drives (sequential by drive_no, no team aggregation)
    const drives: { key: number; plays: GamePlay[] }[] = [];
    plays.forEach(p => {
        const last = drives[drives.length - 1];
        if (!last || last.key !== p.drive_no) {
            drives.push({ key: p.drive_no, plays: [p] });
        } else {
            last.plays.push(p);
        }
    });

    return (
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                <h3 className="text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Play by Play</h3>
                {isLive && <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-500"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE</span>}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {drives.map((drive, di) => (
                    <div key={di} className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sffl-red">Drive {drive.key}</span>
                        </div>
                        <ol className="space-y-1.5">
                            {drive.plays.map(p => {
                                const scored = isScore(p);
                                const intercepted = isInterception(p);
                                return (
                                    <li key={p.id} className={`flex items-start gap-2.5 sm:gap-3 rounded-xl p-2.5 transition-colors ${
                                        scored
                                            ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40'
                                            : intercepted
                                                ? 'bg-red-50/90 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40'
                                                : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/40'
                                    }`}>
                                        <div className="flex flex-col items-start gap-1 shrink-0 w-20 sm:w-24 pt-0.5">
                                            <span className="text-[11px] font-bold text-gray-400 tabular-nums">
                                                Q{p.quarter}{p.clock ? ` ${p.clock}` : ''}
                                            </span>
                                            {formatDown(p) && (
                                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-black rounded-md bg-sffl-navy/10 text-sffl-navy dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-tight tabular-nums">
                                                    {formatDown(p)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="text-xs sm:text-sm text-gray-800 dark:text-gray-100">
                                                {p.play_type && <span className="font-bold text-sffl-navy dark:text-white">{PLAY_LABEL[p.play_type] || p.play_type}: </span>}
                                                {describe(p)}
                                            </span>
                                            {p.result && (
                                                <span className={`ml-1.5 text-xs font-bold ${
                                                    scored
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : intercepted
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-gray-400'
                                                }`}>
                                                    · [{RESULT_LABEL[p.result] || p.result}]
                                                </span>
                                            )}
                                            {p.penalty && p.play_type && (
                                                <span className="ml-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">⚑ {p.penalty}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                            {p.yards != null && (p.play_type === 'CP' || p.play_type === 'TDP' || p.play_type === 'RUN' || p.play_type === 'QBR' || p.play_type === 'SACK') && (
                                                <span className="text-[11px] font-mono font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/80 px-1.5 py-0.5 rounded">
                                                    {p.yards >= 0 ? '+' : ''}{p.yards} yd
                                                </span>
                                            )}
                                            {(p.home_score_after != null && p.away_score_after != null) && (
                                                <span className="text-xs font-black text-sffl-navy dark:text-gray-300 tabular-nums">
                                                    {p.home_score_after}–{p.away_score_after}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                ))}
            </div>
        </div>
    );
};
