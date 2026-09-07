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

export const AdminHeroSlides = () => {
    const queryClient = useQueryClient();
    const { data: slides = [], isLoading } = useQuery({
        queryKey: ['adminHeroSlides'],
        queryFn: getAdminHeroSlides,
    });

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<SlideFormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<HeroSlide | null>(null);

    const sortedSlides = [...slides].sort((a, b) => a.display_order - b.display_order);
    const atCap = sortedSlides.length >= MAX_SLIDES;

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminHeroSlides'] });
    const set = <K extends keyof SlideFormState>(field: K, value: SlideFormState[K]) =>
        setForm(p => ({ ...p, [field]: value }));

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setShowModal(true); };

    const openEdit = (slide: HeroSlide) => {
        setEditingId(slide.id);
        setForm({
            imageUrl: slide.image_url,
            mobileImageUrl: slide.mobile_image_url || '',
            destinationUrl: slide.destination_url || '',
        });
        setError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.imageUrl) { setError('Upload a desktop image first'); return; }

        setSaving(true);
        setError('');
        try {
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
            refresh();
            setShowModal(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save slide');
        }
        setSaving(false);
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
                        Each slide can link to a page or URL of your choice.
                    </p>
                </div>
                <button
                    onClick={openCreate}
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
                            <div className="p-4 space-y-3 flex-1 flex flex-col">
                                {slide.destination_url ? (
                                    <p className="text-[11px] text-sffl-red truncate">→ {slide.destination_url}</p>
                                ) : slide.news_slug ? (
                                    <p className="text-[11px] text-yellow-600 dark:text-yellow-400 italic">
                                        Legacy article link: /news/{slide.news_slug} (set a destination above to override)
                                    </p>
                                ) : (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 italic">No destination set — slide won't be clickable.</p>
                                )}
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
                                <div className="flex items-center gap-2 mt-auto">
                                    <button
                                        onClick={() => openEdit(slide)}
                                        className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-bold transition"
                                    >
                                        ✎ Edit
                                    </button>
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                    {editingId ? 'Edit Carousel Slide' : 'Add Carousel Slide'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Recommended: <strong>2:1 aspect ratio</strong> — ideally 1920×960 or 2000×1000.
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
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
                                isCommitted={saving}
                            />
                            <ImageUploadField
                                label="Mobile Image (optional)"
                                value={form.mobileImageUrl}
                                onChange={(url) => set('mobileImageUrl', url)}
                                folder="hero-slides"
                                maxSizeMB={15}
                                compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                                helperText="Square ~1080×1080 for phones. Leave empty to reuse the desktop image."
                                isCommitted={saving}
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
                                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Where the slide links when clicked. Paste an internal path (e.g. <code>/stats</code>) or
                                    a full external URL. To link to a news article, create it first in the News admin, then
                                    paste its link here (e.g. <code>/news/its-slug</code>). Leave blank for a non-clickable slide.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/90">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 min-h-[44px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2.5 min-h-[44px] bg-sffl-red hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 transition-colors"
                            >
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Slide'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" data-dialog onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete this slide?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                            Removes it from the homepage — this can't be undone.
                        </p>
                        <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-5">
                            <img src={deleteConfirm.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 min-h-[44px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.id)}
                                className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
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
