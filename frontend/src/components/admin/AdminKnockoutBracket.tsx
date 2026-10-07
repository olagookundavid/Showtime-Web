import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRightIcon, ArrowUturnLeftIcon, PlusIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { resetBracket } from '../../services/api';
import type { Match } from '../../types/matches';
import { buildBracketColumns, winnerSide, championOf, ChampionCard } from '../matches/BracketView';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FootballIcon } from '../icons/FootballIcon';

/**
 * Admin bracket experience for KNOCKOUT competitions:
 *
 *   1. Board: matches are shown in their bracket order.
 *      The admin schedules dates and enters scores.
 */

interface AdminKnockoutBracketProps {
    competitionId: string;
    matches: Match[];
    isCompleted: boolean;
    onAdd: (stage?: string) => void;
    onEdit: (m: Match) => void;
    onDelete: (m: Match) => void;
    onTeamSheet: (m: Match) => void;
}

// Stage value to seed a new match with when the admin adds to a given column.
const STAGE_FOR_TITLE: Record<string, string> = {
    'Wildcards': 'Wildcard',
    'Playoffs 1': 'Playoff 1',
    'Playoffs 2': 'Playoff 2',
    'Bowl': 'Bowl',
};

const statusChip: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    LIVE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    FINISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    POSTPONED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
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

export const AdminKnockoutBracket = ({ competitionId, matches, isCompleted, onAdd, onEdit, onDelete, onTeamSheet }: AdminKnockoutBracketProps) => {
    const queryClient = useQueryClient();
    const [resetting, setResetting] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    if (matches.length === 0) {
        if (isCompleted) {
            return (
                <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-xl text-center shadow-sm">
                    <p className="text-gray-500 font-semibold">This competition is completed and has no bracket.</p>
                </div>
            );
        }
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 sm:p-8 md:p-12 text-center space-y-5">
                <FootballIcon className="w-12 h-12 mx-auto text-sffl-red" aria-hidden="true" />
                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Build the playoff bracket</h3>
                <div className="max-w-md mx-auto text-sm text-gray-500 dark:text-gray-400 text-center space-y-2">
                    <p>Create matches, set Home/Away teams, and tag each stage (Wildcard, Playoff 1, Playoff 2, Bowl).</p>
                </div>
                <div className="flex justify-center gap-3">
                    <Button icon={PlusIcon} onClick={() => onAdd()}>
                        Add Matches
                    </Button>
                </div>
            </div>
        );
    }

    const columns = buildBracketColumns(matches);
    const byId = new Map(matches.map(m => [m.id, m]));
    const champion = championOf(matches);

    // Runs once the admin confirms. Errors are toasted, and the dialog closes either way.
    const handleReset = async () => {
        setResetting(true);
        try {
            await resetBracket(competitionId);
            toast.success('Bracket reset');
            queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
            queryClient.invalidateQueries({ queryKey: ['bracketTargets'] });
            queryClient.invalidateQueries({ queryKey: ['bracketMatches'] });
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: string; message?: string } } };
            toast.error(apiError.response?.data?.error || apiError.response?.data?.message || 'Failed to reset bracket');
        }
        setResetting(false);
        setConfirmReset(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">
                    Matches are grouped by their <span className="font-black">stage</span>. Add games to any stage and set Home/Away and scores via <span className="font-black">Edit / Score</span>.
                </p>
                {!isCompleted && (
                    <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        disabled={resetting}
                        className="self-start sm:self-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 whitespace-nowrap bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                        <ArrowUturnLeftIcon className="w-4 h-4" aria-hidden="true" />
                        Reset Bracket
                    </button>
                )}
            </div>

            <div className="overflow-x-auto pb-4 -mx-2 px-2">
                <div className="flex gap-4 md:gap-6 min-w-max items-stretch">
                    {columns.map((col, i) => {
                        const isLast = i === columns.length - 1;
                        return (
                            <div key={col.title} className="flex flex-col w-72">
                                <div className={`flex items-center justify-center gap-1.5 text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 py-1.5 rounded-lg ${isLast ? 'bg-sffl-red text-white' : 'bg-sffl-navy text-white'}`}>
                                    {isLast && <TrophyIcon className="w-4 h-4" aria-hidden="true" />}
                                    {isLast ? col.title : col.title.startsWith('Playoffs') ? 'Playoffs' : col.title}
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
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500">
                                                            Winner
                                                            <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                                                            <span className="sr-only">advances to</span>
                                                            {target ? `${target.round || 'next round'} (${m.feeds_slot === 'AWAY' ? 'away' : 'home'})` : 'next round'}
                                                        </span>
                                                    ) : isLast ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sffl-red">
                                                            <TrophyIcon className="w-4 h-4" aria-hidden="true" />
                                                            Championship game
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {!isCompleted && (
                                                    <div className="flex border-t border-gray-100 dark:border-gray-700 divide-x divide-gray-100 dark:divide-gray-700">
                                                        <Button variant="ghost" size="sm" className="flex-1 rounded-none" onClick={() => onEdit(m)}>Edit / Score</Button>
                                                        <Button variant="ghost" size="sm" className="flex-1 rounded-none" onClick={() => onTeamSheet(m)}>Sheet</Button>
                                                        <Button variant="danger" size="sm" className="flex-1 rounded-none" onClick={() => onDelete(m)}>Delete</Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {!isCompleted && (
                                        <button
                                            type="button"
                                            onClick={() => onAdd(STAGE_FOR_TITLE[col.title])}
                                            className="inline-flex items-center justify-center gap-1.5 min-h-11 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 hover:border-sffl-red hover:text-sffl-red transition-colors"
                                        >
                                            <PlusIcon className="w-4 h-4" aria-hidden="true" />
                                            Add to {col.title.startsWith('Playoffs') ? 'Playoffs' : col.title}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {champion && <ChampionCard team={champion} />}
                </div>
            </div>

            <ConfirmDialog
                open={confirmReset}
                title="Reset the bracket?"
                description="Every match in this competition, and any stats recorded on them, will be deleted. You will set the bracket up again from scratch."
                confirmLabel="Reset Bracket"
                tone="warning"
                icon={ArrowUturnLeftIcon}
                pending={resetting}
                onConfirm={handleReset}
                onCancel={() => setConfirmReset(false)}
            />
        </div>
    );
};
