import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAdminHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
    type HeroSlide,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui';

// Mirrors the backend's MaxHeroSlides constant. Keep these in sync — the
// server is the source of truth (it returns a 400 if exceeded), but matching
// it here lets us disable the "Add" button instead of letting the user start
// an upload that will be rejected.
const MAX_SLIDES = 5;

export const AdminHeroSlides = () => {
    const queryClient = useQueryClient();
    const { data: slides = [], isLoading } = useQuery({
        queryKey: ['adminHeroSlides'],
        queryFn: getAdminHeroSlides,
    });

    const [showModal, setShowModal] = useState(false);
    const [pendingImageUrl, setPendingImageUrl] = useState('');
    const [pendingMobileImageUrl, setPendingMobileImageUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<HeroSlide | null>(null);

    const sortedSlides = [...slides].sort((a, b) => a.display_order - b.display_order);
    const atCap = sortedSlides.length >= MAX_SLIDES;

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminHeroSlides'] });

    const handleCreate = async () => {
        if (!pendingImageUrl) {
            setError('Upload an image first');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await createHeroSlide({
                image_url: pendingImageUrl,
                mobile_image_url: pendingMobileImageUrl || undefined,
                display_order: sortedSlides.length, // append to end
                is_active: true,
            });
            refresh();
            setShowModal(false);
            setPendingImageUrl('');
            setPendingMobileImageUrl('');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add slide');
        }
        setSaving(false);
    };

    // Set/replace/clear the optional mobile image on an existing slide. Persists
    // immediately (the carousel falls back to the desktop image when empty).
    const handleSetMobile = async (slide: HeroSlide, url: string) => {
        await updateHeroSlide(slide.id, { mobile_image_url: url });
        refresh();
    };

    const handleToggleActive = async (slide: HeroSlide) => {
        await updateHeroSlide(slide.id, { is_active: !slide.is_active });
        refresh();
    };

    // Swap display_order between this slide and its neighbour. Cheap and
    // predictable — no drag-library needed for a 5-item list.
    const handleMove = async (slide: HeroSlide, direction: 'up' | 'down') => {
        const index = sortedSlides.findIndex(s => s.id === slide.id);
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= sortedSlides.length) return;
        const other = sortedSlides[swapIndex];
        await Promise.all([
            updateHeroSlide(slide.id, { display_order: other.display_order }),
            updateHeroSlide(other.id, { display_order: slide.display_order }),
        ]);
        refresh();
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteHeroSlide(id);
            refresh();
            setDeleteConfirm(null);
        } catch (err) {
            console.error(err);
            alert('Failed to delete slide');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Homepage Carousel</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Up to {MAX_SLIDES} slides. {sortedSlides.length}/{MAX_SLIDES} used.
                    </p>
                </div>
                <button
                    onClick={() => { setPendingImageUrl(''); setError(''); setShowModal(true); }}
                    disabled={atCap}
                    className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    title={atCap ? `Limit of ${MAX_SLIDES} reached — delete a slide to add another` : 'Add a new slide'}
                >
                    + Add Slide
                </button>
            </div>

            {isLoading ? (
                <Loader />
            ) : sortedSlides.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="text-5xl mb-4">🎞️</div>
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
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleMove(slide, 'up')}
                                        disabled={idx === 0}
                                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition"
                                        title="Move up"
                                    >
                                        ↑ Up
                                    </button>
                                    <button
                                        onClick={() => handleMove(slide, 'down')}
                                        disabled={idx === sortedSlides.length - 1}
                                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition"
                                        title="Move down"
                                    >
                                        ↓ Down
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleActive(slide)}
                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${slide.is_active
                                            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
                                            : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                            }`}
                                    >
                                        {slide.is_active ? '✓ Showing' : '○ Hidden'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(slide)}
                                        className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg text-xs font-bold transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <ImageUploadField
                                        label="Mobile Image (optional)"
                                        value={slide.mobile_image_url || ''}
                                        onChange={(url) => handleSetMobile(slide, url)}
                                        folder="hero-slides"
                                        maxSizeMB={15}
                                        compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                                        helperText="Square ~1080×1080. Falls back to the desktop image on phones if empty."
                                        isCommitted
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Add Carousel Slide</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Recommended: <strong>2:1 aspect ratio</strong> — ideally 1920×960 or 2000×1000.
                                Other ratios get cropped to fit the carousel.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <ImageUploadField
                                label="Desktop Image"
                                value={pendingImageUrl}
                                onChange={(url) => setPendingImageUrl(url)}
                                folder="hero-slides"
                                maxSizeMB={15}
                                compression={{ maxSizeMB: 4, maxWidthOrHeight: 2560 }}
                                helperText="JPG, PNG or WEBP. 2:1 ratio (1920×960 or 2000×1000). Max 15MB."
                                isCommitted={saving}
                            />
                            <ImageUploadField
                                label="Mobile Image (optional)"
                                value={pendingMobileImageUrl}
                                onChange={(url) => setPendingMobileImageUrl(url)}
                                folder="hero-slides"
                                maxSizeMB={15}
                                compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                                helperText="Square ~1080×1080 for phones. Leave empty to reuse the desktop image."
                                isCommitted={saving}
                            />
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowModal(false); setPendingImageUrl(''); setPendingMobileImageUrl(''); }}
                                className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving || !pendingImageUrl}
                                className="px-4 py-2 min-h-[44px] bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
                            >
                                {saving ? 'Saving...' : 'Add Slide'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete this slide?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                            Removes it from the homepage immediately. The image stays in R2 — clean those up separately if needed.
                        </p>
                        <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-5">
                            <img src={deleteConfirm.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.id)}
                                className="px-4 py-2 min-h-[44px] bg-red-600 text-white font-bold rounded-lg text-sm hover:bg-red-700 transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
