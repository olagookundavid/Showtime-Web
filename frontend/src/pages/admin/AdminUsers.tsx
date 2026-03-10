import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DataTable, type Column } from '../../components/ui/DataTable';
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
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [searchTerm, setSearchTerm] = useState('');

    const {
        data: usersData,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminUsers', { page, search: searchTerm }],
        queryFn: () => getAdminUsers({ page, limit: PAGE_SIZE, search: searchTerm }),
    });

    const users: UserResponse[] = usersData?.data || [];
    const totalPages = usersData?.total_pages || 1;
    const error = queryError ? (queryError as any).response?.data?.message || (queryError as any).response?.data?.error || 'Failed to fetch users.' : '';

    // Edit modal
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [editForm, setEditForm] = useState({ fullname: '', phone: '' });
    const [saving, setSaving] = useState(false);

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await updateUserRole(userId, newRole);
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            toast.success('User role updated');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to update user role.');
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
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            setEditingUser(null);
            toast.success('User info updated');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to update user info.');
        } finally {
            setSaving(false);
        }
    };

    const columns: Column<UserResponse>[] = [
        {
            header: 'User Details',
            sortable: true,
            sortValue: (u) => u.fullname || '',
            className: "px-6 py-4",
            cell: (u) => (
                <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.fullname || 'No Name'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                </div>
            )
        },
        {
            header: 'Phone',
            accessor: 'phone',
            sortable: true,
            className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-400",
            cell: (u) => u.phone || '—'
        },
        {
            header: 'Role',
            sortable: true,
            sortValue: (u) => u.role,
            className: "px-6 py-4",
            cell: (u) => (
                <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sffl-red focus:border-sffl-red px-3 py-2 min-h-[44px] z-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors cursor-pointer min-w-[120px]"
                >
                    <option value="user" className="truncate">User</option>
                    <option value="team_head" className="truncate">Team Head</option>
                    <option value="ticketer" className="truncate">Ticketer</option>
                    <option value="admin" className="truncate">Admin</option>
                </select>
            )
        },
        {
            header: 'Joined',
            sortable: true,
            sortValue: (u) => u.created_at,
            className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-400",
            cell: (u) => new Date(u.created_at).toLocaleDateString()
        },
        {
            header: 'Actions',
            className: "px-6 py-4 text-center",
            cell: (u) => (
                <button
                    onClick={() => openEdit(u)}
                    className="px-4 py-2 min-h-[44px] bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 font-bold text-sm rounded-lg shadow-sm transition-all duration-300 hover:scale-[1.02] active:scale-95"
                >
                    Edit
                </button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">User Management</h1>
                    <p className="text-gray-600 dark:text-gray-400">Search users and manage roles & info.</p>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            {/* Users Table */}
            {loading ? (
                <Loader />
            ) : (
                <DataTable
                    data={users}
                    columns={columns}
                    searchable={true}
                    searchPlaceholder="Search users by email or name..."
                    itemsPerPage={PAGE_SIZE}
                    serverPage={page}
                    totalServerPages={totalPages}
                    onPageChange={setPage}
                    onSearchSubmit={(term) => {
                        setSearchTerm(term);
                        setPage(1);
                    }}
                />
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
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors"
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[44px] bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors"
                                    placeholder="Phone Number"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 dark:text-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={saving || !editForm.fullname.trim()}
                                className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
