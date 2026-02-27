import { useEffect, useState } from 'react';
import { getAdminUsers, updateUserRole, updateUserInfo } from '../../services/api';

interface UserResponse {
    id: string;
    fullname: string;
    email: string;
    phone?: string;
    role: string;
    created_at: string;
    updated_at: string;
}

const AdminUsers = () => {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [searchTrigger, setSearchTrigger] = useState(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [total, setTotal] = useState(0);

    // Edit modal
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [editForm, setEditForm] = useState({ fullname: '', phone: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, searchTrigger]);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getAdminUsers({ page, limit, search: searchFilter });
            setUsers(res.data || []);
            if (res.meta) {
                setTotal(res.meta.total);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearchTrigger(prev => prev + 1);
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await updateUserRole(userId, newRole);
            setUsers(prev =>
                prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
            );
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to update user role.');
        }
    };

    const openEdit = (user: UserResponse) => {
        setEditingUser(user);
        setEditForm({ fullname: user.fullname || '', phone: user.phone || '' });
    };

    const handleEditSave = async () => {
        if (!editingUser) return;
        setSaving(true);
        try {
            await updateUserInfo(editingUser.id, editForm);
            // Reflect changes locally
            setUsers(prev =>
                prev.map(u =>
                    u.id === editingUser.id
                        ? { ...u, fullname: editForm.fullname, phone: editForm.phone }
                        : u
                )
            );
            setEditingUser(null);
        } catch (err: any) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Failed to update user info.');
        } finally {
            setSaving(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy">User Management</h1>
                    <p className="text-gray-600 dark:text-gray-400">Search users and manage roles & info.</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="search" className="sr-only">Search by email or name</label>
                        <input
                            type="text"
                            id="search"
                            placeholder="Search by email or name..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-sffl-red focus:border-sffl-red dark:text-gray-100 transition-colors"
                            autoComplete="off"
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-sffl-red hover:bg-red-700 text-white font-bold py-3 px-6 xl:px-8 rounded-lg transition-colors focus:ring-4 focus:ring-red-500 focus:ring-opacity-50"
                    >
                        Search
                    </button>
                </form>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    User Details
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Phone
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        <div className="flex justify-center py-4">
                                            <div className="w-10 h-10 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                                        </div>
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.fullname || 'No Name'}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {user.phone || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sffl-red focus:border-sffl-red p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors cursor-pointer min-w-[120px]"
                                            >
                                                <option value="user">User</option>
                                                <option value="team_head">Team Head</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-bold transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {!loading && users.length > 0 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Showing <span className="font-semibold text-gray-900 dark:text-white">{(page - 1) * limit + 1}</span> to{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{Math.min(page * limit, total)}</span> of{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{total}</span> results
                    </div>

                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Prev
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Edit User</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{editingUser.email}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    value={editForm.fullname}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, fullname: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors"
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors"
                                    placeholder="Phone Number"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={saving || !editForm.fullname.trim()}
                                className="px-5 py-2 bg-sffl-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
