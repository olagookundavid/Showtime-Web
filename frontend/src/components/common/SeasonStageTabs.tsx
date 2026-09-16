import type { Competition } from '../../services/api';

interface SeasonStageTabsProps {
    competitions: Competition[];
    currentId: string;
    onChange: (id: string) => void;
    className?: string;
}

const STAGES: { format: string; label: string }[] = [
    { format: 'PRESEASON', label: 'Preseason' },
    { format: 'SEASON', label: 'Season' },
    { format: 'PLAYOFFS', label: '🏆 Playoffs' },
    { format: 'CUP', label: 'Cup' },
];

// Up to four tabs (Preseason | Season | Playoffs | Cup) that switch the
// selected competition between every stage attached to the same season. The
// active tab uses the brand red (sffl-red) for urgency; a stage with no
// competition for this season is disabled rather than hidden, so the layout
// stays stable as seasons gain/lose stages over time.
// Derives everything from the competitions list + the current id, so pages
// just pass their existing competition-change handler.
export const SeasonStageTabs = ({ competitions, currentId, onChange, className = '' }: SeasonStageTabsProps) => {
    const current = competitions.find(c => c.id === currentId);
    if (!current) return null; // e.g. "All Competitions" / nothing selected — no context for tabs

    const seasonId = current.format === 'SEASON' ? current.id : current.season_id;
    if (!seasonId) return null; // an orphaned stage with no season link has nothing to switch between

    const stageComps = STAGES.map(stage => ({
        ...stage,
        comp: stage.format === 'SEASON'
            ? competitions.find(c => c.id === seasonId)
            : competitions.find(c => c.season_id === seasonId && c.format === stage.format),
    }));

    // Bigger, separated pills. Active = solid red (urgency); inactive = outlined
    // and clickable; disabled = muted.
    const base = 'flex-1 sm:flex-none px-6 md:px-10 py-2 md:py-2 rounded-xl text-sm md:text-base font-black uppercase tracking-wide transition-all duration-200';
    const active = 'bg-sffl-red text-white shadow-lg shadow-sffl-red/30 hover:bg-red-700 scale-[1.02]';
    const inactive = 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-sffl-navy dark:text-gray-200 hover:border-sffl-red hover:text-sffl-red active:scale-95';
    const disabled = 'bg-gray-100 dark:bg-gray-800/50 border-2 border-transparent text-gray-400 dark:text-gray-600 opacity-60 cursor-not-allowed';

    return (
        <div className={`flex gap-2 sm:gap-3 w-full sm:w-auto ${className}`}>
            {stageComps.map(({ format, label, comp }) => {
                const isActive = comp?.id === currentId;
                return (
                    <button
                        key={format}
                        type="button"
                        onClick={() => { if (comp && !isActive) onChange(comp.id); }}
                        disabled={!comp}
                        className={`${base} ${isActive ? active : (comp ? inactive : disabled)}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
};
