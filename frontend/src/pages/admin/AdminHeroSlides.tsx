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
} from '@heroicons/react/24/outline';
import {
    getAdminHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
} from '../../services/api';
import type { HeroSlide } from '../../types';
import { Loader, Button, Field, ImageUploadField, Input, Modal, ConfirmDialog, ConfirmSummary, DashboardPageHeader } from '../../components';
import { getApiErrorMessage } from '../../utils';

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
                    const swapIndex = action.direction === 'up' ? index - 1 : index + 1;
                    if (swapIndex < 0 || swapIndex >= sortedSlides.length) break;
                    const reordered = [...sortedSlides];
                    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
                    // Renumber every slide to its new position rather than just
                    // swapping the two display_order values: if display_order
                    // ever ended up duplicated (e.g. a slide reused an order
                    // still held by another after a delete), swapping two equal
                    // values is a no-op and the move silently does nothing. A
                    // full renumber always produces a unique, correct order.
                    await Promise.all(
                        reordered.map((s, i) =>
                            s.display_order === i ? null : updateHeroSlide(s.id, { display_order: i }),
                        ),
                    );
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
            <DashboardPageHeader
                title="Hero Slides"
                subtitle={
                    <>
                        Up to {MAX_SLIDES} slides. {sortedSlides.length}/{MAX_SLIDES} used.
                        Each slide can link to a page or URL of your choice.
                    </>
                }
                actions={
                    <Button
                        icon={PlusIcon}
                        onClick={openCreate}
                        disabled={atCap}
                        className="w-full sm:w-auto"
                        title={atCap ? `Limit of ${MAX_SLIDES} reached — delete a slide to add another` : 'Add a new slide'}
                    >
                        Add Slide
                    </Button>
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
                                    <Button
                                        variant="secondary"
                                        icon={ArrowUpIcon}
                                        onClick={() => requestMove(slide, 'up')}
                                        disabled={idx === 0}
                                        className="flex-1"
                                    >
                                        Up
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        icon={ArrowDownIcon}
                                        onClick={() => requestMove(slide, 'down')}
                                        disabled={idx === sortedSlides.length - 1}
                                        className="flex-1"
                                    >
                                        Down
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-auto">
                                    <Button
                                        variant="secondary"
                                        icon={PencilSquareIcon}
                                        onClick={() => openEdit(slide)}
                                        className="flex-1"
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        icon={slide.is_active ? EyeIcon : EyeSlashIcon}
                                        onClick={() => setPendingAction({ kind: 'toggle', slide, position: idx + 1 })}
                                        className="flex-1"
                                    >
                                        {slide.is_active ? 'Showing' : 'Hidden'}
                                    </Button>
                                    <Button
                                        variant="danger"
                                        icon={TrashIcon}
                                        onClick={() => setPendingAction({ kind: 'delete', slide, position: idx + 1 })}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit modal */}
            {showModal && (
                <Modal
                    open
                    onClose={() => setShowModal(false)}
                    title={editingId ? 'Edit Carousel Slide' : 'Add Carousel Slide'}
                    subtitle="Recommended: 2:1 aspect ratio — ideally 1920×960 or 2000×1000."
                    maxWidth="2xl"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button icon={PhotoIcon} onClick={requestSave} disabled={busy}>
                                {editingId ? 'Save Changes' : 'Add Slide'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
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

                            <Field
                                label="Destination (optional)"
                                htmlFor="slide-destination"
                                hint="Where the slide links when clicked. Use an internal path such as /stats, a full external URL, or a news link such as /news/its-slug. Leave blank for a non-clickable slide."
                            >
                                <Input
                                    id="slide-destination"
                                    type="text"
                                    value={form.destinationUrl}
                                    onChange={e => set('destinationUrl', e.target.value)}
                                    placeholder="/stats  or  /news/some-article-slug  or  https://example.com"
                                />
                            </Field>
                        </div>
                </Modal>
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
