import { CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { BadgeImage } from '../domain';
import { Button, Spinner } from '../ui';
import type { BadgeIcon } from '../../types';

interface BadgeArtworkPickerProps {
    icons: BadgeIcon[];
    loading?: boolean;
    /** The badge's current artwork (an image URL, or an emoji on the oldest badges). */
    value: string;
    onChange: (imageUrl: string) => void;
    /** Opens the Badge Library, where artwork is added and changed. */
    onManageLibrary: () => void;
}

/**
 * Picks a badge's artwork from the Badge Library. Picking only sets the image:
 * the badge's name, category and description stay as they are. Adding or
 * changing artwork happens in the library itself, not here.
 */
export const BadgeArtworkPicker = ({ icons, loading = false, value, onChange, onManageLibrary }: BadgeArtworkPickerProps) => {
    const current = value.trim();
    const notInLibrary = Boolean(current) && !icons.some((ic) => ic.image_url === current);

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Artwork *</span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">Pick the badge's image from the Badge Library.</span>
                </div>
                <Button variant="link" size="sm" icon={PhotoIcon} onClick={onManageLibrary}>
                    Manage the library
                </Button>
            </div>

            {loading ? (
                <Spinner size="sm" className="py-6" />
            ) : icons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                    The Badge Library is empty. Add artwork there first, then pick it here.
                </div>
            ) : (
                <div
                    role="radiogroup"
                    aria-label="Badge artwork"
                    className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto"
                >
                    {notInLibrary && (
                        <div className="relative p-2.5 rounded-xl border bg-amber-500/10 border-amber-500 ring-2 ring-amber-400/50 flex flex-col items-center text-center">
                            <div className="w-12 h-12 flex items-center justify-center p-1">
                                <BadgeImage icon={current} name="Current artwork" className="w-full h-full text-2xl" />
                            </div>
                            <span className="mt-1.5 text-[10px] font-black leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">
                                Current (not in library)
                            </span>
                        </div>
                    )}
                    {icons.map((ic) => {
                        const selected = ic.image_url === current;
                        return (
                            <button
                                key={ic.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => onChange(ic.image_url)}
                                className={`relative min-h-11 p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                                    selected
                                        ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/50 shadow-md'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-400'
                                }`}
                            >
                                <div className="w-12 h-12 flex items-center justify-center p-1">
                                    <img src={ic.image_url} alt="" className="w-full h-full object-contain drop-shadow-xs" />
                                </div>
                                <span className="mt-1.5 text-[10px] font-black leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">{ic.name}</span>
                                {selected && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-sffl-navy flex items-center justify-center shadow-xs">
                                        <CheckIcon className="w-3 h-3 stroke-3" aria-hidden="true" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
