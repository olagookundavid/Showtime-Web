import { useEffect, useState } from 'react';
import {
    getGallery, createGallery, updateGallery, deleteGallery,
    type Gallery, type CreateGalleryPayload,
} from '../../services/api';

interface FormData {
    game_week: string; date: string; players_photo_url: string; fans_photo_url: string;
}

const emptyForm: FormData = { game_week: '', date: '', players_photo_url: '', fans_photo_url: '' };
const PAGE_SIZE = 9;

export const AdminGallery = () => {
    const [galleries, setGalleries] = useState<Gallery[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchAll = async (p = page) => {
        setLoading(true);
        try {
            const data = await getGallery(p, PAGE_SIZE);
            setGalleries(data.data || []);
            setTotalPages(data.total_pages || 1);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchAll(page); }, [page]);

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
    const openEdit = (g: Gallery) => {
        setEditingId(g.id);
        setForm({ game_week: g.game_week, date: g.date, players_photo_url: g.players_photo_url || '', fans_photo_url: g.fans_photo_url || '' });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateGalleryPayload = { game_week: form.game_week, date: form.date, players_photo_url: form.players_photo_url, fans_photo_url: form.fans_photo_url };
            if (editingId) await updateGallery(editingId, payload);
            else await createGallery(payload);
            setShowModal(false); await fetchAll(page);
        } catch (err) { console.error(err); alert('Failed to save gallery'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try { await deleteGallery(id); setDeleteConfirm(null); await fetchAll(page); }
        catch (err) { console.error(err); alert('Failed to delete'); }
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-sffl-navy">Gallery Management</h1>
                <button onClick={openCreate} className="px-6 py-2.5 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition">+ Add Gallery</button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {galleries.map(g => (
                            <div key={g.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                    {g.players_photo_url ? <img src={g.players_photo_url} alt={g.game_week} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400 text-4xl">📸</div>}
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-sffl-navy">{g.game_week}</h3>
                                        <span className="text-xs text-gray-500">{g.date}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(g)} className="flex-1 text-center px-3 py-1.5 border rounded-lg text-blue-600 font-bold text-sm hover:bg-blue-50 transition">Edit</button>
                                        <button onClick={() => setDeleteConfirm(g.id)} className="flex-1 text-center px-3 py-1.5 border rounded-lg text-red-600 font-bold text-sm hover:bg-red-50 transition">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {galleries.length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-400">
                                <div className="text-5xl mb-4">📸</div>
                                <p className="font-medium">No galleries yet. Click "Add Gallery" to create one.</p>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">← Prev</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = s + i; if (p > totalPages) return null; return <button key={p} onClick={() => setPage(p)} className={`px-3 py-2 rounded-lg font-bold text-sm transition ${p === page ? 'bg-sffl-red text-white' : 'border hover:bg-gray-50'}`}>{p}</button>; })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 border rounded-lg font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b"><h2 className="text-2xl font-black text-sffl-navy">{editingId ? 'Edit Gallery' : 'New Gallery'}</h2></div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Game Week *</label><input type="text" value={form.game_week} onChange={e => set('game_week', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Week 5" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full border rounded-lg px-3 py-2" /></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Players Photo URL *</label><input type="url" value={form.players_photo_url} onChange={e => set('players_photo_url', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />{form.players_photo_url && <img src={form.players_photo_url} alt="Preview" className="mt-2 h-24 rounded-lg object-cover" />}</div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Fans Photo URL *</label><input type="url" value={form.fans_photo_url} onChange={e => set('fans_photo_url', e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />{form.fans_photo_url && <img src={form.fans_photo_url} alt="Preview" className="mt-2 h-24 rounded-lg object-cover" />}</div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg font-bold hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-sffl-navy mb-2">Delete Gallery?</h3>
                        <p className="text-gray-600 mb-6">This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
