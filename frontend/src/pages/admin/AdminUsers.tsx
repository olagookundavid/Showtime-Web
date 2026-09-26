import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PencilSquareIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { getAdminUsers, updateUserRole, updateUserInfo } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

interface UserResponse {
    id: string;
    fullname: string;
    email: string;
    phone?: string;
    role: string;
    created_at: string;
    updated_at: string;
}

const PAGE_SIZE = 10;
const NO_ROWS: UserResponse[] = [];

const ROLE_LABELS: Record<string, string> = {
    user: 'User',
    player: 'Player — via claim approval only',
    player_pending: 'Player (pending claim)',
    team_head: 'Team Head',
    ticketer: 'Ticketer',
    referee: 'Referee',
    stats: 'Stats Admin',
    seller: 'Store Seller',
    app_admin: 'App Admin',
    admin: 'Admin',
};

const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

type PendingAction =
    | { kind: 'role'; user: UserResponse; role: string }
    | { kind: 'info' };

const AdminUsers = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const {
        data: usersData,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminUsers', { page, search: searchTerm, role: roleFilter }],
        queryFn: () => getAdminUsers({ page, limit: PAGE_SIZE, search: searchTerm, role: roleFilter || undefined }),
        placeholderData: (prev) => prev,
    });

    const users: UserResponse[] = usersData?.data ?? NO_ROWS;
    const totalPages = usersData?.total_pages || 1;
    const error = queryError ? getApiErrorMessage(queryError, 'Failed to fetch users.') : '';

    // Edit modal
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [editForm, setEditForm] = useState({ fullname: '', phone: '' });

    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const requestInfoSave = () => {
        if (!editingUser) return;
        if (!editForm.fullname.trim()) {
            toast.error('Full name is required.');
            return;
        }
        setPendingAction({ kind: 'info' });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            if (action.kind === 'role') {
                await updateUserRole(action.user.id, action.role);
                toast.success('User role updated');
            } else if (editingUser) {
                await updateUserInfo(editingUser.id, editForm);
                setEditingUser(null);
                toast.success('User info updated');
            }
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
        } catch (err) {
            toast.error(getApiErrorMessage(err, action.kind === 'role' ? 'Failed to update user role.' : 'Failed to update user info.'));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const columns = useMemo<Column<UserResponse>[]>(() => [
        {
            header: 'User Details',
            sortable: true,
            sortValue: (u) => u.fullname || '',
            className: 'px-6 py-4',
            cell: (u) => (
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 wrap-break-word">{u.fullname || 'No Name'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 wrap-break-word">{u.email}</div>
                </div>
            ),
        },
        {
            header: 'Phone',
            accessor: 'phone',
            sortable: true,
            className: 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400',
            cell: (u) => u.phone || '—',
        },
        {
            header: 'Role',
            sortable: true,
            sortValue: (u) => u.role,
            className: 'px-6 py-4',
            cell: (u) => (
                <select
                    value={u.role}
                    onChange={(e) => {
                        if (e.target.value !== u.role) setPendingAction({ kind: 'role', user: u, role: e.target.value });
                    }}
                    aria-label={`Role for ${u.fullname || u.email}`}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sffl-red focus:border-sffl-red px-3 py-2 min-h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors cursor-pointer min-w-30"
                >
                    <option value="user">User</option>
                    {/* Player roles are display-only. They're granted solely by approving a
                        claim, which also links the account to its player record — assigning
                        one here would leave the player portal permanently empty. Kept in the
                        list (disabled) so existing player accounts still render their role. */}
                    <option value="player" disabled>Player — via claim approval only</option>
                    <option value="player_pending" disabled>Player (pending claim)</option>
                    <option value="team_head">Team Head</option>
                    <option value="ticketer">Ticketer</option>
                    <option value="referee">Referee</option>
                    <option value="stats">Stats Admin</option>
                    <option value="seller">Store Seller</option>
                    <option value="app_admin">App Admin</option>
                    <option value="admin">Admin</option>
                </select>
            ),
        },
        {
            header: 'Joined',
            sortable: true,
            sortValue: (u) => u.created_at,
            className: 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400',
            cell: (u) => <span className="whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            className: 'px-6 py-4',
            cell: (u) => (
                <RowActions
                    label={`Actions for ${u.fullname || u.email}`}
                    actions={[{
                        label: 'Edit details',
                        icon: PencilSquareIcon,
                        onSelect: () => {
                            setEditingUser(u);
                            setEditForm({ fullname: u.fullname || '', phone: u.phone || '' });
                        },
                    }]}
                />
            ),
        },
    ], []);

    const dialog = pendingAction?.kind === 'role'
        ? {
            title: 'Change this user\'s role?',
            description: 'Their access changes the next time they load the app.',
            confirmLabel: 'Change Role',
            icon: ShieldCheckIcon,
            body: (
                <ConfirmSummary rows={[
                    ['User', pendingAction.user.fullname || 'No Name'],
                    ['Email', pendingAction.user.email],
                    ['Now', roleLabel(pendingAction.user.role)],
                    ['Change to', roleLabel(pendingAction.role)],
                ]} />
            ),
        }
        : {
            title: 'Save changes to this user?',
            description: undefined,
            confirmLabel: 'Save Changes',
            icon: PencilSquareIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Email', editingUser?.email],
                    ['Full name', editForm.fullname.trim()],
                    ['Phone', editForm.phone.trim()],
                ]} />
            ),
        };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white">User Management</h1>
                    <p className="text-gray-600 dark:text-gray-400">Search users and manage roles & info.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="roleFilterSelect" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Filter Role:</label>
                    <select
                        id="roleFilterSelect"
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPage(1);
                        }}
                        className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red min-h-11"
                    >
                        <option value="">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="team_head">Team Head</option>
                        <option value="player">Player</option>
                        <option value="referee">Referee</option>
                        <option value="stats">Stats</option>
                        <option value="user">User</option>
                    </select>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            {/* Users Table */}
            <DataTable
                data={users}
                columns={columns}
                getRowId={(u) => u.id}
                loading={loading}
                searchPlaceholder="Search users by email or name"
                itemsPerPage={PAGE_SIZE}
                serverPage={page}
                totalServerPages={totalPages}
                onPageChange={setPage}
                onSearchSubmit={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
            />

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog onClick={() => setEditingUser(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">Edit User</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 wrap-break-word">{editingUser.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                aria-label="Close"
                                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    value={editForm.fullname}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, fullname: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 min-h-11 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors text-sm font-semibold"
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 min-h-11 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors text-sm font-semibold"
                                    placeholder="Phone Number"
                                />
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gray-50 dark:bg-gray-800/90">
                            <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                className="px-5 py-2.5 min-h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={requestInfoSave}
                                disabled={busy || !editForm.fullname.trim()}
                                className="px-5 py-2.5 min-h-11 bg-sffl-red hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
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
                tone="info"
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};

export default AdminUsers;
