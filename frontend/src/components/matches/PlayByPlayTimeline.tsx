import { useQuery } from '@tanstack/react-query';
import { getMatchPlays, type GamePlay } from '../../services/api';

const who = (p?: { name: string; jersey_number: number }) => (p ? (p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name) : '');

// Friendly labels for the codes that matter to a reader.
const PLAY_LABEL: Record<string, string> = {
    CP: 'Complete pass', INC: 'Incomplete', TDP: 'TD pass', SCR: 'Screen', HM: 'Hail Mary',
    TA: 'Thrown away', RUN: 'Run', QBR: 'QB run', SWP: 'Sweep', REV: 'Reverse',
    SACK: 'Sack', INT: 'Interception', PUNT: 'Punt', KO: 'Throw-off',
    'XP-P': '2-pt pass', 'PAT-R': 'Extra point', SAF: 'Safety',
};
const RESULT_LABEL: Record<string, string> = {
    '1D': 'First down', '1DG': 'First & goal', TD: 'TOUCHDOWN', XP: 'Extra point good',
    XPF: 'Extra point failed', TO: 'Turnover on downs', INT: 'Intercepted', OB: 'Out of bounds',
    FG: 'Flag pull', DB: 'Dead ball', IH: 'Injury', EH: 'End of half', EG: 'End of game', SAF: 'SAFETY',
};

const isScore = (p: GamePlay) => p.result === 'TD' || p.result === 'XP' || p.result === 'SAF';

function describe(p: GamePlay): string {
    if (p.penalty && !p.play_type) {
        return `Penalty — ${p.penalty}${p.penalty_player ? ' on ' + who(p.penalty_player) : ''}${p.penalty_yards != null ? ` (${p.penalty_yards} yd)` : ''}`;
    }
    const parts: string[] = [];
    if (p.off_qb) parts.push(who(p.off_qb));
    if (p.target) parts.push(`→ ${who(p.target)}`);
    if (p.yards != null && (p.play_type === 'CP' || p.play_type === 'SCR' || p.play_type === 'TDP' || p.play_type === 'RUN' || p.play_type === 'QBR' || p.play_type === 'SWP' || p.play_type === 'REV' || p.play_type === 'SACK')) {
        parts.push(`${p.yards >= 0 ? '+' : ''}${p.yards} yd`);
    }
    if (p.defender) parts.push(`(${who(p.defender)})`);
    return parts.join(' ');
}

export const PlayByPlayTimeline = ({ matchId, isLive, showEmpty = false }: { matchId: string; isLive: boolean; showEmpty?: boolean }) => {
    const { data: plays = [] } = useQuery({
        queryKey: ['publicMatchPlays', matchId],
        queryFn: () => getMatchPlays(matchId),
        enabled: !!matchId,
        refetchInterval: isLive ? 8000 : false,
    });

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

    // Group consecutive plays into drives.
    const drives: { key: number; team?: string; plays: GamePlay[] }[] = [];
    plays.forEach(p => {
        const last = drives[drives.length - 1];
        if (!last || last.key !== p.drive_no) {
            drives.push({ key: p.drive_no, team: p.offense_team?.short_name || p.offense_team?.name, plays: [p] });
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
                            {drive.team && <span className="text-xs font-bold text-gray-500 dark:text-gray-400">· {drive.team}</span>}
                        </div>
                        <ol className="space-y-1.5">
                            {drive.plays.map(p => (
                                <li key={p.id} className={`flex items-start gap-3 rounded-lg px-2 py-1.5 ${isScore(p) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                                    <span className="text-[11px] font-bold text-gray-400 w-16 shrink-0 pt-0.5 tabular-nums">
                                        Q{p.quarter}{p.clock ? ` ${p.clock}` : ''}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-sm text-gray-800 dark:text-gray-100">
                                            {p.play_type && <span className="font-bold text-sffl-navy dark:text-white">{PLAY_LABEL[p.play_type] || p.play_type}: </span>}
                                            {describe(p)}
                                        </span>
                                        {p.result && (
                                            <span className={`ml-1.5 text-xs font-bold ${isScore(p) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                · {RESULT_LABEL[p.result] || p.result}
                                            </span>
                                        )}
                                        {p.penalty && p.play_type && (
                                            <span className="ml-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">⚑ {p.penalty}</span>
                                        )}
                                    </div>
                                    {(p.home_score_after != null && p.away_score_after != null) && (
                                        <span className="text-xs font-black text-sffl-navy dark:text-gray-300 shrink-0 tabular-nums pt-0.5">
                                            {p.home_score_after}–{p.away_score_after}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                ))}
            </div>
        </div>
    );
};
