import { Loader } from '../../components/ui/Loader';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    getAdminTeams, createTeam, updateTeam, deleteTeam,
    getTeamManagers, assignTeamManager, removeTeamManager,
    getAdminUsers
} from '../../services/api';
import { ImageUploadField, LightboxImage } from '../../components/ui';


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
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const limit = 12;

    const {
        data,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminTeams', { page, limit, search }],
        queryFn: () => getAdminTeams({ page, limit, search }),
    });

    const teams: Team[] = data?.data || [];
    const totalPages = data?.total_pages || 1;
    const error = queryError ? (queryError as any).response?.data?.message || (queryError as any).response?.data?.error || 'Failed to fetch teams.' : '';

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

    // Debounced search reset page
    useEffect(() => {
        setPage(1);
    }, [search]);

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
                toast.success('Team updated successfully');
            } else {
                await createTeam(form);
                toast.success('Team created successfully');
            }
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['adminTeams'] });
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save team.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this team? This will also remove all related standings and matches.')) return;
        try {
            await deleteTeam(id);
            queryClient.invalidateQueries({ queryKey: ['adminTeams'] });
            toast.success('Team deleted successfully');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete team.');
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
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to load managers');
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
            toast.success('Manager assigned globally');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to assign manager.');
        }
    };

    const handleRemoveManager = async (userId: string) => {
        if (!managerModal) return;
        try {
            await removeTeamManager(managerModal.teamId, userId);
            setManagers(prev => prev.filter(m => m.user_id !== userId));
            toast.success('Manager removed globally');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to remove manager.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Teams</h1>
                <button onClick={openCreate} className="px-4 py-2 bg-sffl-red text-white text-sm font-bold min-h-[44px] rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">+ Add Team</button>
            </div>

            {/* Search bar */}
            <div className="flex gap-2 w-full md:w-auto mb-2">
                <div className="relative w-full md:w-96">
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
                        placeholder="Search teams by name or short name..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-8 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red transition-all"
                    />
                    <svg className="absolute left-2 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchInput && (
                        <button
                            onClick={() => {
                                setSearchInput('');
                                setSearch('');
                                setPage(1);
                            }}
                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 transition"
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
                {search && (
                    <button
                        onClick={() => {
                            setSearch('');
                            setSearchInput('');
                            setPage(1);
                        }}
                        title="Clear Filters"
                        className="p-2 min-h-[44px] min-w-[44px] bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v2H4V4zm2 4h12v12H6V8z" /></svg>
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <Loader />
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
                                        <LightboxImage 
                                            src={team.logo} 
                                            alt={team.name} 
                                            thumbnailClassName="w-14 h-14 rounded-lg object-contain bg-gray-50 p-1" 
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-2xl font-black text-sffl-navy dark:text-white">
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
                                        className="flex-1 text-xs font-bold bg-blue-50 text-blue-600 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 py-1.5 rounded-md shadow-sm hover:shadow-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all">
                                        Edit
                                    </button>
                                    <button onClick={() => openManagers(team.id, team.name)}
                                        className="flex-1 text-xs font-bold bg-green-50 text-green-600 hover:text-green-800 dark:bg-green-900/30 dark:text-green-400 py-1.5 rounded-md shadow-sm hover:shadow-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-all">
                                        Managers
                                    </button>
                                    <button onClick={() => handleDelete(team.id)}
                                        className="flex-1 text-xs font-bold bg-red-50 text-red-600 hover:text-red-800 dark:bg-red-900/30 dark:text-red-400 py-1.5 rounded-md shadow-sm hover:shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-all">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 transition-all">
                    ← Prev
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    Page {page} of {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 transition-all">
                    Next →
                </button>
            </div>

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
                                <ImageUploadField
                                    label="Team Logo"
                                    value={form.logo}
                                    onChange={(url) => setForm(f => ({ ...f, logo: url }))}
                                    folder="teams"
                                    helperText="Upload a logo.  "
                                    isCommitted={saving}
                                />
                            </div>

                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 min-h-[44px] bg-sffl-red text-white font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-95">
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
                                <Loader />
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
                                                className="flex-1 min-h-[44px] z-50 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white truncate">
                                                <option value="" className="truncate">Select a team_head user...</option>
                                                {teamHeadUsers.map((u: any) => (
                                                    <option key={u.id} value={u.id} className="truncate">{u.fullname || u.email}</option>
                                                ))}
                                            </select>
                                            <button onClick={handleAssign} disabled={!selectedUserId}
                                                className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-green-700 disabled:opacity-50 text-sm transition-all">
                                                Assign
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button onClick={() => setManagerModal(null)} className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-95">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTeams;
