import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PencilSquareIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { DataTable, type Column, RowActions, ConfirmDialog, ConfirmSummary, Button, Field, Input, Modal, Select, DashboardPageHeader } from '../../components';
import { getAdminUsers, getAdminRoleOptions, updateUserRole, updateUserInfo } from '../../services/api';
import type { RoleOption, UserResponse } from '../../types';
import { getApiErrorMessage } from '../../utils';

const PAGE_SIZE = 10;
const NO_ROWS: UserResponse[] = [];

// Player roles are display-only. They're granted solely by approving a claim, which also
// links the account to its player record: assigning one here would leave the player portal
// permanently empty. They stay in the list (disabled) so existing player accounts still render.
const CLAIM_ONLY_ROLES = new Set(['player', 'player_pending']);
const NO_ROLES: RoleOption[] = [];

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

    // Which roles exist is data (the Roles page), so the dropdown is read from the server.
    const { data: roleOptionsData } = useQuery({
        queryKey: ['adminRoleOptions'],
        queryFn: getAdminRoleOptions,
    });
    const roleOptions = roleOptionsData ?? NO_ROLES;
    const roleLabel = useCallback((role: string) => roleOptions.find((r) => r.key === role)?.name ?? role, [roleOptions]);

    const users: UserResponse[] = usersData?.data ?? NO_ROWS;
    const totalPages = usersData?.total_pages || 1;
    const error = queryError ? getApiErrorMessage(queryError, 'Failed to fetch users.') : '';

    // Edit modal
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
    const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });

    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const requestInfoSave = () => {
        if (!editingUser) return;
        if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
            toast.error('First and last name are required.');
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
                    {/* The user's current role is always listed, even if the options haven't loaded. */}
                    {!roleOptions.some((r) => r.key === u.role) && <option value={u.role}>{roleLabel(u.role)}</option>}
                    {roleOptions.map((r) => (
                        <option key={r.key} value={r.key} disabled={CLAIM_ONLY_ROLES.has(r.key)}>
                            {r.key === 'player' ? 'Player — via claim approval only' : r.name}
                        </option>
                    ))}
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
                            setEditForm({
                                firstName: u.first_name || '',
                                lastName: u.last_name || '',
                                phone: u.phone || '',
                            });
                        },
                    }]}
                />
            ),
        },
    ], [roleOptions, roleLabel]);

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
                    ['First name', editForm.firstName.trim()],
                    ['Last name', editForm.lastName.trim()],
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
                            {roleOptions.map((r) => (
                                <option key={r.key} value={r.key}>{r.name}</option>
                            ))}
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
                            <Button onClick={requestInfoSave} disabled={busy || !editForm.firstName.trim() || !editForm.lastName.trim()}>
                                Save Changes
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Field label="First Name *" htmlFor="edit-user-first-name" className="flex-1">
                                <Input
                                    id="edit-user-first-name"
                                    type="text"
                                    value={editForm.firstName}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                                    placeholder="First Name"
                                />
                            </Field>
                            <Field label="Last Name *" htmlFor="edit-user-last-name" className="flex-1">
                                <Input
                                    id="edit-user-last-name"
                                    type="text"
                                    value={editForm.lastName}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                                    placeholder="Last Name"
                                />
                            </Field>
                        </div>
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
