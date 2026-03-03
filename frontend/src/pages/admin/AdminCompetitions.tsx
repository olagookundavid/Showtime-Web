import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader } from '../../components/ui/Loader';
import { getAdminCompetitions, createCompetition, updateCompetition, deleteCompetition } from '../../services/api';

interface Competition {
    id: string;
    name: string;
    logo: string;
}

const AdminCompetitions = () => {
    const queryClient = useQueryClient();

    const {
        data,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminCompetitionsData'],
        queryFn: getAdminCompetitions,
    });

    const competitions: Competition[] = data?.data || [];
    const error = queryError ? (queryError as any).response?.data?.message || (queryError as any).response?.data?.error || 'Failed to fetch competitions.' : '';

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Competition | null>(null);
    const [form, setForm] = useState({ name: '', logo: '' });
    const [saving, setSaving] = useState(false);



    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', logo: '' });
        setShowModal(true);
    };

    const openEdit = (c: Competition) => {
        setEditing(c);
        setForm({ name: c.name, logo: c.logo });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing) {
                await updateCompetition(editing.id, form);
            } else {
                await createCompetition(form);
            }
            queryClient.invalidateQueries({ queryKey: ['adminCompetitionsData'] });
            setShowModal(false);
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save competition.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this competition? This may affect related matches and standings.')) return;
        try {
            await deleteCompetition(id);
            queryClient.invalidateQueries({ queryKey: ['adminCompetitionsData'] });
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to delete competition.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Competitions</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage leagues, tournaments, and competitions.</p>
                </div>
                <button onClick={openCreate} className="bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded-xl shadow-md hover:shadow-lg transition-all">
                    + New Competition
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <Loader />
                ) : competitions.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">No competitions found.</div>
                ) : (
                    competitions.map(comp => (
                        <div key={comp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    {comp.logo ? (
                                        <img src={comp.logo} alt={comp.name} className="w-14 h-14 rounded-lg object-contain bg-gray-50 p-1" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-2xl font-black text-sffl-navy dark:text-white">
                                            🏆
                                        </div>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{comp.name}</h3>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <button onClick={() => openEdit(comp)}
                                        className="flex-1 text-sm font-bold bg-blue-50 text-blue-600 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 py-2 rounded-xl shadow-sm hover:shadow-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(comp.id)}
                                        className="flex-1 text-sm font-bold bg-red-50 text-red-600 hover:text-red-800 dark:bg-red-900/30 dark:text-red-400 py-2 rounded-xl shadow-sm hover:shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-all">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">
                                {editing ? 'Edit Competition' : 'New Competition'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="e.g. SFFL Season 3" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                                <input type="text" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()}
                                className="px-4 py-1.5 bg-sffl-red text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default AdminCompetitions;
