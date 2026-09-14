/**
 * Presentation for a player who has been deleted.
 *
 * Deleting a player deactivates them rather than removing the row (migration
 * 087), so their stats, appearances and match history all survive and they keep
 * showing up in last season's tables. The rule everywhere is the same: still
 * listed, still searchable, visibly not current.
 *
 * Two pieces, because callers need different amounts of it:
 *   isDeletedPlayer  - the one place the status string is interpreted
 *   DeletedPlayerName - name + dimming + the explanatory tooltip
 *   deletedRowClass  - for dimming a whole row or card
 */

const DELETED_TITLE = 'This player has been deleted';

/**
 * A player is current unless explicitly marked inactive. Defaulting to active
 * matters: responses from before this field existed, and the many endpoints
 * that never select it, both omit it — and treating those as deleted would grey
 * out most of the app.
 */
export function isDeletedPlayer(player?: { status?: string | null } | null): boolean {
    return (player?.status ?? 'active').toLowerCase() === 'inactive';
}

/** Dimming for a whole row, card or cell. Empty string when the player is current. */
export function deletedRowClass(deleted: boolean): string {
    return deleted ? 'opacity-50 grayscale' : '';
}

interface DeletedPlayerNameProps {
    name: string;
    deleted: boolean;
    /** Extra classes for the wrapper, so callers keep their own typography. */
    className?: string;
    /** Show the word "deleted" beside the name, for dense tables where dimming alone reads as a rendering glitch. */
    showLabel?: boolean;
}

export function DeletedPlayerName({ name, deleted, className = '', showLabel = false }: DeletedPlayerNameProps) {
    if (!deleted) {
        return <span className={className}>{name}</span>;
    }

    return (
        // title gives the hover explanation without pulling in a tooltip
        // library, and unlike a custom tooltip it also works on keyboard focus
        // and is read by screen readers.
        <span
            className={`text-gray-400 dark:text-gray-500 line-through decoration-1 ${className}`}
            title={DELETED_TITLE}
        >
            {name}
            {showLabel && (
                <span
                    className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-tight text-gray-400 dark:text-gray-500 no-underline"
                    title={DELETED_TITLE}
                >
                    (deleted)
                </span>
            )}
        </span>
    );
}

export { DELETED_TITLE };
