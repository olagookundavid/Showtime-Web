import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { generateBracket, resetBracket, type BracketEntryPayload, type Match, type Team } from '../../services/api';
import { buildBracketColumns, winnerSide, championOf, ChampionCard } from '../matches/BracketView';

/**
 * Admin bracket experience for KNOCKOUT competitions, modeled on a FIFA-style
 * knockout stage:
 *
 *   1. Setup wizard (no matches yet): pick the bracket size, place the
 *      participating teams into first-round slots — matchups or byes — and
 *      generate. The backend creates the WHOLE tree at once: first-round
 *      games with real teams, TBD games for every later round down to the
 *      Bowl, all advancement pointers wired.
 *   2. Board (bracket exists): matches are shown in their bracket order.
 *      The admin only schedules dates and enters scores; winners are promoted
 *      automatically, so eliminated teams can never reappear.
 */

interface AdminKnockoutBracketProps {
    competitionId: string;
    matches: Match[];
    teams: Team[];
    isCompleted: boolean;
    onAdd: (stage?: string) => void;
    onEdit: (m: Match) => void;
    onDelete: (id: string) => void;
    onTeamSheet: (m: Match) => void;
    onImport: (m: Match) => void;
}

// Stage value to seed a new match with when the admin adds to a given column.
const STAGE_FOR_TITLE: Record<string, string> = {
    'Wildcard': 'Wildcard',
    'Playoffs 1': 'Playoff 1',
    'Playoffs 2': 'Playoff 2',
    'Bowl': 'Bowl',
};

interface EntryForm {
    bye: boolean;
    team_id: string;
    home_team_id: string;
    away_team_id: string;
}

const emptyEntry = (): EntryForm => ({ bye: false, team_id: '', home_team_id: '', away_team_id: '' });

const statusChip: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    LIVE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    FINISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    POSTPONED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

// ─── Setup wizard ─────────────────────────────────────────────────────────────

const SetupWizard = ({ competitionId, teams }: { competitionId: string; teams: Team[] }) => {
    const queryClient = useQueryClient();
    const [entries, setEntries] = useState<EntryForm[]>(Array.from({ length: 4 }, emptyEntry));
    const [date, setDate] = useState('');
    const [time, setTime] = useState('12:00');
    const [venue, setVenue] = useState('Showtime Arena');
    const [generating, setGenerating] = useState(false);

    const resize = (n: number) => {
        setEntries(prev => Array.from({ length: n }, (_, i) => prev[i] || emptyEntry()));
    };

    const setEntry = (i: number, patch: Partial<EntryForm>) => {
        setEntries(prev => prev.map((en, j) => (j === i ? { ...en, ...patch } : en)));
    };

    const usedIds = new Set<string>();
    entries.forEach(en => {
        if (en.bye) {
            if (en.team_id) usedIds.add(en.team_id);
        } else {
            if (en.home_team_id) usedIds.add(en.home_team_id);
            if (en.away_team_id) usedIds.add(en.away_team_id);
        }
    });
    const optionsFor = (current: string) => teams.filter(t => t.id === current || !usedIds.has(t.id));

    const teamSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full min-h-[40px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-xs font-bold"
        >
            <option value="">{placeholder}</option>
            {optionsFor(value).map(t => (
                <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
            ))}
        </select>
    );

    const handleGenerate = async () => {
        if (!date) { toast.error('Pick the first-round date'); return; }
        for (let i = 0; i < entries.length; i++) {
            const en = entries[i];
            if (en.bye && !en.team_id) { toast.error(`Slot ${i + 1}: pick the team with the bye`); return; }
            if (!en.bye && (!en.home_team_id || !en.away_team_id)) { toast.error(`Slot ${i + 1}: pick both teams`); return; }
        }
        setGenerating(true);
        try {
            const payload: BracketEntryPayload[] = entries.map(en =>
                en.bye
                    ? { bye: true, team_id: en.team_id }
                    : { bye: false, home_team_id: en.home_team_id, away_team_id: en.away_team_id },
            );
            await generateBracket(competitionId, { entries: payload, date, time, venue });
            toast.success('Bracket generated — winners will advance automatically');
            queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
            queryClient.invalidateQueries({ queryKey: ['bracketTargets'] });
            queryClient.invalidateQueries({ queryKey: ['bracketMatches'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to generate bracket');
        }
        setGenerating(false);
    };

    const pairLabel = (pairIdx: number) => String.fromCharCode(65 + pairIdx); // A, B, C…
    const pairs: EntryForm[][] = [];
    for (let i = 0; i < entries.length; i += 2) pairs.push(entries.slice(i, i + 2));

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 md:p-8 space-y-6">
            <div>
                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Set Up the Playoff Bracket</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Place the qualified teams into the first-round slots. A <span className="font-bold">bye</span> sends that team straight to the next round.
                    Slots pair up: the winners of each pair meet in the next round, all the way to the Bowl.
                    Everything after this — TBD matches, rounds, advancement — is created for you.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">First-round slots</label>
                    <select
                        value={entries.length}
                        onChange={e => resize(parseInt(e.target.value))}
                        className="min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-bold"
                    >
                        <option value={2}>2 slots (up to 4 teams → Final)</option>
                        <option value={4}>4 slots (up to 8 teams → 3 rounds)</option>
                        <option value={8}>8 slots (up to 16 teams → 4 rounds)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">First-round date *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Kick-off</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)}
                        className="min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                    <input type="text" value={venue} onChange={e => setVenue(e.target.value)}
                        className="w-full min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pairs.map((pair, pi) => (
                    <div key={pi} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            Pair {pairLabel(pi)} — winners meet in the next round
                        </div>
                        <div className="p-3 space-y-3">
                            {pair.map((en, j) => {
                                const i = pi * 2 + j;
                                return (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-sffl-navy dark:text-white">Slot {i + 1}</span>
                                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={en.bye}
                                                    onChange={e => setEntry(i, { bye: e.target.checked, team_id: '', home_team_id: '', away_team_id: '' })}
                                                    className="accent-sffl-red"
                                                />
                                                Bye (auto-qualifies)
                                            </label>
                                        </div>
                                        {en.bye ? (
                                            teamSelect(en.team_id, v => setEntry(i, { team_id: v }), 'Team with the bye…')
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {teamSelect(en.home_team_id, v => setEntry(i, { home_team_id: v }), 'Home team…')}
                                                <span className="text-[10px] font-black text-gray-400">VS</span>
                                                {teamSelect(en.away_team_id, v => setEntry(i, { away_team_id: v }), 'Away team…')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="px-6 py-2.5 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    {generating ? 'Generating…' : '🏈 Generate Bracket'}
                </button>
            </div>
        </div>
    );
};

// ─── Bracket board ────────────────────────────────────────────────────────────

const TeamLine = ({ m, side }: { m: Match; side: 'HOME' | 'AWAY' }) => {
    const team = side === 'HOME' ? m.home_team : m.away_team;
    const score = side === 'HOME' ? m.home_score : m.away_score;
    const winner = winnerSide(m);
    const finished = winner !== null;
    const isWinner = winner === side;
    const isTbd = !team?.id;

    return (
        <div className={`flex items-center gap-2 ${finished && !isWinner ? 'opacity-50' : ''}`}>
            <span className={`text-xs truncate flex-1 ${isTbd ? 'text-gray-400 dark:text-gray-500 italic font-semibold' : isWinner ? 'font-black text-sffl-navy dark:text-white' : 'font-bold text-gray-700 dark:text-gray-300'}`}>
                {isTbd ? 'TBD — awaiting winner' : (team.short_name || team.name).toUpperCase()}
            </span>
            {isWinner && <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase">W</span>}
            <span className={`text-sm tabular-nums ${isWinner ? 'font-black text-sffl-red' : 'font-bold text-gray-500 dark:text-gray-400'}`}>
                {m.status === 'FINISHED' || m.status === 'LIVE' ? score ?? '' : ''}
            </span>
        </div>
    );
};

export const AdminKnockoutBracket = ({ competitionId, matches, teams, isCompleted, onAdd, onEdit, onDelete, onTeamSheet, onImport }: AdminKnockoutBracketProps) => {
    const queryClient = useQueryClient();
    const [resetting, setResetting] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    if (matches.length === 0) {
        if (isCompleted) {
            return (
                <div className="bg-white dark:bg-gray-800 p-12 rounded-xl text-center shadow-sm">
                    <p className="text-gray-500 font-semibold">This competition is completed and has no bracket.</p>
                </div>
            );
        }
        if (showWizard) {
            return (
                <div className="space-y-3">
                    <button onClick={() => setShowWizard(false)} className="text-xs font-bold text-sffl-red hover:underline">← Back to manual entry</button>
                    <SetupWizard competitionId={competitionId} teams={teams} />
                </div>
            );
        }
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 md:p-12 text-center space-y-5">
                <div className="text-5xl">🏈</div>
                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Build the playoff bracket</h3>
                <div className="max-w-md mx-auto text-sm text-gray-500 dark:text-gray-400 text-left space-y-2">
                    <p><span className="font-black text-sffl-navy dark:text-white">Add matches manually</span> — create each game, set Home/Away yourself, and tag its stage (Wildcard, Playoff 1, Playoff 2, Bowl). Two-legged ties are just two matches with the same stage. Best for entering historical seasons.</p>
                    <p><span className="font-black text-sffl-navy dark:text-white">Or use the wizard</span> — pick the teams and it generates a clean single-elimination tree with auto-advancing winners. Best for a fresh forward season.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={() => onAdd()} className="px-5 py-2.5 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">
                        + Add Matches Manually
                    </button>
                    <button onClick={() => setShowWizard(true)} className="px-5 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                        🪄 Use the Wizard
                    </button>
                </div>
            </div>
        );
    }

    const columns = buildBracketColumns(matches);
    const byId = new Map(matches.map(m => [m.id, m]));
    const champion = championOf(matches);

    const handleReset = async () => {
        if (!confirm('Reset the bracket? ALL matches in this competition (and any stats recorded on them) will be deleted, and you will set the bracket up again from scratch.')) return;
        setResetting(true);
        try {
            await resetBracket(competitionId);
            toast.success('Bracket reset');
            queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
            queryClient.invalidateQueries({ queryKey: ['bracketTargets'] });
            queryClient.invalidateQueries({ queryKey: ['bracketMatches'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to reset bracket');
        }
        setResetting(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">
                    Matches are grouped by their <span className="font-black">stage</span>. Add games to any stage and set Home/Away and scores via <span className="font-black">Edit / Score</span>.
                </p>
                {!isCompleted && (
                    <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="px-3 py-1.5 min-h-[36px] whitespace-nowrap bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                        {resetting ? 'Resetting…' : '↺ Reset Bracket'}
                    </button>
                )}
            </div>

            <div className="overflow-x-auto pb-4 -mx-2 px-2">
                <div className="flex gap-4 md:gap-6 min-w-max items-stretch">
                    {columns.map((col, i) => {
                        const isLast = i === columns.length - 1;
                        return (
                            <div key={col.title} className="flex flex-col w-72">
                                <div className={`text-center text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 rounded-lg ${isLast ? 'bg-sffl-red text-white' : 'bg-sffl-navy text-white'}`}>
                                    {isLast ? `🏆 ${col.title}` : col.title}
                                </div>
                                <div className="flex flex-col justify-around flex-1 gap-3">
                                    {col.matches.map(m => {
                                        const target = m.feeds_match_id ? byId.get(m.feeds_match_id) : undefined;
                                        const ready = !!m.home_team?.id && !!m.away_team?.id;
                                        return (
                                            <div key={m.id} className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden ${ready && m.status !== 'FINISHED' ? 'border-sffl-red/40' : 'border-gray-100 dark:border-gray-700'}`}>
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                                        {m.date.substring(0, 10)}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide ${statusChip[m.status] || 'bg-gray-100 dark:bg-gray-600 dark:text-gray-300'}`}>
                                                        {ready && m.status === 'SCHEDULED' ? 'READY' : m.status}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-2 space-y-1.5">
                                                    <TeamLine m={m} side="HOME" />
                                                    <TeamLine m={m} side="AWAY" />
                                                </div>
                                                <div className="px-3 pb-2">
                                                    {m.feeds_match_id ? (
                                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                                                            Winner → {target ? `${target.round || 'next round'} (${m.feeds_slot === 'AWAY' ? 'away' : 'home'})` : 'next round'}
                                                        </span>
                                                    ) : isLast ? (
                                                        <span className="text-[10px] font-bold text-sffl-red">🏆 Championship game</span>
                                                    ) : null}
                                                </div>
                                                {!isCompleted && (
                                                    <div className="flex border-t border-gray-100 dark:border-gray-700 divide-x divide-gray-100 dark:divide-gray-700">
                                                        <button onClick={() => onEdit(m)} className="flex-1 py-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Edit / Score</button>
                                                        <button onClick={() => onTeamSheet(m)} className="flex-1 py-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">Sheet</button>
                                                        <button onClick={() => onImport(m)} className="flex-1 py-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">CSV</button>
                                                        <button onClick={() => onDelete(m.id)} className="flex-1 py-2 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">Del</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {!isCompleted && (
                                        <button
                                            onClick={() => onAdd(STAGE_FOR_TITLE[col.title])}
                                            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 hover:border-sffl-red hover:text-sffl-red transition-colors"
                                        >
                                            + Add to {col.title}
                                        </button>
                                    )}
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
