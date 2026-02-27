import { useEffect, useState, useCallback } from 'react';
import {
    getAdminTeams, createTeam, updateTeam, deleteTeam,
    getTeamManagers, assignTeamManager, removeTeamManager,
    getAdminUsers
} from '../../services/api';

interface Team {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

interface Manager {
    id: string;
    user_id: string;
    team_id: string;
    created_at: string;
}

const AdminTeams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 12;

    // Create/Edit modal
    const [showModal, setShowModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [form, setForm] = useState({ name: '', short_name: '', logo: '' });
    const [saving, setSaving] = useState(false);

    // Manager modal
    const [managerModal, setManagerModal] = useState<{ teamId: string; teamName: string } | null>(null);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [teamHeadUsers, setTeamHeadUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [loadingManagers, setLoadingManagers] = useState(false);

    const fetchTeams = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getAdminTeams({ page, limit, search });
            setTeams(res.data || []);
            setTotalPages(res.total_pages || 1);
            setTotal(res.total || 0);
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch teams.');
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => { fetchTeams(); }, [fetchTeams]);

    // Debounced search
    useEffect(() => {
        setPage(1);
    }, [search]);

    const openCreate = () => {
        setEditingTeam(null);
        setForm({ name: '', short_name: '', logo: '' });
        setShowModal(true);
    };

    const openEdit = (team: Team) => {
        setEditingTeam(team);
        setForm({ name: team.name, short_name: team.short_name, logo: team.logo });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingTeam) {
                await updateTeam(editingTeam.id, form);
            } else {
                await createTeam(form);
            }
            setShowModal(false);
            fetchTeams();
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save team.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this team? This will also remove all related standings and matches.')) return;
        try {
            await deleteTeam(id);
            fetchTeams();
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to delete team.');
        }
    };

    const openManagers = async (teamId: string, teamName: string) => {
        setManagerModal({ teamId, teamName });
        setLoadingManagers(true);
        try {
            const [managersRes, usersRes] = await Promise.all([
                getTeamManagers(teamId),
                getAdminUsers({ search: '', limit: 100 })
            ]);
            setManagers(managersRes.data || []);
            const allUsers = usersRes.data || [];
            setTeamHeadUsers(allUsers.filter((u: any) => u.role === 'team_head'));
        } catch {
            alert('Failed to load managers');
        } finally {
            setLoadingManagers(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedUserId || !managerModal) return;
        try {
            await assignTeamManager(managerModal.teamId, selectedUserId);
            setSelectedUserId('');
            const res = await getTeamManagers(managerModal.teamId);
            setManagers(res.data || []);
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to assign manager.');
        }
    };

    const handleRemoveManager = async (userId: string) => {
        if (!managerModal) return;
        try {
            await removeTeamManager(managerModal.teamId, userId);
            setManagers(prev => prev.filter(m => m.user_id !== userId));
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to remove manager.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy">Team Management</h1>
                    <p className="text-gray-600 dark:text-gray-400">Create, edit, and manage teams. <span className="text-sm text-gray-500">({total} teams total)</span></p>
                </div>
                <button onClick={openCreate} className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    + New Team
                </button>
            </div>

            {/* Search bar */}
            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search teams by name or short name..."
                    className="w-full md:w-96 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red"
                />
                <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : teams.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        {search ? `No teams matching "${search}".` : 'No teams found.'}
                    </div>
                ) : (
                    teams.map(team => (
                        <div key={team.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    {team.logo ? (
                                        <img src={team.logo} alt={team.name} className="w-14 h-14 rounded-lg object-contain bg-gray-50 p-1" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-2xl font-black text-sffl-navy">
                                            {team.short_name?.slice(0, 2) || team.name.slice(0, 2)}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{team.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{team.short_name}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <button onClick={() => openEdit(team)}
                                        className="flex-1 text-sm font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                        Edit
                                    </button>
                                    <button onClick={() => openManagers(team.id, team.name)}
                                        className="flex-1 text-sm font-bold text-green-600 hover:text-green-800 dark:text-green-400 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                        Managers
                                    </button>
                                    <button onClick={() => handleDelete(team.id)}
                                        className="flex-1 text-sm font-bold text-red-600 hover:text-red-800 dark:text-red-400 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300">
                        ← Prev
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        Page {page} of {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300">
                        Next →
                    </button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">
                                {editingTeam ? 'Edit Team' : 'New Team'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Team Name *</label>
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="e.g. Lagos Guardians" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Short Name</label>
                                <input type="text" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="e.g. LGD" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                                <input type="text" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()}
                                className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? 'Saving...' : editingTeam ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manager Modal */}
            {managerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">
                                Managers — {managerModal.teamName}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {loadingManagers ? (
                                <div className="flex justify-center py-4">
                                    <div className="w-8 h-8 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {managers.length === 0 ? (
                                        <p className="text-gray-500 text-center py-2">No managers assigned.</p>
                                    ) : (
                                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {managers.map(m => (
                                                <li key={m.id} className="flex items-center justify-between py-3">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        User: {m.user_id.slice(0, 8)}...
                                                    </span>
                                                    <button onClick={() => handleRemoveManager(m.user_id)}
                                                        className="text-red-600 hover:text-red-800 text-sm font-bold">
                                                        Remove
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Assign Team Head</label>
                                        <div className="flex gap-2">
                                            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
                                                <option value="">Select a team_head user...</option>
                                                {teamHeadUsers.map((u: any) => (
                                                    <option key={u.id} value={u.id}>{u.fullname || u.email}</option>
                                                ))}
                                            </select>
                                            <button onClick={handleAssign} disabled={!selectedUserId}
                                                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
                                                Assign
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button onClick={() => setManagerModal(null)} className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTeams;
