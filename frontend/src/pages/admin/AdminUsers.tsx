import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PencilSquareIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { DataTable, type Column, RowActions, ConfirmDialog, ConfirmSummary, Button, Field, Input, Modal, Select, DashboardPageHeader } from '../../components';
import { getAdminUsers, updateUserRole, updateUserInfo } from '../../services/api';
import type { UserResponse } from '../../types';
import { getApiErrorMessage } from '../../utils';

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
                <Select
                    value={u.role}
                    onChange={(e) => {
                        if (e.target.value !== u.role) setPendingAction({ kind: 'role', user: u, role: e.target.value });
                    }}
                    aria-label={`Role for ${u.fullname || u.email}`}
                    className="min-w-30"
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
                    <option value="commissioner">Commissioner</option>
                    <option value="fantasy_commissioner">Fantasy Commissioner</option>
                    <option value="head_referee">Head Referee</option>
                    <option value="news_head">News Head</option>
                    <option value="content_creator">Content Creator</option>
                    <option value="store_manager">Store Manager</option>
                    <option value="app_admin">App Admin</option>
                    <option value="admin">Admin</option>
                </Select>
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
            <DashboardPageHeader
                title="Users"
                subtitle="Search users and manage roles & info."
                actions={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <label htmlFor="roleFilterSelect" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Filter Role:</label>
                        <Select
                            id="roleFilterSelect"
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                setPage(1);
                            }}
                            className="sm:w-56"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="app_admin">App Admin</option>
                            <option value="team_head">Team Head</option>
                            <option value="player">Player</option>
                            <option value="referee">Referee</option>
                            <option value="stats">Stats</option>
                            <option value="ticketer">Ticketer</option>
                            <option value="seller">Store Seller</option>
                            <option value="commissioner">Commissioner</option>
                            <option value="fantasy_commissioner">Fantasy Commissioner</option>
                            <option value="head_referee">Head Referee</option>
                            <option value="news_head">News Head</option>
                            <option value="content_creator">Content Creator</option>
                            <option value="store_manager">Store Manager</option>
                            <option value="user">User</option>
                        </Select>
                    </div>
                }
            />

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
                <Modal
                    open
                    onClose={() => setEditingUser(null)}
                    title="Edit User"
                    subtitle={editingUser.email}
                    maxWidth="md"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
                            <Button onClick={requestInfoSave} disabled={busy || !editForm.fullname.trim()}>
                                Save Changes
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <Field label="Full Name *" htmlFor="edit-user-fullname">
                            <Input
                                id="edit-user-fullname"
                                type="text"
                                value={editForm.fullname}
                                onChange={(e) => setEditForm(prev => ({ ...prev, fullname: e.target.value }))}
                                placeholder="Full Name"
                            />
                        </Field>
                        <Field label="Phone" htmlFor="edit-user-phone">
                            <Input
                                id="edit-user-phone"
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Phone Number"
                            />
                        </Field>
                    </div>
                </Modal>
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
