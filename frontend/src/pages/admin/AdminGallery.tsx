import { Loader } from '../../components/ui/Loader';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getGallery, createGallery, updateGallery, deleteGallery, getCompetitions,
    type Gallery, type CreateGalleryPayload, type Competition,
} from '../../services/api';

interface FormData {
    competition_id: string;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
}

const emptyForm: FormData = { competition_id: '', game_week: '', date: '', players_photo_url: '', fans_photo_url: '' };
const PAGE_SIZE = 9;
const ALL = 'ALL';

export const AdminGallery = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [filterComp, setFilterComp] = useState<string>(ALL);

    const { data: compsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions: Competition[] = (compsData?.data || []).filter(c => c.status !== 'inactive');

    const competitionFilter = filterComp === ALL ? undefined : filterComp;

    const { data: galleryData, isLoading: loading } = useQuery({
        queryKey: ['adminGalleries', page, filterComp],
        queryFn: () => getGallery(page, PAGE_SIZE, competitionFilter),
    });

    const galleries: Gallery[] = galleryData?.data || [];
    const totalPages = galleryData?.total_pages || 1;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => { setPage(1); }, [filterComp]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, competition_id: filterComp !== ALL ? filterComp : (competitions[0]?.id || '') });
        setShowModal(true);
    };
    const openEdit = (g: Gallery) => {
        setEditingId(g.id);
        setForm({
            competition_id: g.competition_id || '',
            game_week: g.game_week,
            date: g.date,
            players_photo_url: g.players_photo_url || '',
            fans_photo_url: g.fans_photo_url || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateGalleryPayload = {
                competition_id: form.competition_id || null,
                game_week: form.game_week,
                date: form.date,
                players_photo_url: form.players_photo_url,
                fans_photo_url: form.fans_photo_url,
            };
            if (editingId) await updateGallery(editingId, payload);
            else await createGallery(payload);
            queryClient.invalidateQueries({ queryKey: ['adminGalleries'] });
            setShowModal(false);
        } catch (err) { console.error(err); alert('Failed to save gallery'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteGallery(id);
            queryClient.invalidateQueries({ queryKey: ['adminGalleries'] });
            setDeleteConfirm(null);
        } catch (err) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Gallery Management</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={filterComp}
                        onChange={(e) => setFilterComp(e.target.value)}
                        className="min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm font-medium"
                    >
                        <option value={ALL}>All competitions</option>
                        {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={openCreate} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">+ Add Gallery</button>
                </div>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {galleries.map(g => (
                            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-xl">📁</div>
                                            <div>
                                                <h3 className="font-bold text-lg text-sffl-navy dark:text-white leading-tight">{g.game_week}</h3>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{g.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-6">
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Competition</span>
                                            {g.competition?.name ? (
                                                <span className="text-sm font-medium text-sffl-navy dark:text-white">{g.competition.name}</span>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Players Folder</span>
                                            {g.players_photo_url ? (
                                                <a href={g.players_photo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">
                                                    {g.players_photo_url}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Fans Folder</span>
                                            {g.fans_photo_url ? (
                                                <a href={g.fans_photo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">
                                                    {g.fans_photo_url}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(g)} className="flex-1 text-center px-4 py-2 min-h-[44px] bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg shadow-sm hover:shadow-md font-bold text-xs transition-all duration-300 hover:scale-[1.02] active:scale-95">Edit</button>
                                        <button onClick={() => setDeleteConfirm(g.id)} className="flex-1 text-center px-4 py-2 min-h-[44px] bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg shadow-sm hover:shadow-md font-bold text-xs transition-all duration-300 hover:scale-[1.02] active:scale-95">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {galleries.length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-400">
                                <div className="text-5xl mb-4">📁</div>
                                <p className="font-medium">No galleries yet. Click "Add Gallery" to create one.</p>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = s + i; if (p > totalPages) return null; return <button key={p} onClick={() => setPage(p)} className={`px-4 py-2 min-h-[44px] rounded-lg font-bold text-xs transition-all duration-300 hover:scale-[1.02] active:scale-95 ${p === page ? 'bg-sffl-red text-white shadow-sm border-transparent' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}`}>{p}</button>; })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">{editingId ? 'Edit Gallery' : 'New Gallery'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl font-bold p-1">✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Competition</label>
                                <select value={form.competition_id} onChange={e => set('competition_id', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 min-h-[44px]">
                                    <option value="">— None —</option>
                                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Game Week *</label><input type="text" value={form.game_week} onChange={e => set('game_week', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" placeholder="e.g. Week 5 or Custom Day" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2" /></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Players Folder Link *</label><input type="url" value={form.players_photo_url} onChange={e => set('players_photo_url', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-sffl-red" placeholder="https://drive.google.com/..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Fans Folder Link *</label><input type="url" value={form.fans_photo_url} onChange={e => set('fans_photo_url', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-sffl-red" placeholder="https://drive.google.com/..." /></div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 min-h-[44px] bg-sffl-red text-sm text-white font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-2">Delete Gallery?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 min-h-[44px] bg-red-600 text-white font-bold rounded-lg text-sm shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
