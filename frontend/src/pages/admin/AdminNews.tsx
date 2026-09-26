import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowTopRightOnSquareIcon,
    NewspaperIcon,
    PencilSquareIcon,
    PhotoIcon,
    PlayCircleIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/solid';
import {
    getNews, createNews, updateNews, deleteNews,
    type News, type CreateNewsPayload,
} from '../../services/api';
import { ImageUploadField } from '../../components/ui';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { NewsContentEditor } from '../../components/admin/NewsContentEditor';
import { parseYouTubeId, youTubeThumbnailUrl } from '../../utils/newsContent';
import { getApiErrorMessage } from '../../utils/apiError';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';

interface ArticleForm {
    title: string; excerpt: string; content: string;
    featured_image: string; featured_media_type: 'image' | 'youtube'; featured_youtube_url: string;
    author: string; category: string; comments_enabled: boolean;
}

const emptyForm: ArticleForm = {
    title: '', excerpt: '', content: '',
    featured_image: '', featured_media_type: 'image', featured_youtube_url: '',
    author: '', category: '', comments_enabled: true,
};

const CATEGORIES = ['General', 'Match Report', 'Transfer News', 'Interview', 'Analysis', 'Commissioner\'s Note', 'Community'];

const PAGE_SIZE = 10;
const NO_ROWS: News[] = [];

const toForm = (n: News): ArticleForm => {
    // Find matching category case-insensitively
    const dbCategory = n.category || 'General';
    const matchedCategory = CATEGORIES.find(c => c.toLowerCase() === dbCategory.toLowerCase()) || 'General';
    return {
        title: n.title, excerpt: n.excerpt || '', content: n.content,
        featured_image: n.featured_image || '',
        featured_media_type: n.featured_media_type === 'youtube' ? 'youtube' : 'image',
        featured_youtube_url: n.featured_youtube_url || '',
        author: n.author || '', category: matchedCategory,
        comments_enabled: n.comments_enabled ?? true,
    };
};

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : undefined);

type PendingAction = { kind: 'save' } | { kind: 'delete'; article: News };

const inputClass = 'w-full min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2';
const labelClass = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1';

export const AdminNews = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    const { data: newsData, isLoading: loading } = useQuery({
        queryKey: ['adminNews', page, search, category],
        queryFn: () => getNews(page, PAGE_SIZE, search, category),
        placeholderData: (prev) => prev,
    });

    const articles = newsData?.data ?? NO_ROWS;
    const totalPages = newsData?.total_pages || 1;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ArticleForm>(emptyForm);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const set = <K extends keyof ArticleForm>(field: K, value: ArticleForm[K]) =>
        setForm(prev => ({ ...prev, [field]: value }));
    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };

    const requestSave = () => {
        if (!form.title.trim()) {
            toast.error('Please enter a title.');
            return;
        }
        if (form.featured_media_type === 'youtube' && !parseYouTubeId(form.featured_youtube_url)) {
            toast.error('Please enter a valid YouTube link for the featured video.');
            return;
        }
        setPendingAction({ kind: 'save' });
    };

    // The modal closes and `busy` clears in the same synchronous step, so the image
    // field unmounts while still marked committed and keeps the uploaded image.
    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        setBusy(true);
        try {
            if (pendingAction.kind === 'save') {
                const payload: CreateNewsPayload = {
                    title: form.title,
                    excerpt: form.excerpt, content: form.content,
                    featured_image: form.featured_image,
                    featured_media_type: form.featured_media_type,
                    featured_youtube_url: form.featured_media_type === 'youtube' ? form.featured_youtube_url : '',
                    author: form.author, category: form.category,
                    comments_enabled: form.comments_enabled,
                };
                if (editingId) await updateNews(editingId, payload);
                else await createNews(payload);
                toast.success(editingId ? 'Article updated.' : 'Article published.');
                setShowModal(false);
            } else {
                await deleteNews(pendingAction.article.id);
                toast.success('Article deleted.');
            }
            queryClient.invalidateQueries({ queryKey: ['adminNews'] });
            setPendingAction(null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, pendingAction.kind === 'save' ? 'Failed to save article.' : 'Failed to delete article.'));
            setPendingAction(null);
        } finally {
            setBusy(false);
        }
    };

    const columns = useMemo<Column<News>[]>(() => [
        {
            header: 'Title',
            accessor: 'title',
            sortable: true,
            cell: (n) => (
                <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word">{n.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.slug}</div>
                </div>
            ),
        },
        { header: 'Author', accessor: 'author', sortable: true, cell: (n) => n.author || '—' },
        {
            header: 'Category',
            cell: (n) => (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-xs font-bold whitespace-nowrap">
                    {n.category || 'General'}
                </span>
            ),
        },
        {
            header: 'Published',
            accessor: 'published_at',
            sortable: true,
            cell: (n) => <span className="whitespace-nowrap">{formatDate(n.published_at) || '—'}</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (n) => (
                <RowActions
                    label={`Actions for ${n.title}`}
                    actions={[
                        { label: 'View', icon: ArrowTopRightOnSquareIcon, href: `/news/${n.slug}` },
                        {
                            label: 'Edit',
                            icon: PencilSquareIcon,
                            onSelect: () => { setEditingId(n.id); setForm(toForm(n)); setShowModal(true); },
                        },
                        { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingAction({ kind: 'delete', article: n }) },
                    ]}
                />
            ),
        },
    ], []);

    const dialog = pendingAction?.kind === 'delete'
        ? {
            title: 'Delete this article?',
            description: 'This action cannot be undone.',
            confirmLabel: 'Delete Article',
            tone: 'warning' as const,
            icon: TrashIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Title', pendingAction.article.title],
                    ['Category', pendingAction.article.category || 'General'],
                    ['Published', formatDate(pendingAction.article.published_at)],
                ]} />
            ),
        }
        : {
            title: editingId ? 'Save changes to this article?' : 'Publish this article?',
            description: undefined,
            confirmLabel: editingId ? 'Save Changes' : 'Publish Article',
            tone: 'info' as const,
            icon: editingId ? PencilSquareIcon : NewspaperIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Title', form.title],
                    ['Category', form.category],
                    ['Author', form.author],
                    ['Comments', form.comments_enabled ? 'Enabled' : 'Disabled'],
                ]} />
            ),
        };

    const videoId = parseYouTubeId(form.featured_youtube_url);

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="News"
                subtitle="Write, publish and manage news articles."
                actions={
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden="true" />
                        Add Article
                    </button>
                }
            />

            <DataTable
                data={articles}
                columns={columns}
                getRowId={(n) => n.id}
                loading={loading}
                searchPlaceholder="Search title, author, category"
                onSearchSubmit={(q) => { setSearch(q.trim()); setPage(1); }}
                serverPage={page}
                totalServerPages={totalPages}
                onPageChange={setPage}
                itemsPerPage={PAGE_SIZE}
                emptyMessage={search || category ? 'No articles match these filters.' : 'No articles found.'}
                headerActions={
                    <select
                        value={category}
                        onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                        aria-label="Filter by category"
                        className="w-full sm:w-48 min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-sffl-red transition-all"
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                }
            />

            {showModal && (
                <div className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Article' : 'New Article'}</h2>
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
                            <div>
                                <label className={labelClass}>Title *</label>
                                <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder="Article title" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Author</label>
                                    <input type="text" value={form.author} onChange={e => set('author', e.target.value)} className={inputClass} placeholder="Author name" />
                                </div>
                                <div>
                                    <label className={labelClass}>Category</label>
                                    <select value={form.category} onChange={e => set('category', e.target.value)} className={inputClass}>
                                        <option value="">Select a category</option>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Excerpt</label>
                                <textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} rows={2} className={inputClass} placeholder="Short summary" />
                            </div>
                            <div>
                                <label className={labelClass}>Content *</label>
                                <NewsContentEditor value={form.content} onChange={v => set('content', v)} />
                            </div>
                            <label className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer">
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-gray-800 dark:text-white">Enable Comments</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Allow logged-in users to discuss and comment on this article</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={form.comments_enabled}
                                    onChange={e => set('comments_enabled', e.target.checked)}
                                    className="w-5 h-5 shrink-0 text-sffl-red rounded border-gray-300 focus:ring-sffl-red cursor-pointer"
                                />
                            </label>
                            <div className="space-y-3">
                                <span className="block text-sm font-bold text-gray-700 dark:text-gray-300">Featured Media</span>
                                <div className="flex flex-wrap gap-2">
                                    {(['image', 'youtube'] as const).map(t => {
                                        const Icon = t === 'image' ? PhotoIcon : PlayCircleIcon;
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => set('featured_media_type', t)}
                                                className={`inline-flex items-center gap-1.5 px-4 min-h-11 text-xs font-bold rounded-lg border transition ${form.featured_media_type === t
                                                    ? 'border-sffl-red text-sffl-red bg-sffl-red/10'
                                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                            >
                                                <Icon className="w-4 h-4" aria-hidden="true" />
                                                {t === 'image' ? 'Photo' : 'YouTube Video'}
                                            </button>
                                        );
                                    })}
                                </div>
                                {form.featured_media_type === 'image' ? (
                                    <ImageUploadField
                                        label="Featured Image"
                                        value={form.featured_image}
                                        onChange={(url) => set('featured_image', url)}
                                        folder="news"
                                        maxSizeMB={10}
                                        compression={{ maxSizeMB: 2, maxWidthOrHeight: 2560 }}
                                        helperText="JPG, PNG or WEBP. Max 10MB (will be compressed)."
                                        isCommitted={busy}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={form.featured_youtube_url}
                                            onChange={e => set('featured_youtube_url', e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className={inputClass}
                                        />
                                        {videoId ? (
                                            <div className="relative w-48 max-w-full rounded-lg overflow-hidden">
                                                <img src={youTubeThumbnailUrl(videoId)} alt="Video preview" className="w-full" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-8 h-8 bg-sffl-red/90 rounded-full flex items-center justify-center">
                                                        <PlayIcon className="w-4 h-4 text-white ml-0.5" aria-hidden="true" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : form.featured_youtube_url ? (
                                            <p className="text-xs text-red-500">Not a recognizable YouTube link yet.</p>
                                        ) : (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Paste a YouTube link — the video will be embedded on the article page.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gray-50 dark:bg-gray-800/90">
                            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm transition-colors min-h-11">Cancel</button>
                            <button type="button" onClick={requestSave} disabled={busy} className="px-5 py-2.5 bg-sffl-red text-white font-bold text-sm rounded-xl shadow-sm hover:bg-red-700 transition-colors min-h-11 disabled:opacity-50">{editingId ? 'Update Article' : 'Publish Article'}</button>
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
