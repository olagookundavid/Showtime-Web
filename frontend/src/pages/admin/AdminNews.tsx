import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getNews, createNews, updateNews, deleteNews,
    type News, type CreateNewsPayload,
} from '../../services/api';
import { ImageUploadField } from '../../components/ui';
import { NewsContentEditor } from '../../components/admin/NewsContentEditor';
import { parseYouTubeId, youTubeThumbnailUrl } from '../../utils/newsContent';


interface FormData {
    title: string; excerpt: string; content: string;
    featured_image: string; featured_media_type: 'image' | 'youtube'; featured_youtube_url: string;
    author: string; category: string; comments_enabled: boolean;
}

const emptyForm: FormData = {
    title: '', excerpt: '', content: '',
    featured_image: '', featured_media_type: 'image', featured_youtube_url: '',
    author: '', category: '', comments_enabled: true,
};

const PAGE_SIZE = 10;

export const AdminNews = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [category, setCategory] = useState('');
    const [author, setAuthor] = useState('');

    const { data: newsData, isLoading: loading } = useQuery({
        queryKey: ['adminNews', page, search, category, author],
        queryFn: () => getNews(page, PAGE_SIZE, search, category, author),
    });

    const articles: News[] = newsData?.data || [];
    const totalPages = newsData?.total_pages || 1;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const set = (field: keyof FormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));
    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
    const categories = ['General', 'Match Report', 'Transfer News', 'Interview', 'Analysis', 'Commissioner\'s Note', 'Community'];

    const openEdit = (n: News) => {
        console.log('Editing article:', n);
        setEditingId(n.id);

        // Find matching category case-insensitively
        const dbCategory = n.category || 'General';
        const matchedCategory = categories.find(c => c.toLowerCase() === dbCategory.toLowerCase()) || 'General';

        setForm({
            title: n.title, excerpt: n.excerpt || '', content: n.content,
            featured_image: n.featured_image || '',
            featured_media_type: n.featured_media_type === 'youtube' ? 'youtube' : 'image',
            featured_youtube_url: n.featured_youtube_url || '',
            author: n.author || '', category: matchedCategory,
            comments_enabled: n.comments_enabled ?? true,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (form.featured_media_type === 'youtube' && !parseYouTubeId(form.featured_youtube_url)) {
            alert('Please enter a valid YouTube link for the featured video.');
            return;
        }
        setSaving(true);
        try {
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
            queryClient.invalidateQueries({ queryKey: ['adminNews'] });
            setShowModal(false);
        } catch (err) { console.error(err); alert('Failed to save article'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteNews(id);
            queryClient.invalidateQueries({ queryKey: ['adminNews'] });
            setDeleteConfirm(null);
        } catch (err) { console.error(err); alert('Failed to delete'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">News Management</h1>
                <button onClick={openCreate} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">+ Add Article</button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex gap-2 w-full md:flex-1">
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    setSearch(searchInput);
                                    setPage(1);
                                }
                            }}
                            placeholder="Search title, author, category..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl pl-10 pr-4 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red transition-all"
                        />
                        <svg className="absolute left-3 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchInput && (
                            <button
                                onClick={() => {
                                    setSearchInput('');
                                    setSearch('');
                                    setPage(1);
                                }}
                                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            setSearch(searchInput);
                            setPage(1);
                        }}
                        className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        Search
                    </button>
                    {(search || category || author) && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setSearchInput('');
                                setCategory('');
                                setAuthor('');
                                setPage(1);
                            }}
                            title="Clear Filters"
                            className="p-2 min-h-[44px] min-w-[44px] bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v2H4V4zm2 4h12v12H6V8z" /></svg>
                        </button>
                    )}
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value);
                            setPage(1);
                        }}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-sffl-red transition-all w-full md:w-48"
                    >
                        <option value="" className="truncate">All Categories</option>
                        {['General', 'Match Report', 'Transfer News', 'Interview', 'Analysis', 'Commissioner\'s Note', 'Community'].map(c => <option key={c} value={c} className="truncate">{c}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-x-auto border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Title</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Author</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Category</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Published</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {articles.map(n => (
                                    <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="px-4 py-3"><div className="font-semibold text-sm text-gray-900 dark:text-white">{n.title}</div><div className="text-xs text-gray-500 dark:text-gray-400">{n.slug}</div></td>
                                        <td className="px-4 py-3 text-sm dark:text-gray-300">{n.author || '—'}</td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-xs font-bold">{n.category || 'General'}</span></td>
                                        <td className="px-4 py-3 text-sm dark:text-gray-300">{n.published_at ? new Date(n.published_at).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <a 
                                                href={`/news/${n.slug}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:hover:bg-gray-900/50 dark:text-gray-400 font-bold text-xs rounded-md transition-colors"
                                            >
                                                View
                                            </a>
                                            <button onClick={() => openEdit(n)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold text-xs rounded-md transition-colors">Edit</button>
                                            <button onClick={() => setDeleteConfirm(n.id)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold text-xs rounded-md transition-colors">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {articles.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">No articles found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = s + i; if (p > totalPages) return null; return <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition ${p === page ? 'bg-sffl-red text-white shadow-sm border-transparent' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{p}</button>; })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-gray-700 dark:text-gray-300 text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Article' : 'New Article'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Title *</label><input type="text" value={form.title} onChange={e => set('title', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Article title" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Author</label><input type="text" value={form.author} onChange={e => set('author', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px]" placeholder="Author name" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Category</label><select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px] z-50"><option value="" className="truncate">Select...</option>{['General', 'Match Report', 'Transfer News', 'Interview', 'Analysis', 'Commissioner\'s Note', 'Community'].map(c => <option key={c} value={c} className="truncate">{c}</option>)}</select></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Excerpt</label><textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Short summary..." /></div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Content *</label>
                                <NewsContentEditor value={form.content} onChange={v => set('content', v)} />
                            </div>
                            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 dark:text-white cursor-pointer">Enable Comments</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Allow logged-in users to discuss and comment on this article</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={form.comments_enabled}
                                    onChange={e => set('comments_enabled', e.target.checked)}
                                    className="w-5 h-5 text-sffl-red rounded border-gray-300 focus:ring-sffl-red cursor-pointer"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Featured Media</label>
                                <div className="flex gap-2">
                                    {(['image', 'youtube'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setForm(p => ({ ...p, featured_media_type: t }))}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition ${form.featured_media_type === t
                                                ? 'border-sffl-red text-sffl-red bg-sffl-red/10'
                                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                        >
                                            {t === 'image' ? '📷 Photo' : '▶ YouTube Video'}
                                        </button>
                                    ))}
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
                                        isCommitted={saving}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={form.featured_youtube_url}
                                            onChange={e => set('featured_youtube_url', e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                                        />
                                        {(() => {
                                            const videoId = parseYouTubeId(form.featured_youtube_url);
                                            if (videoId) {
                                                return (
                                                    <div className="relative w-48 rounded-lg overflow-hidden">
                                                        <img src={youTubeThumbnailUrl(videoId)} alt="Video preview" className="w-full" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-8 h-8 bg-sffl-red/90 rounded-full flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return form.featured_youtube_url
                                                ? <p className="text-xs text-red-500">Not a recognizable YouTube link yet.</p>
                                                : <p className="text-xs text-gray-500 dark:text-gray-400">Paste a YouTube link — the video will be embedded on the article page.</p>;
                                        })()}
                                    </div>
                                )}
                            </div>

                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px] disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update' : 'Publish'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Article?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 min-h-[44px]">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
