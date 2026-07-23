import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getMatches,
    getAdminTeamSheet,
    getAdminMatchPlays,
    createPlay,
    updatePlay,
    deletePlay,
    getStatsCompare,
    commitDerivedStats,
    getGameRules,
    upsertGameRules,
    recomputeScore,
    commitScore,
    type Match,
    type TeamSheetPlayer,
    type GamePlay,
    type PlayPayload,
    type GameRulesPayload,
    type TeamStat,
} from '../../services/api';
import { StatsTable } from '../../components/stats/StatsTable';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'home' | 'away' | '';
type Kind = '' | 'pass' | 'run' | 'xp' | 'special' | 'penalty' | 'event';
type PassOutcome = 'complete' | 'incomplete' | 'td' | 'int' | 'sack' | 'ta';

interface Ctx {
    quarter: number;
    driveNo: number;
    offense: Side;
    down: string;
    toGo: string;
    ballOn: string;
    clock: string;
    homeScore: string;
    awayScore: string;
}

interface Wizard {
    kind: Kind;
    // pass
    passOutcome?: PassOutcome;
    passModifier?: '' | 'SCR' | 'HM';
    // run
    runStyle?: 'RUN' | 'QBR' | 'SWP' | 'REV';
    // xp
    xpType?: 'PAT-R' | 'XP-P';
    xpResult?: 'XP' | 'XPF';
    // special / event
    specialType?: 'KO' | 'PUNT';
    eventKind?: 'IH' | 'EH' | 'EG';
    // shared (player_id values, chosen by name — not all teams have jersey numbers yet)
    qbId: string;
    targetId: string;
    carrierId: string;
    defenderId: string;
    rusherId: string;
    yards: string;
    result: string;
    dropped: boolean;
    battedDown: boolean;
    returnedForTd: boolean;
    safety: boolean;
    // penalty (attached or standalone)
    penaltyOn: boolean;
    penaltyCode: string;
    penaltyTeam: Side;
    penaltyPlayerId: string;
    penaltyYards: string;
    notes: string;
    editingId: string | null;
}

const emptyWizard: Wizard = {
    kind: '',
    passModifier: '',
    qbId: '',
    targetId: '',
    carrierId: '',
    defenderId: '',
    rusherId: '',
    yards: '',
    result: '',
    dropped: false,
    battedDown: false,
    returnedForTd: false,
    safety: false,
    penaltyOn: false,
    penaltyCode: '',
    penaltyTeam: '',
    penaltyPlayerId: '',
    penaltyYards: '',
    notes: '',
    editingId: null,
};

const PENALTY_LABELS: Record<string, string> = {
    FS: 'False Start', OFF: 'Offside', ENC: 'Encroachment', DOG: 'Delay of Game',
    OPI: 'Off. Pass Interference', DPI: 'Def. Pass Interference', FGD: 'Flag Guarding',
    HLD: 'Holding', RPC: 'Roughing Passer', IMP: 'Impeding', SUB: 'Illegal Sub',
    IF: 'Illegal Formation', MOT: 'Illegal Motion', FAV: 'Flag Violation', UF: 'Unsportsmanlike',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIntOrNull = (s: string): number | null => {
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
};

// Not every team has jersey numbers assigned yet, so players are picked by name
// (jersey number shown alongside when present, but never required).
const sortedRoster = (roster: TeamSheetPlayer[]) => [...roster].sort((a, b) => a.name.localeCompare(b.name));

// ─── Player picker: searchable combobox (jersey # or name filtering) ────────────

interface PlayerFieldProps {
    label: string;
    value: string; // player_id
    onChange: (v: string) => void;
    roster: TeamSheetPlayer[];
}

const PlayerField = ({ label, value, onChange, roster }: PlayerFieldProps) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedPlayer = roster.find(p => p.player_id === value);

    const filtered = sortedRoster(roster).filter(p => {
        const q = query.toLowerCase().trim();
        if (!q) return true;
        const numMatch = p.jersey_number ? String(p.jersey_number) === q : false;
        const nameMatch = p.name.toLowerCase().includes(q);
        const posMatch = p.position ? p.position.toLowerCase().includes(q) : false;
        return numMatch || nameMatch || posMatch;
    });

    return (
        <div className="relative">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    placeholder={selectedPlayer ? `${selectedPlayer.name}${selectedPlayer.jersey_number ? ` (#${selectedPlayer.jersey_number})` : ''}` : 'Type jersey # or name…'}
                    value={isOpen ? query : (selectedPlayer ? `${selectedPlayer.name}${selectedPlayer.jersey_number ? ` (#${selectedPlayer.jersey_number})` : ''}` : '')}
                    onFocus={() => { setIsOpen(true); setQuery(''); }}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-sffl-red focus:outline-none"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => { onChange(''); setQuery(''); }}
                        className="absolute right-2 top-2.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        ✕
                    </button>
                )}
            </div>
            {isOpen && (
                <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                    <button
                        type="button"
                        onMouseDown={() => { onChange(''); setIsOpen(false); }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        — Clear selection —
                    </button>
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">No matching player</div>
                    ) : (
                        filtered.map(p => (
                            <button
                                key={p.player_id}
                                type="button"
                                onMouseDown={() => { onChange(p.player_id); setIsOpen(false); setQuery(''); }}
                                className={`w-full px-3 py-2 text-left text-sm font-semibold hover:bg-sffl-red/10 dark:hover:bg-sffl-red/20 ${p.player_id === value ? 'bg-sffl-red/10 text-sffl-red font-bold' : 'text-gray-900 dark:text-white'}`}
                            >
                                {p.jersey_number ? <span className="inline-block w-8 text-sffl-red font-bold">#{p.jersey_number}</span> : null}
                                <span>{p.name}</span>
                                {p.position ? <span className="ml-2 text-xs font-normal text-gray-400">({p.position})</span> : null}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Game Situation Auto-Advancer ─────────────────────────────────────────────

const flipSide = (side: Side): Side => side === 'home' ? 'away' : side === 'away' ? 'home' : '';

const calculateNextSituation = (currentCtx: Ctx, payload: PlayPayload, downsPerSeries: number): Ctx => {
    const nextCtx = { ...currentCtx };
    const curDown = parseInt(currentCtx.down, 10) || 1;
    const curToGo = parseInt(currentCtx.toGo, 10) || 10;
    const yards = payload.yards ?? 0;
    const res = payload.result || '';
    const isTD = res === 'TD' || payload.returned_for_td;
    const isXP = res === 'XP' || res === 'XPF';
    const isINT = res === 'INT' || payload.play_type === 'INT';
    const isTO = res === 'TO';
    const isSAF = res === 'SAF';
    const isFirstDown = res === '1D' || res === '1DG' || (yards > 0 && yards >= curToGo);

    // A new drive starting elsewhere (possession change, or a kickoff/PAT
    // return) makes the old numeric spot meaningless — and worse, still
    // labeled with the wrong team's prefix. Clear it rather than guess; the
    // admin types the real spot for the next play. Only a continuing drive
    // (same team, same down sequence) extrapolates from the old spot.
    const clearBallOn = () => { nextCtx.ballOn = ''; };
    const advanceBallOn = () => {
        if (!currentCtx.ballOn) return;
        const parts = currentCtx.ballOn.trim().split(/\s+/);
        if (parts.length === 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) nextCtx.ballOn = `${parts[0]} ${num + yards}`;
        } else if (parts.length === 1) {
            const num = parseInt(parts[0], 10);
            if (!isNaN(num)) nextCtx.ballOn = `${num + yards}`;
        }
    };

    // Touchdown: the scoring team stays "on offense" for the extra-point try
    // that follows as a separate logged play.
    if (isTD) {
        nextCtx.down = '1';
        nextCtx.toGo = '10';
        clearBallOn();
        return nextCtx;
    }

    // Extra point (good or failed) is always followed by a kickoff/throw-off
    // to the other team — this is the actual possession change a scored
    // touchdown sets up, not the TD play itself.
    if (isXP || payload.play_type === 'KO') {
        nextCtx.offense = flipSide(currentCtx.offense);
        nextCtx.driveNo = currentCtx.driveNo + 1;
        nextCtx.down = '1';
        nextCtx.toGo = '10';
        clearBallOn();
        return nextCtx;
    }

    if (isINT || isTO || isSAF) {
        nextCtx.offense = flipSide(currentCtx.offense);
        nextCtx.driveNo = currentCtx.driveNo + 1;
        nextCtx.down = '1';
        nextCtx.toGo = '10';
        clearBallOn();
        return nextCtx;
    }

    if (isFirstDown) {
        nextCtx.down = '1';
        nextCtx.toGo = res === '1DG' ? 'Goal' : '10';
        advanceBallOn();
        return nextCtx;
    }

    // Turnover on downs — driven by the competition's actual configured
    // downs-per-series (defaults to 4 only if the rule hasn't been set).
    if (curDown >= downsPerSeries) {
        nextCtx.offense = flipSide(currentCtx.offense);
        nextCtx.driveNo = currentCtx.driveNo + 1;
        nextCtx.down = '1';
        nextCtx.toGo = '10';
        clearBallOn();
        return nextCtx;
    }

    nextCtx.down = String(curDown + 1);
    nextCtx.toGo = String(Math.max(1, curToGo - yards));
    advanceBallOn();
    return nextCtx;
};

// A card that "lights up" as the admin reaches that step in the flow.
const Section = ({ active, title, children }: { active: boolean; title: string; children: React.ReactNode }) => (
    <div className={`rounded-xl border p-4 transition-all ${active ? 'border-sffl-red bg-sffl-red/5 dark:bg-sffl-red/10 shadow-sm' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
        <div className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200 mb-3">{title}</div>
        {children}
    </div>
);

const chip = (selected: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-bold border transition-all ${selected
        ? 'bg-sffl-red text-white border-sffl-red'
        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-sffl-red'}`;

// ─── Main ─────────────────────────────────────────────────────────────────────

export const AdminPlayByPlay = () => {
    const queryClient = useQueryClient();
    const [matchId, setMatchId] = useState('');
    const [ctx, setCtx] = useState<Ctx>({
        quarter: 1, driveNo: 1, offense: '', down: '1', toGo: '10', ballOn: '', clock: '', homeScore: '0', awayScore: '0',
    });
    const [w, setW] = useState<Wizard>(emptyWizard);
    const [saving, setSaving] = useState(false);

    const { data: matchesData } = useQuery({
        queryKey: ['pbpMatches'],
        queryFn: () => getMatches(undefined, 1, 100),
    });
    // Latest matches first — makes the most likely picks (today's/this week's
    // games) sit at the top instead of scattered through whatever order the
    // API returned.
    const matches: Match[] = [...(matchesData?.data || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const match = matches.find(m => m.id === matchId);

    const { data: teamSheet } = useQuery({
        queryKey: ['pbpTeamSheet', matchId],
        queryFn: () => getAdminTeamSheet(matchId),
        enabled: !!matchId,
    });

    const { data: plays = [], isLoading: playsLoading } = useQuery({
        queryKey: ['pbpPlays', matchId],
        queryFn: () => getAdminMatchPlays(matchId),
        enabled: !!matchId,
    });

    // Needed by the auto-advancer below so "downs per series" reflects the
    // competition's actual configured rule instead of assuming 4.
    const competitionId = match?.competition?.id || '';
    const { data: activeRules } = useQuery({
        queryKey: ['pbpRules', competitionId],
        queryFn: () => getGameRules(competitionId),
        enabled: !!competitionId,
    });
    const downsPerSeries = activeRules?.downs_per_series || 4;

    const homeRoster = teamSheet?.home_team || [];
    const awayRoster = teamSheet?.away_team || [];
    const hasRosters = homeRoster.length > 0 && awayRoster.length > 0;

    const offenseRoster = ctx.offense === 'home' ? homeRoster : ctx.offense === 'away' ? awayRoster : [];
    const defenseRoster = ctx.offense === 'home' ? awayRoster : ctx.offense === 'away' ? homeRoster : [];
    const penaltyRoster = w.penaltyTeam === 'home' ? homeRoster : w.penaltyTeam === 'away' ? awayRoster : [];

    // Seed the context bar from the last logged play (no rules engine yet — just a
    // sensible starting point the admin can overtype). Depends on the `plays`
    // array itself (not just its length) so a Recompute — which rewrites the
    // score on existing plays without changing how many there are — still
    // refreshes the Home/Away score boxes here.
    useEffect(() => {
        if (w.editingId) return;
        if (plays.length === 0) return;
        const last = plays[plays.length - 1];
        const offense: Side = last.offense_team_id === match?.home_team?.id ? 'home'
            : last.offense_team_id === match?.away_team?.id ? 'away' : '';
        setCtx(c => ({
            ...c,
            quarter: last.quarter ?? c.quarter,
            driveNo: last.drive_no ?? c.driveNo,
            offense,
            down: last.down != null ? String(last.down) : c.down,
            toGo: last.to_go != null ? String(last.to_go) : c.toGo,
            ballOn: last.ball_on ?? '',
            homeScore: last.home_score_after != null ? String(last.home_score_after) : c.homeScore,
            awayScore: last.away_score_after != null ? String(last.away_score_after) : c.awayScore,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plays, matchId]);

    const offenseTeamId = ctx.offense === 'home' ? match?.home_team?.id : ctx.offense === 'away' ? match?.away_team?.id : undefined;

    const resetWizard = () => setW(emptyWizard);

    const setField = <K extends keyof Wizard>(k: K, v: Wizard[K]) => setW(prev => ({ ...prev, [k]: v }));

    // Build the API payload from the wizard + context.
    const buildPayload = (): { payload: PlayPayload | null; error?: string } => {
        const base: PlayPayload = {
            quarter: ctx.quarter,
            drive_no: ctx.driveNo,
            offense_team_id: offenseTeamId,
            down: toIntOrNull(ctx.down),
            to_go: toIntOrNull(ctx.toGo),
            ball_on: ctx.ballOn || undefined,
            clock: ctx.clock || undefined,
            home_score_after: toIntOrNull(ctx.homeScore),
            away_score_after: toIntOrNull(ctx.awayScore),
            notes: w.notes || undefined,
        };

        switch (w.kind) {
            case 'pass': {
                if (ctx.offense === '') return { payload: null, error: 'Pick which team has the ball first.' };
                base.off_qb_id = w.qbId || undefined;
                if (!base.off_qb_id) return { payload: null, error: 'Select the QB.' };
                base.yards = toIntOrNull(w.yards);
                base.rusher_id = w.rusherId || undefined;
                switch (w.passOutcome) {
                    case 'complete':
                        base.play_type = w.passModifier || 'CP';
                        base.target_id = w.targetId || undefined;
                        base.result = w.result || 'FG';
                        if (base.result === 'FG') base.defender_id = w.defenderId || undefined;
                        break;
                    case 'td':
                        base.play_type = 'TDP';
                        base.target_id = w.targetId || undefined;
                        base.result = 'TD';
                        break;
                    case 'incomplete':
                        base.play_type = w.passModifier || 'INC';
                        base.target_id = w.targetId || undefined;
                        base.result = 'INC';
                        base.dropped = w.dropped;
                        base.batted_down = w.battedDown;
                        if (w.defenderId) base.defender_id = w.defenderId;
                        break;
                    case 'int':
                        base.play_type = 'INT';
                        base.result = 'INT';
                        base.defender_id = w.defenderId || undefined;
                        base.returned_for_td = w.returnedForTd;
                        break;
                    case 'sack':
                        base.play_type = 'SACK';
                        base.defender_id = w.defenderId || undefined;
                        base.result = w.safety ? 'SAF' : 'FG';
                        break;
                    case 'ta':
                        base.play_type = 'TA';
                        base.result = 'INC';
                        break;
                    default:
                        return { payload: null, error: 'Pick what happened on the pass.' };
                }
                break;
            }
            case 'run': {
                if (ctx.offense === '') return { payload: null, error: 'Pick which team has the ball first.' };
                if (!w.runStyle) return { payload: null, error: 'Pick the run type.' };
                base.play_type = w.runStyle;
                base.off_qb_id = w.carrierId || undefined;
                if (!base.off_qb_id) return { payload: null, error: 'Select the carrier.' };
                base.yards = toIntOrNull(w.yards);
                base.result = w.result || 'FG';
                base.rusher_id = w.rusherId || undefined;
                if (base.result === 'FG' || base.result === 'SAF') base.defender_id = w.defenderId || undefined;
                break;
            }
            case 'xp': {
                if (ctx.offense === '') return { payload: null, error: 'Pick which team is trying the extra point.' };
                if (!w.xpType) return { payload: null, error: 'Run or pass extra point?' };
                base.play_type = w.xpType;
                base.result = w.xpResult || 'XP';
                if (w.xpType === 'XP-P') {
                    base.off_qb_id = w.qbId || undefined;
                    base.target_id = w.targetId || undefined;
                } else {
                    base.off_qb_id = w.carrierId || undefined;
                }
                break;
            }
            case 'special': {
                if (!w.specialType) return { payload: null, error: 'Throw-off or punt?' };
                base.play_type = w.specialType;
                base.result = 'DB';
                base.offense_team_id = offenseTeamId; // may be blank for a throw-off
                break;
            }
            case 'penalty': {
                if (w.penaltyTeam === '') return { payload: null, error: 'Which team committed the penalty?' };
                if (!w.penaltyCode) return { payload: null, error: 'Pick the penalty.' };
                base.result = 'DB';
                base.penalty = w.penaltyCode;
                base.penalty_team_id = w.penaltyTeam === 'home' ? match?.home_team?.id : match?.away_team?.id;
                base.penalty_player_id = w.penaltyPlayerId || undefined;
                base.penalty_yards = toIntOrNull(w.penaltyYards);
                return { payload: base };
            }
            case 'event': {
                if (!w.eventKind) return { payload: null, error: 'Pick the game event.' };
                base.result = w.eventKind;
                return { payload: base };
            }
            default:
                return { payload: null, error: 'Pick what happened.' };
        }

        // Optional penalty attached to a play above.
        if (w.penaltyOn && w.penaltyCode) {
            base.penalty = w.penaltyCode;
            base.penalty_team_id = w.penaltyTeam === 'home' ? match?.home_team?.id : w.penaltyTeam === 'away' ? match?.away_team?.id : undefined;
            base.penalty_player_id = w.penaltyPlayerId || undefined;
            base.penalty_yards = toIntOrNull(w.penaltyYards);
        }

        return { payload: base };
    };

    // After any change to the play log, the score and the derived stats are both
    // stale until something recomputes/refetches them. Rather than making the
    // admin do that by hand after every single play, we do it here automatically:
    // recompute walks the whole log and is safe to call repeatedly (it always
    // rebuilds from scratch). The standalone "Recompute score" button still
    // exists for cases this doesn't cover, e.g. after changing the point values.
    const syncScoreAndStats = async () => {
        try {
            await recomputeScore(matchId);
        } catch {
            toast.error('Saved, but the score could not be recomputed automatically — use "Recompute score" below.');
        }
        await queryClient.invalidateQueries({ queryKey: ['pbpPlays', matchId] });
        queryClient.invalidateQueries({ queryKey: ['pbpCompare', matchId] });
    };

    const handleSave = async () => {
        const { payload, error } = buildPayload();
        if (error || !payload) {
            toast.error(error || 'Incomplete play');
            return;
        }
        setSaving(true);
        try {
            if (w.editingId) {
                await updatePlay(matchId, w.editingId, payload);
                toast.success('Play updated');
            } else {
                await createPlay(matchId, payload);
                toast.success('Play added');
                // Auto-advance down, distance, ball-on for the next play
                setCtx(c => calculateNextSituation(c, payload, downsPerSeries));
            }
            await syncScoreAndStats();
            resetWizard();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Failed to save play');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (playId: string) => {
        if (!window.confirm('Delete this play?')) return;
        try {
            await deletePlay(matchId, playId);
            toast.success('Play deleted');
            await syncScoreAndStats();
        } catch {
            toast.error('Failed to delete play');
        }
    };

    // Load an existing play back into the context + wizard for editing.
    const startEdit = (p: GamePlay) => {
        const offense: Side = p.offense_team_id === match?.home_team?.id ? 'home'
            : p.offense_team_id === match?.away_team?.id ? 'away' : '';
        setCtx(c => ({
            ...c,
            quarter: p.quarter ?? 1,
            driveNo: p.drive_no ?? 1,
            offense,
            down: p.down != null ? String(p.down) : '',
            toGo: p.to_go != null ? String(p.to_go) : '',
            ballOn: p.ball_on ?? '',
            clock: p.clock ?? '',
            homeScore: p.home_score_after != null ? String(p.home_score_after) : c.homeScore,
            awayScore: p.away_score_after != null ? String(p.away_score_after) : c.awayScore,
        }));
        // Best-effort reverse mapping into the wizard from the stored codes.
        const pt = p.play_type || '';
        const nw: Wizard = { ...emptyWizard, editingId: p.id, notes: p.notes || '' };
        if (['CP', 'INC', 'TDP', 'SCR', 'HM', 'TA', 'INT', 'SACK'].includes(pt)) {
            nw.kind = 'pass';
            nw.qbId = p.off_qb?.id || '';
            nw.targetId = p.target?.id || '';
            nw.defenderId = p.defender?.id || '';
            nw.rusherId = p.rusher?.id || '';
            nw.yards = p.yards != null ? String(p.yards) : '';
            nw.dropped = p.dropped; nw.battedDown = p.batted_down; nw.returnedForTd = p.returned_for_td;
            if (pt === 'TDP') nw.passOutcome = 'td';
            else if (pt === 'INT') nw.passOutcome = 'int';
            else if (pt === 'SACK') { nw.passOutcome = 'sack'; nw.safety = p.result === 'SAF'; }
            else if (pt === 'TA') nw.passOutcome = 'ta';
            else if (p.result === 'INC') { nw.passOutcome = 'incomplete'; nw.passModifier = (pt === 'SCR' || pt === 'HM') ? pt : ''; }
            else { nw.passOutcome = 'complete'; nw.passModifier = (pt === 'SCR' || pt === 'HM') ? pt : ''; nw.result = p.result || 'FG'; }
        } else if (['RUN', 'QBR', 'SWP', 'REV'].includes(pt)) {
            nw.kind = 'run';
            nw.runStyle = pt as Wizard['runStyle'];
            nw.carrierId = p.off_qb?.id || '';
            nw.defenderId = p.defender?.id || '';
            nw.rusherId = p.rusher?.id || '';
            nw.yards = p.yards != null ? String(p.yards) : '';
            nw.result = p.result || 'FG';
        } else if (pt === 'XP-P' || pt === 'PAT-R') {
            nw.kind = 'xp'; nw.xpType = pt; nw.xpResult = (p.result === 'XPF' ? 'XPF' : 'XP');
            nw.qbId = p.off_qb?.id || '';
            nw.targetId = p.target?.id || '';
            nw.carrierId = p.off_qb?.id || '';
        } else if (pt === 'KO' || pt === 'PUNT') {
            nw.kind = 'special'; nw.specialType = pt;
        } else if (p.penalty && !pt) {
            nw.kind = 'penalty'; nw.penaltyCode = p.penalty;
            nw.penaltyTeam = p.penalty_team_id === match?.home_team?.id ? 'home' : p.penalty_team_id === match?.away_team?.id ? 'away' : '';
            nw.penaltyPlayerId = p.penalty_player?.id || '';
            nw.penaltyYards = p.penalty_yards != null ? String(p.penalty_yards) : '';
        } else if (['IH', 'EH', 'EG'].includes(p.result || '')) {
            nw.kind = 'event'; nw.eventKind = p.result as Wizard['eventKind'];
        }
        setW(nw);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const teamName = (side: Side) => side === 'home' ? match?.home_team?.short_name || match?.home_team?.name : side === 'away' ? match?.away_team?.short_name || match?.away_team?.name : '';

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white">Play-by-Play Entry</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Log each play by picking players from the team sheet. The stats engine and scoring come in a later step — for now this records the game story.</p>
            </div>

            {/* Match picker */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Match</label>
                <select
                    value={matchId}
                    onChange={e => { setMatchId(e.target.value); resetWizard(); }}
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">Select a match…</option>
                    {matches.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.home_team?.name} vs {m.away_team?.name} · {new Date(m.date).toLocaleDateString()} {m.status === 'LIVE' ? '· LIVE' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {matchId && !hasRosters && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
                    <b>Set the team sheets first.</b> Both teams need their rosters saved on this match before you can log plays. Do that on the <b>Matches</b> screen (Team Sheets), then come back.
                </div>
            )}

            {matchId && hasRosters && (
                <>
                    {/* Context bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200 mb-3">Game situation {w.editingId && <span className="text-amber-500">· editing play</span>}</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Qtr</span>
                                <input type="number" value={ctx.quarter} onChange={e => setCtx({ ...ctx, quarter: parseInt(e.target.value) || 1 })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Drive</span>
                                <input type="number" value={ctx.driveNo} onChange={e => setCtx({ ...ctx, driveNo: parseInt(e.target.value) || 1 })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Ball with</span>
                                <select value={ctx.offense} onChange={e => setCtx({ ...ctx, offense: e.target.value as Side })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">—</option>
                                    <option value="home">{match?.home_team?.short_name || match?.home_team?.name || 'Home'}</option>
                                    <option value="away">{match?.away_team?.short_name || match?.away_team?.name || 'Away'}</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Down</span>
                                <input type="number" value={ctx.down} onChange={e => setCtx({ ...ctx, down: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">To go</span>
                                <input type="number" value={ctx.toGo} onChange={e => setCtx({ ...ctx, toGo: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Ball on</span>
                                <input value={ctx.ballOn} onChange={e => setCtx({ ...ctx, ballOn: e.target.value })} placeholder="e.g. SHK 35" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Clock</span>
                                <input value={ctx.clock} onChange={e => setCtx({ ...ctx, clock: e.target.value })} placeholder="MM:SS" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 max-w-xs">
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">{match?.home_team?.short_name || 'Home'} score</span>
                                <input type="number" value={ctx.homeScore} onChange={e => setCtx({ ...ctx, homeScore: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">{match?.away_team?.short_name || 'Away'} score</span>
                                <input type="number" value={ctx.awayScore} onChange={e => setCtx({ ...ctx, awayScore: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </label>
                        </div>
                    </div>

                    {/* Step 1 — what happened */}
                    <Section active title="What happened?">
                        <div className="flex flex-wrap gap-2">
                            {([['pass', 'Pass'], ['run', 'Run'], ['xp', 'Extra Point'], ['special', 'Special (KO/Punt)'], ['penalty', 'Penalty only'], ['event', 'Game event']] as [Kind, string][]).map(([k, label]) => (
                                <button key={k} className={chip(w.kind === k)} onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: k })}>{label}</button>
                            ))}
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60">
                            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">⚡ Quick Play Presets</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: 'pass', passOutcome: 'incomplete' })}
                                    className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                >
                                    🏈 Incomplete Pass
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: 'run', runStyle: 'RUN', yards: '5', result: 'FG' })}
                                    className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                >
                                    🏃 5-Yard Run
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: 'pass', passOutcome: 'sack', yards: '-6' })}
                                    className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors"
                                >
                                    💥 Sack (-6 yds)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: 'pass', passOutcome: 'td' })}
                                    className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 rounded-md text-xs font-bold text-emerald-800 dark:text-emerald-200 transition-colors"
                                >
                                    🏆 Touchdown Pass
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setW({ ...emptyWizard, editingId: w.editingId, kind: 'penalty', penaltyCode: 'FS', penaltyYards: '5' })}
                                    className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 rounded-md text-xs font-bold text-amber-800 dark:text-amber-200 transition-colors"
                                >
                                    ⚑ False Start (-5 yds)
                                </button>
                            </div>
                        </div>
                    </Section>

                    {/* PASS flow */}
                    {w.kind === 'pass' && (
                        <Section active title="The pass">
                            <div className="space-y-4">
                                <PlayerField label={`QB (${teamName(ctx.offense)})`} value={w.qbId} onChange={v => setField('qbId', v)} roster={offenseRoster} />
                                <div>
                                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Outcome</div>
                                    <div className="flex flex-wrap gap-2">
                                        {([['complete', 'Complete'], ['incomplete', 'Incomplete'], ['td', 'Touchdown'], ['int', 'Intercepted'], ['sack', 'Sacked'], ['ta', 'Thrown away']] as [PassOutcome, string][]).map(([o, label]) => (
                                            <button key={o} className={chip(w.passOutcome === o)} onClick={() => setField('passOutcome', o)}>{label}</button>
                                        ))}
                                    </div>
                                </div>

                                {(w.passOutcome === 'complete' || w.passOutcome === 'incomplete') && (
                                    <div className="flex gap-2">
                                        <button className={chip(w.passModifier === 'SCR')} onClick={() => setField('passModifier', w.passModifier === 'SCR' ? '' : 'SCR')}>Screen</button>
                                        <button className={chip(w.passModifier === 'HM')} onClick={() => setField('passModifier', w.passModifier === 'HM' ? '' : 'HM')}>Hail Mary</button>
                                    </div>
                                )}

                                {(w.passOutcome === 'complete' || w.passOutcome === 'td' || w.passOutcome === 'incomplete') && (
                                    <PlayerField label={`Target (${teamName(ctx.offense)})`} value={w.targetId} onChange={v => setField('targetId', v)} roster={offenseRoster} />
                                )}

                                {(w.passOutcome === 'complete' || w.passOutcome === 'td') && (
                                    <label className="block">
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Yards</span>
                                        <input type="number" value={w.yards} onChange={e => setField('yards', e.target.value)} className="ml-2 w-24 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </label>
                                )}

                                {w.passOutcome === 'complete' && (
                                    <div>
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">How did it end?</div>
                                        <div className="flex flex-wrap gap-2">
                                            {[['FG', 'Flag pull'], ['1D', 'First down'], ['1DG', 'First & goal'], ['OB', 'Out of bounds'], ['DB', 'Dead ball']].map(([r, label]) => (
                                                <button key={r} className={chip(w.result === r)} onClick={() => setField('result', r)}>{label}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {w.passOutcome === 'incomplete' && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-300">Why was it incomplete? (optional)</div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className={chip(w.dropped)}
                                                onClick={() => setField('dropped', !w.dropped)}
                                            >
                                                Dropped
                                            </button>
                                            <button
                                                type="button"
                                                className={chip(w.battedDown)}
                                                onClick={() => setField('battedDown', !w.battedDown)}
                                            >
                                                Batted Down
                                            </button>
                                        </div>
                                        {w.battedDown && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Name who batted it below (Rusher/Blitzer or Coverage Defender) — that's who gets credited with the deflection.</p>
                                        )}
                                    </div>
                                )}

                                {w.passOutcome === 'int' && (
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        <input type="checkbox" checked={w.returnedForTd} onChange={e => setField('returnedForTd', e.target.checked)} /> Returned for touchdown
                                    </label>
                                )}

                                {w.passOutcome === 'sack' && (
                                    <div className="space-y-2">
                                        <label className="block">
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Yards lost</span>
                                            <input type="number" value={w.yards} onChange={e => setField('yards', e.target.value)} placeholder="e.g. -6" className="ml-2 w-24 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                            <input type="checkbox" checked={w.safety} onChange={e => setField('safety', e.target.checked)} /> In own end zone (Safety)
                                        </label>
                                    </div>
                                )}

                                {(w.passOutcome === 'int' || w.passOutcome === 'sack' || (w.passOutcome === 'complete' && w.result !== 'TD') || (w.passOutcome === 'incomplete')) && (
                                    <div className="space-y-2">
                                        {w.passOutcome === 'complete' && w.result !== 'TD' && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">💡 Picking a defender or blitzer below credits a Flag Pull (Tackle) on this play (e.g. 1st & Goal + Flag Pull).</p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PlayerField label={`Rusher / Blitzer (${teamName(ctx.offense === 'home' ? 'away' : ctx.offense === 'away' ? 'home' : '')})`} value={w.rusherId} onChange={v => setField('rusherId', v)} roster={defenseRoster} />
                                            <PlayerField label={`Coverage Defender (${teamName(ctx.offense === 'home' ? 'away' : ctx.offense === 'away' ? 'home' : '')})`} value={w.defenderId} onChange={v => setField('defenderId', v)} roster={defenseRoster} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* RUN flow */}
                    {w.kind === 'run' && (
                        <Section active title="The run">
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {([['RUN', 'Run'], ['QBR', 'QB run'], ['SWP', 'Sweep'], ['REV', 'Reverse']] as [Wizard['runStyle'], string][]).map(([s, label]) => (
                                        <button key={s} className={chip(w.runStyle === s)} onClick={() => setField('runStyle', s)}>{label}</button>
                                    ))}
                                </div>
                                <PlayerField label={`Carrier (${teamName(ctx.offense)})`} value={w.carrierId} onChange={v => setField('carrierId', v)} roster={offenseRoster} />
                                <label className="block">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Yards</span>
                                    <input type="number" value={w.yards} onChange={e => setField('yards', e.target.value)} className="ml-2 w-24 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </label>
                                <div>
                                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">How did it end?</div>
                                    <div className="flex flex-wrap gap-2">
                                        {[['FG', 'Flag pull'], ['1D', 'First down'], ['1DG', 'First & goal'], ['TD', 'Touchdown'], ['OB', 'Out of bounds'], ['SAF', 'Safety'], ['DB', 'Dead ball']].map(([r, label]) => (
                                            <button key={r} className={chip(w.result === r)} onClick={() => setField('result', r)}>{label}</button>
                                        ))}
                                    </div>
                                </div>
                                {w.result !== 'TD' && (
                                    <div className="space-y-2">
                                        {w.result !== 'SAF' && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">💡 Picking a defender or blitzer below credits a Flag Pull (Tackle) on this play (e.g. 1st & Goal + Flag Pull).</p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PlayerField label={`Blitzer / Penetrator (${teamName(ctx.offense === 'home' ? 'away' : ctx.offense === 'away' ? 'home' : '')})`} value={w.rusherId} onChange={v => setField('rusherId', v)} roster={defenseRoster} />
                                            <PlayerField label={`Tackler / Defender (${teamName(ctx.offense === 'home' ? 'away' : ctx.offense === 'away' ? 'home' : '')})`} value={w.defenderId} onChange={v => setField('defenderId', v)} roster={defenseRoster} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* EXTRA POINT flow */}
                    {w.kind === 'xp' && (
                        <Section active title="Extra point">
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <button className={chip(w.xpType === 'PAT-R')} onClick={() => setField('xpType', 'PAT-R')}>Run (PAT-R)</button>
                                    <button className={chip(w.xpType === 'XP-P')} onClick={() => setField('xpType', 'XP-P')}>Pass (XP-P)</button>
                                </div>
                                {w.xpType === 'XP-P' && (
                                    <>
                                        <PlayerField label="QB" value={w.qbId} onChange={v => setField('qbId', v)} roster={offenseRoster} />
                                        <PlayerField label="Target" value={w.targetId} onChange={v => setField('targetId', v)} roster={offenseRoster} />
                                    </>
                                )}
                                {w.xpType === 'PAT-R' && (
                                    <PlayerField label="Carrier" value={w.carrierId} onChange={v => setField('carrierId', v)} roster={offenseRoster} />
                                )}
                                <div className="flex gap-2">
                                    <button className={chip(w.xpResult === 'XP')} onClick={() => setField('xpResult', 'XP')}>Good</button>
                                    <button className={chip(w.xpResult === 'XPF')} onClick={() => setField('xpResult', 'XPF')}>Failed</button>
                                </div>
                            </div>
                        </Section>
                    )}

                    {/* SPECIAL flow */}
                    {w.kind === 'special' && (
                        <Section active title="Special teams">
                            <div className="flex gap-2">
                                <button className={chip(w.specialType === 'KO')} onClick={() => setField('specialType', 'KO')}>Throw-off</button>
                                <button className={chip(w.specialType === 'PUNT')} onClick={() => setField('specialType', 'PUNT')}>Punt</button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Use the “Ball on” and “Notes” fields to record the returner and resulting spot.</p>
                        </Section>
                    )}

                    {/* PENALTY-ONLY flow */}
                    {w.kind === 'penalty' && (
                        <Section active title="Penalty">
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <button className={chip(w.penaltyTeam === 'home')} onClick={() => setField('penaltyTeam', 'home')}>{match?.home_team?.short_name || 'Home'}</button>
                                    <button className={chip(w.penaltyTeam === 'away')} onClick={() => setField('penaltyTeam', 'away')}>{match?.away_team?.short_name || 'Away'}</button>
                                </div>
                                <select value={w.penaltyCode} onChange={e => setField('penaltyCode', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">Select penalty…</option>
                                    {Object.entries(PENALTY_LABELS).map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
                                </select>
                                <PlayerField label="Player (optional)" value={w.penaltyPlayerId} onChange={v => setField('penaltyPlayerId', v)} roster={penaltyRoster} />
                                <label className="block">
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Penalty yards</span>
                                    <input type="number" value={w.penaltyYards} onChange={e => setField('penaltyYards', e.target.value)} className="ml-2 w-24 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </label>
                            </div>
                        </Section>
                    )}

                    {/* GAME EVENT flow */}
                    {w.kind === 'event' && (
                        <Section active title="Game event">
                            <div className="flex flex-wrap gap-2">
                                {([['IH', 'Injury'], ['EH', 'End of half'], ['EG', 'End of game']] as [Wizard['eventKind'], string][]).map(([e, label]) => (
                                    <button key={e} className={chip(w.eventKind === e)} onClick={() => setField('eventKind', e)}>{label}</button>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Optional attached penalty (for non-penalty plays) */}
                    {w.kind && w.kind !== 'penalty' && w.kind !== 'event' && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                <input type="checkbox" checked={w.penaltyOn} onChange={e => setField('penaltyOn', e.target.checked)} /> Add a penalty on this play
                            </label>
                            {w.penaltyOn && (
                                <div className="space-y-3 mt-3">
                                    <div className="flex gap-2">
                                        <button className={chip(w.penaltyTeam === 'home')} onClick={() => setField('penaltyTeam', 'home')}>{match?.home_team?.short_name || 'Home'}</button>
                                        <button className={chip(w.penaltyTeam === 'away')} onClick={() => setField('penaltyTeam', 'away')}>{match?.away_team?.short_name || 'Away'}</button>
                                    </div>
                                    <select value={w.penaltyCode} onChange={e => setField('penaltyCode', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                        <option value="">Select penalty…</option>
                                        {Object.entries(PENALTY_LABELS).map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
                                    </select>
                                    <div className="flex items-end gap-3">
                                        <PlayerField label="Player (optional)" value={w.penaltyPlayerId} onChange={v => setField('penaltyPlayerId', v)} roster={penaltyRoster} />
                                        <label className="block">
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Yards</span>
                                            <input type="number" value={w.penaltyYards} onChange={e => setField('penaltyYards', e.target.value)} className="ml-2 w-20 border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes + Save */}
                    {w.kind && (
                        <div className="space-y-3">
                            <input value={w.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes (optional)" className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            <div className="flex gap-2">
                                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-sffl-red text-white font-bold rounded-lg disabled:opacity-50">
                                    {saving ? 'Saving…' : w.editingId ? 'Update play' : 'Add play'}
                                </button>
                                <button onClick={resetWizard} className="px-4 py-2.5 border rounded-lg font-bold text-gray-600 dark:text-gray-300 dark:border-gray-600">
                                    {w.editingId ? 'Cancel edit' : 'Clear'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3 — scoring engine tools */}
                    <ScoreTools matchId={matchId} competitionId={match?.competition?.id || ''} match={match} plays={plays} />

                    {/* Logged plays */}
                    <div>
                        <h2 className="text-lg font-black text-sffl-navy dark:text-white mb-2">Logged plays ({plays.length})</h2>
                        {playsLoading ? (
                            <p className="text-sm text-gray-500">Loading…</p>
                        ) : plays.length === 0 ? (
                            <p className="text-sm text-gray-500">No plays yet — log the first one above.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {plays.map(p => <PlayRow key={p.id} play={p} onEdit={() => startEdit(p)} onDelete={() => handleDelete(p.id)} />)}
                            </div>
                        )}
                    </div>

                    {/* Step 2 — derived-vs-manual stats compare */}
                    <StatsCompare matchId={matchId} />
                </>
            )}
        </div>
    );
};

// ─── Read-only summary row for a logged play ──────────────────────────────────

const PlayRow = ({ play, onEdit, onDelete }: { play: GamePlay; onEdit: () => void; onDelete: () => void }) => {
    const who = (p?: { name: string; jersey_number: number }) => p ? (p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name) : '';
    const bits: string[] = [];
    if (play.off_qb) bits.push(who(play.off_qb));
    if (play.target) bits.push(`→ ${who(play.target)}`);
    if (play.yards != null) bits.push(`${play.yards >= 0 ? '+' : ''}${play.yards} yd`);
    if (play.batted_down) bits.push('batted down');
    if (play.rusher) bits.push(`(rush ${who(play.rusher)})`);
    if (play.defender) bits.push(`(def ${who(play.defender)})`);
    if (play.penalty) bits.push(`⚑ ${play.penalty}${play.penalty_player ? ' ' + who(play.penalty_player) : ''}`);

    return (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-black text-gray-400 w-8 shrink-0">#{play.seq}</span>
                <span className="text-[11px] font-bold text-sffl-navy dark:text-gray-300 shrink-0">Q{play.quarter}{play.down ? ` · ${play.down}&${play.to_go ?? ''}` : ''}</span>
                <span className="text-xs font-mono font-bold bg-sffl-navy/10 dark:bg-white/10 rounded px-1.5 py-0.5 shrink-0">{play.play_type || play.result || '—'}</span>
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{bits.join(' ')} {play.result && play.play_type ? <span className="text-gray-400">· {play.result}</span> : null}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {(play.home_score_after != null && play.away_score_after != null) && (
                    <span className="text-xs font-black text-sffl-navy dark:text-gray-300">{play.home_score_after}-{play.away_score_after}</span>
                )}
                <button onClick={onEdit} className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
                <button onClick={onDelete} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
            </div>
        </div>
    );
};

// ─── Step 3: scoring engine — recompute score + edit rules ────────────────────

const RULE_FIELDS: { key: keyof GameRulesPayload; label: string }[] = [
    { key: 'td_points', label: 'Touchdown' },
    { key: 'xp_run_points', label: 'Extra pt (run)' },
    { key: 'xp_pass_points', label: 'Extra pt (pass)' },
    { key: 'safety_points', label: 'Safety' },
    { key: 'def_return_points', label: 'Defensive return' },
    { key: 'downs_per_series', label: 'Downs / series' },
    { key: 'yards_to_first_down', label: 'Yards to 1st down' },
];

interface ScoreToolsProps {
    matchId: string;
    competitionId: string;
    match?: Match;
    plays?: GamePlay[];
}

const ScoreTools = ({ matchId, competitionId, match, plays = [] }: ScoreToolsProps) => {
    const { user } = useAuth();
    const isAppAdmin = user?.role === 'app_admin';
    const queryClient = useQueryClient();
    const [recomputing, setRecomputing] = useState(false);
    const [editingRules, setEditingRules] = useState(false);
    const [rulesForm, setRulesForm] = useState<GameRulesPayload | null>(null);
    const [savingRules, setSavingRules] = useState(false);
    const [committingScore, setCommittingScore] = useState(false);

    // Compute PBP derived score from the last play snapshot in log
    const lastPlayWithScore = [...plays].reverse().find(p => p.home_score_after != null && p.away_score_after != null);
    const pbpHome = lastPlayWithScore?.home_score_after ?? 0;
    const pbpAway = lastPlayWithScore?.away_score_after ?? 0;

    const storedHome = match?.home_score ?? 0;
    const storedAway = match?.away_score ?? 0;
    const scoresMatch = pbpHome === storedHome && pbpAway === storedAway;

    const { data: rules } = useQuery({
        queryKey: ['pbpRules', competitionId],
        queryFn: () => getGameRules(competitionId),
        enabled: !!competitionId && editingRules,
    });

    useEffect(() => {
        if (rules && !rulesForm) {
            const { competition_id, ...rest } = rules;
            void competition_id;
            setRulesForm(rest);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rules]);

    const recompute = async () => {
        setRecomputing(true);
        try {
            const res = await recomputeScore(matchId);
            toast.success(`Play-by-Play running score refreshed: ${res.home_score}–${res.away_score}`);
            await queryClient.invalidateQueries({ queryKey: ['pbpPlays', matchId] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Failed to refresh score');
        } finally {
            setRecomputing(false);
        }
    };

    const handleCommitScore = async () => {
        if (!isAppAdmin) {
            toast.error('Only App Admin can commit scores to the main match record');
            return;
        }
        if (!confirm(`Commit Play-by-Play score (${pbpHome}–${pbpAway}) to overwrite official match record (${storedHome}–${storedAway}) and update standings?`)) return;
        setCommittingScore(true);
        try {
            const res = await commitScore(matchId);
            toast.success(`Official score updated to ${res.home_score}–${res.away_score} and standings refreshed!`);
            await queryClient.invalidateQueries({ queryKey: ['pbpPlays', matchId] });
            await queryClient.invalidateQueries({ queryKey: ['adminMatchDetail', matchId] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Failed to commit score');
        } finally {
            setCommittingScore(false);
        }
    };

    const saveRules = async () => {
        if (!rulesForm || !competitionId) return;
        setSavingRules(true);
        try {
            await upsertGameRules(competitionId, rulesForm);
            toast.success('Scoring rules saved');
            queryClient.invalidateQueries({ queryKey: ['pbpRules', competitionId] });
            setEditingRules(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Failed to save rules');
        } finally {
            setSavingRules(false);
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-black text-sffl-navy dark:text-white flex items-center gap-2">
                        <span>Score Comparison & Commit</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoresMatch ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                            {scoresMatch ? '✓ Scores Match' : '⚠️ Discrepancy'}
                        </span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Logging plays computes a running score preview. Nothing touches the live match table or standings until an App Admin commits.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditingRules(o => !o)} className="px-3 py-2 border rounded-lg font-bold text-xs text-sffl-navy dark:text-gray-200 dark:border-gray-600">Scoring rules</button>
                    <button onClick={recompute} disabled={recomputing} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 font-bold rounded-lg text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 disabled:opacity-50">
                        {recomputing ? 'Refreshing…' : 'Refresh PBP score'}
                    </button>
                </div>
            </div>

            {/* Side-by-Side Comparison Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
                {/* Official Stored Match Score */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-400 tracking-wider">
                        Official Stored Score (Matches Table)
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                            {match?.home_team?.short_name || match?.home_team?.name || 'Home'} vs {match?.away_team?.short_name || match?.away_team?.name || 'Away'}
                        </span>
                        <span className="text-xl font-black font-mono text-sffl-navy dark:text-white">
                            {storedHome} – {storedAway}
                        </span>
                    </div>
                </div>

                {/* Derived Play-by-Play Score */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-sffl-red tracking-wider">
                            Play-by-Play Derived Score (Preview)
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                            {plays.length} logged play{plays.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <button
                            onClick={handleCommitScore}
                            disabled={!isAppAdmin || committingScore}
                            title={!isAppAdmin ? 'Commit restricted to App Admin' : 'Commit PBP score to official match record'}
                            className="px-3 py-1 bg-sffl-navy text-white font-bold rounded-lg text-xs hover:bg-sffl-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {committingScore ? 'Committing…' : 'Commit PBP Score →'}
                        </button>
                        <span className="text-xl font-black font-mono text-sffl-navy dark:text-white">
                            {pbpHome} – {pbpAway}
                        </span>
                    </div>
                </div>
            </div>

            {editingRules && (
                <div className="pt-2">
                    {!rulesForm ? (
                        <p className="text-sm text-gray-500">Loading rules…</p>
                    ) : (
                        <>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 font-semibold">These are placeholder values — confirm them with the commissioner. They apply to the whole competition.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {RULE_FIELDS.map(f => (
                                    <label key={f.key} className="flex flex-col gap-1">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">{f.label}</span>
                                        <input
                                            type="number"
                                            value={rulesForm[f.key]}
                                            onChange={e => setRulesForm({ ...rulesForm, [f.key]: parseInt(e.target.value) || 0 })}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </label>
                                ))}
                            </div>
                            <button onClick={saveRules} disabled={savingRules} className="mt-3 px-5 py-2 bg-sffl-red text-white font-bold rounded-lg text-sm disabled:opacity-50">
                                {savingRules ? 'Saving…' : 'Save rules'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// Admin-only, per-match stats table sourced purely from the play log, rendered
// in the exact StatsTable layout so it mirrors a real match's stats. Temporary
// tooling for iterating — compare by eye against the public /stats page, then
// Commit to write these onto the main stats table. Remove once finalised.
const StatsCompare = ({ matchId }: { matchId: string }) => {
    const { user } = useAuth();
    const isAppAdmin = user?.role === 'app_admin';
    const [open, setOpen] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

    const { data, isFetching } = useQuery({
        queryKey: ['pbpCompare', matchId],
        queryFn: () => getStatsCompare(matchId),
        enabled: open,
    });

    const derived = data?.derived || [];

    // Extract unique teams involved in this match from derived player stats
    const teamsList = useMemo(() => {
        const map: Record<string, { id: string; name: string; shortName: string }> = {};
        derived.forEach(p => {
            if (p.team_id && !map[p.team_id]) {
                map[p.team_id] = {
                    id: p.team_id,
                    name: p.team_name || 'Team',
                    shortName: p.team_short_name || p.team_name || 'Team',
                };
            }
        });
        return Object.values(map);
    }, [derived]);

    // Derived team stats aggregated from derived player stats
    const derivedTeamStats: TeamStat[] = useMemo(() => {
        const map: Record<string, TeamStat> = {};
        derived.forEach(p => {
            if (!p.team_id) return;
            if (!map[p.team_id]) {
                map[p.team_id] = {
                    team_id: p.team_id,
                    team_name: p.team_name || '',
                    team_short_name: p.team_short_name || '',
                    team_logo: p.team_logo || '',
                    passing_attempts: 0,
                    rushing_attempts: 0,
                    completed_passes: 0,
                    passing_tds: 0,
                    rushing_tds: 0,
                    interceptions_thrown: 0,
                    receptions: 0,
                    receiving_tds: 0,
                    extra_points_tds: 0,
                    drops: 0,
                    flag_pulls: 0,
                    pass_deflections: 0,
                    interceptions: 0,
                    defensive_tds: 0,
                    safety: 0,
                    qb_sacks: 0,
                    def_sacks: 0,
                    defensive_xp_tds: 0,
                };
            }
            const t = map[p.team_id];
            t.passing_attempts += p.passing_attempts || 0;
            t.rushing_attempts += p.rushing_attempts || 0;
            t.completed_passes += p.completed_passes || 0;
            t.passing_tds += p.passing_tds || 0;
            t.rushing_tds += p.rushing_tds || 0;
            t.interceptions_thrown += p.interceptions_thrown || 0;
            t.receptions += p.receptions || 0;
            t.receiving_tds += p.receiving_tds || 0;
            t.extra_points_tds += p.extra_points_tds || 0;
            t.drops += p.drops || 0;
            t.flag_pulls += p.flag_pulls || 0;
            t.pass_deflections += p.pass_deflections || 0;
            t.interceptions += p.interceptions || 0;
            t.defensive_tds += p.defensive_tds || 0;
            t.safety += p.safety || 0;
            t.qb_sacks += p.qb_sacks || 0;
            t.def_sacks += p.def_sacks || 0;
            t.defensive_xp_tds += p.defensive_xp_tds || 0;
        });
        return Object.values(map);
    }, [derived]);

    // Filter player stats by team selection
    const filteredPlayerStats = useMemo(() => {
        if (selectedTeamId === 'all') return derived;
        return derived.filter(p => p.team_id === selectedTeamId);
    }, [derived, selectedTeamId]);

    const commit = async () => {
        if (!isAppAdmin) {
            toast.error('Only App Admin can commit stats to the main stats table');
            return;
        }
        if (!window.confirm('Write these play-by-play stats onto the main stats table? This overwrites the saved stats for this match.')) return;
        setCommitting(true);
        try {
            const res = await commitDerivedStats(matchId);
            toast.success(`Committed stats for ${res.players} player(s)`);
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Failed to commit stats');
        } finally {
            setCommitting(false);
        }
    };

    return (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-black text-sffl-navy dark:text-white">
                        Play-by-Play Stats <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 align-middle">preview · not saved</span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Box score computed live from the plays above, shown exactly as the real stats table looks. Open the public <b>Stats</b> page to compare.</p>
                </div>
                <button onClick={() => setOpen(o => !o)} className="px-4 py-2 border rounded-lg font-bold text-sm text-sffl-navy dark:text-gray-200 dark:border-gray-600">
                    {open ? 'Hide' : 'Show stats'}
                </button>
            </div>

            {open && (
                <div className="mt-4 space-y-4">
                    {isFetching ? (
                        <p className="text-sm text-gray-500">Computing…</p>
                    ) : derived.length === 0 ? (
                        <p className="text-sm text-gray-500">No player stats derived yet — log some plays with players first.</p>
                    ) : (
                        <>
                            {/* Tabs & Team Filter Bar */}
                            <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                {/* Player vs Team Tabs */}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('players')}
                                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${activeTab === 'players' ? 'bg-sffl-navy text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}
                                    >
                                        🏃 Player Stats ({derived.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('teams')}
                                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${activeTab === 'teams' ? 'bg-sffl-navy text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}
                                    >
                                        🛡️ Team Stats ({derivedTeamStats.length})
                                    </button>
                                </div>

                                {/* Team Filter Pills (Player Stats view only) */}
                                {activeTab === 'players' && teamsList.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-gray-400 mr-1">Filter Team:</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeamId('all')}
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${selectedTeamId === 'all' ? 'bg-sffl-red text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}
                                        >
                                            All Teams
                                        </button>
                                        {teamsList.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setSelectedTeamId(t.id)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${selectedTeamId === t.id ? 'bg-sffl-red text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'}`}
                                            >
                                                {t.shortName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Render Stats Table */}
                            {activeTab === 'players' ? (
                                <StatsTable type="players" playerStats={filteredPlayerStats} />
                            ) : (
                                <StatsTable type="teams" teamStats={derivedTeamStats} />
                            )}

                            <button
                                onClick={commit}
                                disabled={!isAppAdmin || committing}
                                title={!isAppAdmin ? 'Commit restricted to App Admin' : 'Write stats to main table'}
                                className="mt-4 px-6 py-2.5 bg-sffl-navy text-white font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {committing ? 'Committing…' : 'Commit to main stats table →'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
