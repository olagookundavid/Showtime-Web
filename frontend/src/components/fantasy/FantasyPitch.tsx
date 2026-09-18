import { useMemo, useState } from 'react';
import type { FantasyLineupPick, FantasySlot } from '../../services/api';
import { FantasyPlayerModal, type FantasyPlayerModalData } from './FantasyPlayerModal';

/**
 * The starting fourteen, laid out on a flag football field.
 *
 * A two-column list tells you who is in the squad; it does not tell you the
 * shape of the team. Putting the slots where they actually stand — defence
 * above the line of scrimmage, offence below it — makes the 7v7 split and any
 * hole in the side readable at a glance.
 */

interface PitchSpot {
    slot: FantasySlot;
    /** Short label on the shirt. */
    code: string;
    /** Full role name, for the detail strip and screen readers. */
    role: string;
    unit: 'OFFENSE' | 'DEFENSE';
    /** Percentages across and down the field. */
    x: number;
    y: number;
}

/**
 * Positions for the real fourteen slots, not a generic formation.
 *
 * The roster is 1 rusher + 6 defenders and 2 quarterback-ish slots + 5
 * receivers, so the shape is drawn from SlotSpecs in the backend's
 * domain/fantasy.go rather than from a stock flag football diagram: DEF_5 and
 * DEF_6 sit deep where safeties would, and REC_3 takes the middle where a
 * centre would stand.
 */
const PITCH_SPOTS: PitchSpot[] = [
    // Defence — above the line of scrimmage, deepest first.
    { slot: 'DEF_5', code: 'DEF 5', role: 'Defender 5', unit: 'DEFENSE', x: 34, y: 19 },
    { slot: 'DEF_6', code: 'DEF 6', role: 'Defender 6', unit: 'DEFENSE', x: 66, y: 19 },
    { slot: 'RUSHER', code: 'RUSH', role: 'Pass Rusher', unit: 'DEFENSE', x: 50, y: 31 },
    { slot: 'DEF_1', code: 'DEF 1', role: 'Defender 1', unit: 'DEFENSE', x: 15, y: 39 },
    { slot: 'DEF_2', code: 'DEF 2', role: 'Defender 2', unit: 'DEFENSE', x: 38, y: 39 },
    { slot: 'DEF_3', code: 'DEF 3', role: 'Defender 3', unit: 'DEFENSE', x: 62, y: 39 },
    { slot: 'DEF_4', code: 'DEF 4', role: 'Defender 4', unit: 'DEFENSE', x: 82, y: 36 },

    // Offence — below the line of scrimmage, spaced out for names and positions.
    { slot: 'REC_3', code: 'WR 3', role: 'Wide Receiver 3', unit: 'OFFENSE', x: 50, y: 55 },
    { slot: 'REC_1', code: 'WR 1', role: 'Wide Receiver 1', unit: 'OFFENSE', x: 11, y: 61 },
    { slot: 'REC_2', code: 'WR 2', role: 'Wide Receiver 2', unit: 'OFFENSE', x: 30, y: 64 },
    { slot: 'REC_4', code: 'WR 4', role: 'Wide Receiver 4', unit: 'OFFENSE', x: 70, y: 64 },
    { slot: 'REC_5', code: 'WR 5', role: 'Wide Receiver 5', unit: 'OFFENSE', x: 89, y: 61 },
    { slot: 'QB_F', code: 'QB ♀', role: 'Female QB or Receiver', unit: 'OFFENSE', x: 50, y: 69.5 },
    { slot: 'QB_M', code: 'QB', role: 'Male Starting QB', unit: 'OFFENSE', x: 50, y: 83.5 },
];

/** Surname only, so a name fits under a 50px shirt without wrapping to three lines. */
function shortName(full?: string): string {
    if (!full) return '';
    const parts = full.trim().split(/\s+/);
    return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

/**
 * The bracket text for an unfilled slot — what the manager still needs to
 * fill it, not a slot code. A Record over FantasySlot rather than a field on
 * PitchSpot: TypeScript then refuses to compile if a slot is ever added to
 * one list and not the other.
 */
const SPOT_POSITION_LABEL: Record<FantasySlot, string> = {
    QB_M: 'QB',
    QB_F: 'QB or Receiver',
    REC_1: 'Receiver',
    REC_2: 'Receiver',
    REC_3: 'Receiver',
    REC_4: 'Receiver',
    REC_5: 'Receiver',
    RUSHER: 'Rusher',
    DEF_1: 'Defender',
    DEF_2: 'Defender',
    DEF_3: 'Defender',
    DEF_4: 'Defender',
    DEF_5: 'Defender',
    DEF_6: 'Defender',
};

/**
 * Collapses the spellings the roster has accumulated for a position into one
 * display form. Mirrors domain.IsAllrounderRole on the backend — an
 * All-Rounder is a real position that can fill any slot, so it needs its own
 * word rather than silently inheriting the slot's expected position.
 */
function normalizePosition(pos?: string): string {
    const p = (pos || '').trim();
    switch (p.toUpperCase()) {
        case 'ALLROUNDER':
        case 'ALL-ROUNDER':
        case 'ALL ROUNDER':
        case 'AR':
            return 'All-Rounder';
        case 'CENTRE':
            return 'Center';
        default:
            // QB / Receiver / Center / Rusher / Defender pass through as-is.
            // Anything else is shown verbatim rather than swallowed, so a
            // position the table below doesn't know about is still visible.
            return p;
    }
}

/**
 * A shirt colour per real position, not the offense/defense binary — a
 * Center filling a receiver slot, or an All-Rounder filling anything, should
 * not look the same as a plain Receiver.
 */
const POSITION_STYLE: Record<string, { avatar: string; label: string; chipBg: string; chipText: string }> = {
    QB: { avatar: 'linear-gradient(150deg,#f9776a,#b72f32)', label: '#fca5a5', chipBg: 'bg-sffl-red', chipText: 'text-white' },
    Receiver: { avatar: 'linear-gradient(150deg,#fcd34d,#b45309)', label: '#fde68a', chipBg: 'bg-amber-400', chipText: 'text-amber-950' },
    Center: { avatar: 'linear-gradient(150deg,#c4b5fd,#6d28d9)', label: '#ddd6fe', chipBg: 'bg-violet-400', chipText: 'text-violet-950' },
    Rusher: { avatar: 'linear-gradient(150deg,#6ee7b7,#047857)', label: '#a7f3d0', chipBg: 'bg-emerald-400', chipText: 'text-emerald-950' },
    Defender: { avatar: 'linear-gradient(150deg,#99cafa,#37699f)', label: '#bfdbfe', chipBg: 'bg-[#7fbbfa]', chipText: 'text-[#0d2440]' },
    'All-Rounder': { avatar: 'linear-gradient(150deg,#67e8f9,#0e7490)', label: '#a5f3fc', chipBg: 'bg-cyan-400', chipText: 'text-cyan-950' },
};

function styleFor(position: string | undefined, unit: 'OFFENSE' | 'DEFENSE') {
    const key = normalizePosition(position);
    if (key && POSITION_STYLE[key]) return POSITION_STYLE[key];
    // A position the table doesn't recognise (or none on file) falls back to
    // the offense/defense split, so the shirt is never left uncoloured.
    return unit === 'DEFENSE' ? POSITION_STYLE.Defender : POSITION_STYLE.QB;
}

interface FantasyPitchProps {
    picks: FantasyLineupPick[];
    /** Shown in the header, e.g. "Gameweek 3". */
    gameweekLabel?: string;
    /** Gameweek ID for scoring breakdown queries */
    gameweekId?: string;
    /** Hides the points column before a gameweek has been scored. */
    showPoints?: boolean;
    title?: string;
    onPlayerClick?: (pick: FantasyLineupPick) => void;
}

export function FantasyPitch({
    picks,
    gameweekLabel,
    gameweekId,
    showPoints = true,
    title = 'My starting lineup',
    onPlayerClick,
}: FantasyPitchProps) {
    const bySlot = useMemo(() => {
        const map = new Map<FantasySlot, FantasyLineupPick>();
        for (const p of picks) map.set(p.slot, p);
        return map;
    }, [picks]);

    // Opens on the QB, so the strip is never empty on arrival.
    const [selected, setSelected] = useState<FantasySlot>('QB_M');
    const [inspectingPlayer, setInspectingPlayer] = useState<FantasyPlayerModalData | null>(null);

    const openPlayerProfile = (pick: FantasyLineupPick) => {
        setInspectingPlayer({
            playerId: pick.player_id,
            playerName: pick.player_name || 'Player',
            playerImage: pick.player_image,
            position: pick.position,
            gender: pick.gender,
            teamName: pick.team_name,
            teamShortName: pick.team_short_name,
            teamLogo: pick.team_logo,
            price: pick.current_price ?? pick.purchase_price,
            currentPrice: pick.current_price,
            purchasePrice: pick.purchase_price,
            points: pick.points,
            gameweekId: gameweekId,
        });
        if (onPlayerClick) onPlayerClick(pick);
    };

    const filled = PITCH_SPOTS.filter(s => bySlot.has(s.slot)).length;
    const offenseFilled = PITCH_SPOTS.filter(s => s.unit === 'OFFENSE' && bySlot.has(s.slot)).length;
    const defenseFilled = PITCH_SPOTS.filter(s => s.unit === 'DEFENSE' && bySlot.has(s.slot)).length;

    const activeSpot = PITCH_SPOTS.find(s => s.slot === selected) ?? PITCH_SPOTS[0];
    const activePick = bySlot.get(activeSpot.slot);
    const activeStyle = styleFor(activePick?.position, activeSpot.unit);

    return (
        <div className="rounded-2xl md:rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-sffl-navy">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-[#102447] to-[#07162b] border-b border-white/15">
                <div className="min-w-0 flex-1">
                    {gameweekLabel && (
                        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#91a6c7]">
                            Fantasy · {gameweekLabel}
                        </span>
                    )}
                    <h3 className="text-lg md:text-xl font-black text-white leading-tight mt-0.5">{title}</h3>
                </div>
                <div className="text-right shrink-0">
                    <span className="block text-white font-black text-xl md:text-2xl leading-tight tabular-nums">
                        {filled} / 14
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.1em] text-[#aebdd0]">
                        Starting players
                    </span>
                </div>
            </div>

            {/* Key */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 bg-[#102746] text-xs text-[#dbe5f1]">
                <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-sffl-red" /> Offense <b>{offenseFilled}</b>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7fbbfa]" /> Defense <b>{defenseFilled}</b>
                </span>
                <span className="hidden sm:inline text-[#aebdd0]">7 v 7 formation</span>
            </div>

            {/* Field */}
            <div className="p-2 sm:p-3 bg-[#102746]">
                <div
                    className="relative h-[640px] sm:h-[720px] overflow-hidden rounded-xl border-2 border-[#d1ebd15c]"
                    style={{
                        // Alternating mown stripes, with a lighter seam between each.
                        backgroundImage:
                            'repeating-linear-gradient(to bottom, transparent 0, transparent calc(20% - 2px), #e3f6d222 calc(20% - 1px), #e3f6d222 20%), repeating-linear-gradient(to bottom, #194b3b 0, #194b3b 20%, #164535 20%, #164535 40%)',
                        boxShadow: 'inset 0 0 65px #06180e66',
                    }}
                    role="group"
                    aria-label={`Starting lineup: ${filled} of 14 positions filled`}
                >
                    {/* Sidelines */}
                    <span className="absolute top-[13%] bottom-[13%] left-[4%] w-px bg-[#d8efd545]" />
                    <span className="absolute top-[13%] bottom-[13%] right-[4%] w-px bg-[#d8efd545]" />

                    {/* End zones */}
                    <div className="absolute inset-x-0 top-0 h-[10%] flex items-center justify-center bg-[#102d2bb0] border-b border-[#e8f5e054] text-white/20 font-black italic tracking-[0.24em] text-2xl sm:text-4xl pointer-events-none select-none">
                        SHOWTIME
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[10%] flex items-center justify-center bg-[#102d2bb0] border-t border-[#e8f5e054] text-white/20 font-black italic tracking-[0.24em] text-2xl sm:text-4xl pointer-events-none select-none">
                        FANTASY
                    </div>

                    {/* Unit labels */}
                    <span className="absolute left-[5.5%] top-[11.5%] text-[10px] sm:text-[11px] font-black tracking-[0.18em] text-[#dcf0dfad] pointer-events-none">
                        DEFENSE
                    </span>
                    <span className="absolute left-[5.5%] top-[51%] text-[10px] sm:text-[11px] font-black tracking-[0.18em] text-[#dcf0dfad] pointer-events-none">
                        OFFENSE
                    </span>

                    {/* Line of scrimmage */}
                    <div className="absolute left-[3%] right-[3%] top-[49%] border-t-2 border-dashed border-[#efede6ac] pointer-events-none" />
                    <span className="absolute top-[49%] right-[2.5%] -translate-y-1/2 bg-[#f5f1e8] text-[#123b31] rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black tracking-[0.12em] pointer-events-none shadow-sm z-[2]">
                        LINE OF SCRIMMAGE
                    </span>

                    {/* Players */}
                    {PITCH_SPOTS.map(spot => {
                        const pick = bySlot.get(spot.slot);
                        const isActive = selected === spot.slot;
                        const empty = !pick;
                        const style = styleFor(pick?.position, spot.unit);
                        const isFemale = (pick?.gender || '').toUpperCase().startsWith('F');
                        const positionLabel = empty
                            ? SPOT_POSITION_LABEL[spot.slot]
                            : normalizePosition(pick.position) || SPOT_POSITION_LABEL[spot.slot];

                        return (
                            <button
                                key={spot.slot}
                                type="button"
                                onClick={() => {
                                    setSelected(spot.slot);
                                    if (pick) {
                                        openPlayerProfile(pick);
                                    }
                                }}
                                aria-pressed={isActive}
                                aria-label={
                                    empty
                                        ? `${spot.role} — no player selected`
                                        : `${spot.role}: ${pick.player_name ?? 'Unnamed player'}, ${positionLabel}, ${isFemale ? 'female' : 'male'} - click to view profile`
                                }
                                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 sm:gap-1 w-[64px] sm:w-[84px] px-0.5 py-0.5 cursor-pointer transition hover:brightness-110 focus-visible:outline-none focus-visible:brightness-110 z-[3]"
                                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                            >
                                {/* Shirt — the pic with outside gender badge */}
                                <div className="relative">
                                    <span
                                        className={`relative block w-10 h-10 sm:w-[46px] sm:h-[46px] rounded-full border-2 overflow-hidden ${
                                            empty
                                                ? 'border-dashed border-white/40 bg-white/10'
                                                : 'border-white/75'
                                        } ${isActive && !empty ? 'ring-[3px] ring-white ring-offset-2 ring-offset-[#f9d16b]' : ''}`}
                                        style={empty ? undefined : { backgroundImage: style.avatar, boxShadow: '0 5px 13px #051a13a8' }}
                                    >
                                        {pick?.player_image ? (
                                            <img
                                                src={pick.player_image}
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        ) : empty ? (
                                            <span className="absolute inset-0 flex items-center justify-center text-white/60 text-lg font-black leading-none">
                                                +
                                            </span>
                                        ) : (
                                            // The generic figure from the mockup: head and shoulders.
                                            <>
                                                <span className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[22%] h-[24%] rounded-full bg-white" />
                                                <span className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[56%] h-[40%] rounded-t-full bg-white" />
                                            </>
                                        )}
                                    </span>

                                    {/* Gender mark, placed OUTSIDE the circular avatar so it never covers the player's photo */}
                                    {!empty && (
                                        <span
                                            aria-hidden="true"
                                            className={`absolute -top-1 -right-1 z-10 flex items-center justify-center w-[15px] h-[15px] sm:w-[17px] sm:h-[17px] rounded-full border-2 border-white shadow text-[8px] sm:text-[9px] font-black leading-none ${
                                                isFemale ? 'bg-pink-500 text-white' : 'bg-blue-500 text-white'
                                            }`}
                                        >
                                            {isFemale ? '♀' : '♂'}
                                        </span>
                                    )}
                                </div>

                                {/* Name */}
                                {!empty && (
                                    <span className="block max-w-full truncate text-[9px] sm:text-[10px] font-bold text-white leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                                        {shortName(pick.player_name)}
                                    </span>
                                )}

                                {/* Position, in brackets */}
                                <span
                                    className="block max-w-full text-center text-[9px] sm:text-[10px] font-bold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                    style={{ color: empty ? 'rgba(255,255,255,0.65)' : style.label }}
                                >
                                    ({positionLabel})
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Detail strip */}
            <div
                className="flex items-center gap-3 px-5 py-3 border-t border-white/15 bg-[#0c203a] min-h-[64px]"
                aria-live="polite"
            >
                <span
                    className={`flex items-center justify-center min-w-[46px] h-9 px-1.5 rounded text-[11px] font-black shrink-0 ${activeStyle.chipBg} ${activeStyle.chipText}`}
                >
                    {activeSpot.code}
                </span>
                <div className="min-w-0 flex-1">
                    <strong className="block text-sm text-white truncate">
                        {activePick?.player_name ?? activeSpot.role}
                    </strong>
                    <small className="block mt-0.5 text-[11px] text-[#afc1d4] truncate">
                        {activePick
                            ? `${activeSpot.role} · ${activePick.team_short_name || activePick.team_name || '—'}`
                            : 'No player in this position yet'}
                    </small>
                </div>
                {showPoints && activePick && (
                    <div className="text-right shrink-0">
                        <span className="block text-lg font-black text-white tabular-nums leading-none">
                            {(activePick.points ?? 0).toFixed(2)}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-[#afc1d4] mt-0.5">
                            pts
                        </span>
                    </div>
                )}
                {activePick && (
                    <button
                        type="button"
                        onClick={() => openPlayerProfile(activePick)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition cursor-pointer shrink-0 ml-1"
                    >
                        View Profile
                    </button>
                )}
            </div>

            {/* Player Fantasy Profile Modal */}
            <FantasyPlayerModal
                isOpen={Boolean(inspectingPlayer)}
                onClose={() => setInspectingPlayer(null)}
                player={inspectingPlayer}
            />
        </div>
    );
}
