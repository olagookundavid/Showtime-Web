import type { Competition } from '../../services/api';

interface SeasonPlayoffTabsProps {
    competitions: Competition[];
    currentId: string;
    onChange: (id: string) => void;
    className?: string;
}

// Two prominent, SEPARATE tabs ("Season" | "Playoffs") that toggle the selected
// competition between a league and its linked playoff (KNOCKOUT). The active tab
// uses the brand red (sffl-red) for urgency. Replaces the old switch button.
// Derives everything from the competitions list + the current id, so pages just
// pass their existing competition-change handler.
export const SeasonPlayoffTabs = ({ competitions, currentId, onChange, className = '' }: SeasonPlayoffTabsProps) => {
    const current = competitions.find(c => c.id === currentId);
    if (!current) return null; // e.g. "All Competitions" / nothing selected — no context for tabs

    const isPlayoff = current.format === 'KNOCKOUT';
    const league = isPlayoff
        ? competitions.find(c => c.playoff_competition_id === current.id)
        : current;
    const playoff = isPlayoff
        ? current
        : (current.playoff_competition_id ? competitions.find(c => c.id === current.playoff_competition_id) : undefined);

    // Bigger, separated pills. Active = solid red (urgency); inactive = outlined
    // and clickable; disabled = muted.
    const base = 'flex-1 sm:flex-none px-6 md:px-10 py-2 md:py-2 rounded-xl text-sm md:text-base font-black uppercase tracking-wide transition-all duration-200';
    const active = 'bg-sffl-red text-white shadow-lg shadow-sffl-red/30 hover:bg-red-700 scale-[1.02]';
    const inactive = 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-sffl-navy dark:text-gray-200 hover:border-sffl-red hover:text-sffl-red active:scale-95';
    const disabled = 'bg-gray-100 dark:bg-gray-800/50 border-2 border-transparent text-gray-400 dark:text-gray-600 opacity-60 cursor-not-allowed';

    return (
        <div className={`flex gap-2 sm:gap-3 w-full sm:w-auto ${className}`}>
            <button
                type="button"
                onClick={() => { if (league && isPlayoff) onChange(league.id); }}
                disabled={!league}
                className={`${base} ${!isPlayoff ? active : (league ? inactive : disabled)}`}
            >
                Season
            </button>
            <button
                type="button"
                onClick={() => { if (playoff && !isPlayoff) onChange(playoff.id); }}
                disabled={!playoff}
                className={`${base} ${isPlayoff ? active : (playoff ? inactive : disabled)}`}
            >
                <span aria-hidden="true">🏆</span> Playoffs
            </button>
        </div>
    );
};
