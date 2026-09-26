import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowDownIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    EyeIcon,
    EyeSlashIcon,
    FilmIcon,
    PencilSquareIcon,
    PhotoIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    getAdminHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
    type HeroSlide,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { getApiErrorMessage } from '../../utils/apiError';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

// Mirrors the backend's MaxHeroSlides constant. Keep these in sync — the
// server is the source of truth (it returns a 400 if exceeded), but matching
// it here lets us disable the "Add" button instead of letting the user start
// an upload that will be rejected.
const MAX_SLIDES = 5;

// A slide is just an image plus where it links to when clicked. To feature a
// news article, create it in the News admin first, then paste its link here.
interface SlideFormState {
    imageUrl: string;
    mobileImageUrl: string;
    destinationUrl: string;
}

const emptyForm: SlideFormState = {
    imageUrl: '', mobileImageUrl: '', destinationUrl: '',
};

const NO_SLIDES: HeroSlide[] = [];

type PendingAction =
    | { kind: 'save' }
    | { kind: 'toggle'; slide: HeroSlide; position: number }
    | { kind: 'move'; slide: HeroSlide; position: number; direction: 'up' | 'down' }
    | { kind: 'delete'; slide: HeroSlide; position: number };

const FAILURE: Record<PendingAction['kind'], string> = {
    save: 'Failed to save slide',
    toggle: 'Failed to update slide',
    move: 'Failed to reorder slides',
    delete: 'Failed to delete slide',
};

const slideButtonClass = 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-11 rounded-lg text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed';

export const AdminHeroSlides = () => {
    const queryClient = useQueryClient();
    const { data: slides = NO_SLIDES, isLoading } = useQuery({
        queryKey: ['adminHeroSlides'],
        queryFn: getAdminHeroSlides,
    });

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<SlideFormState>(emptyForm);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const sortedSlides = [...slides].sort((a, b) => a.display_order - b.display_order);
    const atCap = sortedSlides.length >= MAX_SLIDES;

    const set = <K extends keyof SlideFormState>(field: K, value: SlideFormState[K]) =>
        setForm(p => ({ ...p, [field]: value }));

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };

    const openEdit = (slide: HeroSlide) => {
        setEditingId(slide.id);
        setForm({
            imageUrl: slide.image_url,
            mobileImageUrl: slide.mobile_image_url || '',
            destinationUrl: slide.destination_url || '',
        });
        setShowModal(true);
    };

    const requestSave = () => {
        if (!form.imageUrl) { toast.error('Upload a desktop image first'); return; }
        setPendingAction({ kind: 'save' });
    };

    // Swap display_order between this slide and its neighbour. Cheap and
    // predictable — no drag-library needed for a 5-item list.
    const requestMove = (slide: HeroSlide, direction: 'up' | 'down') => {
        const index = sortedSlides.findIndex(s => s.id === slide.id);
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= sortedSlides.length) return;
        setPendingAction({ kind: 'move', slide, position: index + 1, direction });
    };

    // The modal closes and `busy` clears in the same synchronous step, so the
    // image fields unmount while still marked committed and keep their uploads.
    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            switch (action.kind) {
                case 'save':
                    if (editingId) {
                        await updateHeroSlide(editingId, {
                            image_url: form.imageUrl,
                            mobile_image_url: form.mobileImageUrl,
                            destination_url: form.destinationUrl.trim(),
                        });
                    } else {
                        await createHeroSlide({
                            image_url: form.imageUrl,
                            mobile_image_url: form.mobileImageUrl || undefined,
                            destination_url: form.destinationUrl.trim() || undefined,
                            display_order: sortedSlides.length, // append to end
                            is_active: true,
                        });
                    }
                    setShowModal(false);
                    toast.success(editingId ? 'Slide updated' : 'Slide added');
                    break;
                case 'toggle':
                    await updateHeroSlide(action.slide.id, { is_active: !action.slide.is_active });
                    toast.success(action.slide.is_active ? 'Slide hidden from the homepage' : 'Slide is showing on the homepage');
                    break;
                case 'move': {
                    const index = sortedSlides.findIndex(s => s.id === action.slide.id);
                    const other = sortedSlides[action.direction === 'up' ? index - 1 : index + 1];
                    if (!other) break;
                    await Promise.all([
                        updateHeroSlide(action.slide.id, { display_order: other.display_order }),
                        updateHeroSlide(other.id, { display_order: action.slide.display_order }),
                    ]);
                    toast.success('Slide order updated');
                    break;
                }
                case 'delete':
                    await deleteHeroSlide(action.slide.id);
                    toast.success('Slide deleted');
                    break;
            }
            queryClient.invalidateQueries({ queryKey: ['adminHeroSlides'] });
        } catch (err) {
            toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'toggle': {
                const { slide, position } = pendingAction;
                return {
                    title: slide.is_active ? 'Hide this slide?' : 'Show this slide?',
                    description: slide.is_active
                        ? 'It stays in the list but disappears from the homepage carousel.'
                        : 'It appears in the homepage carousel again.',
                    confirmLabel: slide.is_active ? 'Hide Slide' : 'Show Slide',
                    tone: 'info' as const,
                    icon: slide.is_active ? EyeSlashIcon : EyeIcon,
                    body: <ConfirmSummary rows={[['Slide', `#${position}`], ['Destination', slide.destination_url]]} />,
                };
            }
            case 'move': {
                const { slide, position, direction } = pendingAction;
                return {
                    title: `Move this slide ${direction}?`,
                    description: 'It swaps places with its neighbour in the carousel.',
                    confirmLabel: direction === 'up' ? 'Move Up' : 'Move Down',
                    tone: 'info' as const,
                    icon: direction === 'up' ? ArrowUpIcon : ArrowDownIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Slide', `#${position}`],
                            ['Moves to', `#${direction === 'up' ? position - 1 : position + 1}`],
                            ['Destination', slide.destination_url],
                        ]} />
                    ),
                };
            }
            case 'delete': {
                const { slide, position } = pendingAction;
                return {
                    title: 'Delete this slide?',
                    description: "Removes it from the homepage — this can't be undone.",
                    confirmLabel: 'Delete Slide',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={[['Slide', `#${position}`], ['Destination', slide.destination_url]]} />
                            <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                                <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    ),
                };
            }
            default:
                return {
                    title: editingId ? 'Save changes to this slide?' : 'Add this slide to the homepage?',
                    description: undefined,
                    confirmLabel: editingId ? 'Save Changes' : 'Add Slide',
                    tone: 'info' as const,
                    icon: editingId ? PencilSquareIcon : PlusIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Desktop image', form.imageUrl ? 'Uploaded' : undefined],
                            ['Mobile image', form.mobileImageUrl ? 'Uploaded' : 'Uses the desktop image'],
                            ['Destination', form.destinationUrl.trim() || 'None (not clickable)'],
                        ]} />
                    ),
                };
        }
    })();

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Hero Slides"
                subtitle={
                    <>
                        Up to {MAX_SLIDES} slides. {sortedSlides.length}/{MAX_SLIDES} used.
                        Each slide can link to a page or URL of your choice.
                    </>
                }
                actions={
                    <button
                        type="button"
                        onClick={openCreate}
                        disabled={atCap}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        title={atCap ? `Limit of ${MAX_SLIDES} reached — delete a slide to add another` : 'Add a new slide'}
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden="true" />
                        Add Slide
                    </button>
                }
            />

            {isLoading ? (
                <Loader />
            ) : sortedSlides.length === 0 ? (
                <div className="text-center py-12 sm:py-20 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <FilmIcon className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <p className="font-bold text-gray-700 dark:text-gray-300">No carousel slides yet.</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click "Add Slide" to upload your first one.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sortedSlides.map((slide, idx) => (
                        <div
                            key={slide.id}
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border ${slide.is_active ? 'border-gray-100 dark:border-gray-700' : 'border-yellow-300 dark:border-yellow-700'} flex flex-col`}
                        >
                            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                                <img
                                    src={slide.image_url}
                                    alt={`Slide ${idx + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute top-2 left-2 flex items-center gap-2">
                                    <span className="bg-sffl-navy/90 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded">
                                        #{idx + 1}
                                    </span>
                                    {!slide.is_active && (
                                        <span className="bg-yellow-500/90 text-yellow-950 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded">
                                            Hidden
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 space-y-3 flex-1 flex flex-col">
                                {slide.destination_url ? (
                                    <p className="flex items-center gap-1 text-[11px] text-sffl-red min-w-0">
                                        <ArrowRightIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{slide.destination_url}</span>
                                    </p>
                                ) : slide.news_slug ? (
                                    <p className="text-[11px] text-yellow-600 dark:text-yellow-400 italic wrap-break-word">
                                        Legacy article link: /news/{slide.news_slug} (set a destination above to override)
                                    </p>
                                ) : (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 italic">No destination set — slide won't be clickable.</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => requestMove(slide, 'up')}
                                        disabled={idx === 0}
                                        className={`${slideButtonClass} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200`}
                                    >
                                        <ArrowUpIcon className="w-4 h-4" aria-hidden="true" />
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => requestMove(slide, 'down')}
                                        disabled={idx === sortedSlides.length - 1}
                                        className={`${slideButtonClass} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200`}
                                    >
                                        <ArrowDownIcon className="w-4 h-4" aria-hidden="true" />
                                        Down
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(slide)}
                                        className={`${slideButtonClass} bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50`}
                                    >
                                        <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ kind: 'toggle', slide, position: idx + 1 })}
                                        className={`${slideButtonClass} ${slide.is_active
                                            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                                            : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                            }`}
                                    >
                                        {slide.is_active ? (
                                            <><EyeIcon className="w-4 h-4" aria-hidden="true" /> Showing</>
                                        ) : (
                                            <><EyeSlashIcon className="w-4 h-4" aria-hidden="true" /> Hidden</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingAction({ kind: 'delete', slide, position: idx + 1 })}
                                        className={`${slideButtonClass} flex-none bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50`}
                                    >
                                        <TrashIcon className="w-4 h-4" aria-hidden="true" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit modal */}
            {showModal && (
                <div className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                    {editingId ? 'Edit Carousel Slide' : 'Add Carousel Slide'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Recommended: <strong>2:1 aspect ratio</strong> — ideally 1920×960 or 2000×1000.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                aria-label="Close"
                                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <ImageUploadField
                                label="Desktop Image"
                                value={form.imageUrl}
                                onChange={(url) => set('imageUrl', url)}
                                folder="hero-slides"
                                maxSizeMB={15}
                                compression={{ maxSizeMB: 4, maxWidthOrHeight: 2560 }}
                                helperText="JPG, PNG or WEBP. 2:1 ratio (1920×960 or 2000×1000). Max 15MB."
                                isCommitted={busy}
                            />
                            <ImageUploadField
                                label="Mobile Image (optional)"
                                value={form.mobileImageUrl}
                                onChange={(url) => set('mobileImageUrl', url)}
                                folder="hero-slides"
                                maxSizeMB={15}
                                compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                                helperText="Square ~1080×1080 for phones. Leave empty to reuse the desktop image."
                                isCommitted={busy}
                            />

                            <hr className="border-gray-200 dark:border-gray-700" />

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Destination (optional)
                                </label>
                                <input
                                    type="text"
                                    value={form.destinationUrl}
                                    onChange={e => set('destinationUrl', e.target.value)}
                                    placeholder="/stats  or  /news/some-article-slug  or  https://example.com"
                                    className="w-full min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Where the slide links when clicked. Paste an internal path (e.g. <code>/stats</code>) or
                                    a full external URL. To link to a news article, create it first in the News admin, then
                                    paste its link here (e.g. <code>/news/its-slug</code>). Leave blank for a non-clickable slide.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gray-50 dark:bg-gray-800/90">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 min-h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={requestSave}
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-11 bg-sffl-red hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 transition-colors"
                            >
                                <PhotoIcon className="w-4 h-4" aria-hidden="true" />
                                {editingId ? 'Save Changes' : 'Add Slide'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
