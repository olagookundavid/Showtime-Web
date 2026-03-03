import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getNews, createNews, updateNews, deleteNews,
    type News, type CreateNewsPayload,
} from '../../services/api';

interface FormData {
    title: string; slug: string; excerpt: string; content: string;
    featured_image: string; author: string; category: string;
}

const emptyForm: FormData = {
    title: '', slug: '', excerpt: '', content: '',
    featured_image: '', author: '', category: '',
};

const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const PAGE_SIZE = 10;

export const AdminNews = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);

    const { data: newsData, isLoading: loading } = useQuery({
        queryKey: ['adminNews', page],
        queryFn: () => getNews(page, PAGE_SIZE),
    });

    const articles: News[] = newsData?.data || [];
    const totalPages = newsData?.total_pages || 1;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
    const openEdit = (n: News) => {
        setEditingId(n.id);
        setForm({
            title: n.title, slug: n.slug, excerpt: n.excerpt || '', content: n.content,
            featured_image: n.featured_image || '', author: n.author || '', category: n.category || ''
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateNewsPayload = {
                title: form.title, slug: form.slug || slugify(form.title),
                excerpt: form.excerpt, content: form.content,
                featured_image: form.featured_image, author: form.author, category: form.category,
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

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));
    const handleTitleChange = (v: string) => setForm(p => ({ ...p, title: v, slug: slugify(v) }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">News Management</h1>
                <button onClick={openCreate} className="px-4 py-1.5 bg-sffl-red text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition">+ Add Article</button>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left">
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
                                            <button onClick={() => openEdit(n)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold text-sm rounded-lg transition-colors">Edit</button>
                                            <button onClick={() => setDeleteConfirm(n.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-bold text-sm rounded-lg transition-colors">Delete</button>
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
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = s + i; if (p > totalPages) return null; return <button key={p} onClick={() => setPage(p)} className={`px-3 py-2 rounded-xl font-bold text-sm transition ${p === page ? 'bg-sffl-red text-white shadow-md border-transparent' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{p}</button>; })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700"><h2 className="text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Article' : 'New Article'}</h2></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Title *</label><input type="text" value={form.title} onChange={e => handleTitleChange(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Article title" /></div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Slug</label><input type="text" value={form.slug} onChange={e => set('slug', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg px-3 py-2" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Author</label><input type="text" value={form.author} onChange={e => set('author', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Author name" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Category</label><select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2"><option value="">Select...</option>{['General', 'Match Report', 'Transfer News', 'Interview', 'Analysis', 'Commissioner\'s Note', 'Community'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Excerpt</label><textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} rows={2} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Short summary..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Content *</label><textarea value={form.content} onChange={e => set('content', e.target.value)} rows={8} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="Article content..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Featured Image URL</label><input type="url" value={form.featured_image} onChange={e => set('featured_image', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="https://..." /></div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-sffl-red text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update' : 'Publish'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Article?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 transition">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
