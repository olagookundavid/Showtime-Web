import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { InformationCircleIcon, KeyIcon, LockClosedIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DataTable, type Column, RowActions, ConfirmDialog, ConfirmSummary, Button, Field, Input, Textarea, Modal, DashboardPageHeader } from '../../components';
import { useAuth } from '../../contexts';
import { usePermissions } from '../../hooks';
import { accessFor, type FeatureKey } from '../../config/featureAccess';
import {
    getAdminRoles,
    getAdminRoleFeatures,
    createAdminRole,
    updateAdminRole,
    deleteAdminRole,
} from '../../services/api';
import type { FeatureDef, PermissionLevel, RoleResponse } from '../../types';
import { getApiErrorMessage } from '../../utils';

const NO_ROWS: RoleResponse[] = [];
const NO_FEATURES: FeatureDef[] = [];

type Level = 'none' | PermissionLevel;
const LEVELS: { value: Level; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'view', label: 'View' },
    { value: 'full', label: 'Full' },
];
const RANK: Record<Level, number> = { none: 0, view: 1, full: 2 };

type Draft = { key: string | null; name: string; description: string; permissions: Record<string, PermissionLevel> };
const EMPTY_DRAFT: Draft = { key: null, name: '', description: '', permissions: {} };

type PendingAction =
    | { kind: 'save'; draft: Draft; role: RoleResponse | null }
    | { kind: 'delete'; role: RoleResponse };

const accessSummary = (role: RoleResponse) => {
    if (role.key === 'app_admin') return 'Everything, always';
    const levels = Object.values(role.permissions);
    const full = levels.filter((l) => l === 'full').length;
    const view = levels.filter((l) => l === 'view').length;
    if (full + view === 0) return 'No admin panel access';
    return [full && `${full} full`, view && `${view} view-only`].filter(Boolean).join(', ');
};

/** One None / View / Full choice. Radios, so the arrow keys and screen readers work as a group. */
const LevelPicker = ({
    feature,
    value,
    ceiling,
    disabled,
    onChange,
}: {
    feature: FeatureDef;
    value: Level;
    /** The most the person editing may hand out. Higher choices are shown but can't be picked. */
    ceiling: Level;
    disabled: boolean;
    onChange: (level: Level) => void;
}) => (
    <div role="radiogroup" aria-label={`${feature.label} access`} className="inline-flex shrink-0 self-start sm:self-auto overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
        {LEVELS.map((l) => {
            const blocked = disabled || RANK[l.value] > RANK[ceiling];
            const checked = value === l.value;
            return (
                <label
                    key={l.value}
                    title={RANK[l.value] > RANK[ceiling] ? "You can't grant more access than you have yourself" : undefined}
                    className={`relative flex min-h-11 min-w-14 items-center justify-center px-3 text-sm font-bold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-sffl-red ${
                        checked
                            ? l.value === 'full'
                                ? 'bg-sffl-red text-white'
                                : l.value === 'view'
                                    ? 'bg-sffl-navy text-white'
                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-100'
                            : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    } ${blocked && !checked ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <input
                        type="radio"
                        name={`level-${feature.key}`}
                        value={l.value}
                        checked={checked}
                        disabled={blocked}
                        onChange={() => onChange(l.value)}
                        className="sr-only"
                    />
                    {l.label}
                </label>
            );
        })}
    </div>
);

const AdminRoles = () => {
    const queryClient = useQueryClient();
    const { user, refreshUser } = useAuth();
    const { canEdit } = usePermissions();
    const canManage = canEdit('roles');

    const { data: rolesData, isLoading: loadingRoles, error: rolesError } = useQuery({
        queryKey: ['adminRoles'],
        queryFn: getAdminRoles,
    });
    const { data: featuresData } = useQuery({
        queryKey: ['adminRoleFeatures'],
        queryFn: getAdminRoleFeatures,
    });
    const roles = rolesData ?? NO_ROWS;
    const features = featuresData ?? NO_FEATURES;
    const error = rolesError ? getApiErrorMessage(rolesError, 'Failed to load roles.') : '';

    const [draft, setDraft] = useState<Draft | null>(null);
    const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    /** What the person editing may hand out, per feature. */
    const ceilingFor = (key: string): Level => {
        const level = accessFor(user, key as FeatureKey);
        return level === 'none' ? 'none' : level;
    };

    // Features grouped in catalog order, so the matrix reads like the sidebar.
    const grouped = useMemo(() => {
        const groups: { name: string; features: FeatureDef[] }[] = [];
        for (const f of features) {
            let g = groups.find((x) => x.name === f.group);
            if (!g) groups.push((g = { name: f.group, features: [] }));
            g.features.push(f);
        }
        return groups;
    }, [features]);

    // A role can't be rewritten by someone who couldn't have handed out what it already holds.
    const beyondEditor = (role: RoleResponse) =>
        Object.entries(role.permissions).some(([key, level]) => RANK[level] > RANK[ceilingFor(key)]);

    const readOnly = editingRole !== null && (editingRole.is_system || beyondEditor(editingRole));

    const openCreate = () => {
        setEditingRole(null);
        setDraft({ ...EMPTY_DRAFT });
    };

    const openEdit = (role: RoleResponse) => {
        setEditingRole(role);
        setDraft({ key: role.key, name: role.name, description: role.description, permissions: { ...role.permissions } });
    };

    const setLevel = (feature: string, level: Level) =>
        setDraft((d) => {
            if (!d) return d;
            const permissions = { ...d.permissions };
            if (level === 'none') delete permissions[feature];
            else permissions[feature] = level;
            return { ...d, permissions };
        });

    const requestSave = () => {
        if (!draft) return;
        if (!draft.name.trim()) {
            toast.error('Give the role a name.');
            return;
        }
        // Editing a role people already hold changes their access straight away, so ask first.
        if (editingRole && editingRole.user_count > 0) {
            setPendingAction({ kind: 'save', draft, role: editingRole });
            return;
        }
        void save(draft, editingRole);
    };

    const save = async (d: Draft, existing: RoleResponse | null) => {
        setBusy(true);
        try {
            const payload = { name: d.name.trim(), description: d.description.trim(), permissions: d.permissions };
            if (existing) {
                await updateAdminRole(existing.key, payload);
                toast.success('Role updated');
            } else {
                await createAdminRole(payload);
                toast.success('Role created');
            }
            setDraft(null);
            setEditingRole(null);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['adminRoles'] }),
                queryClient.invalidateQueries({ queryKey: ['adminRoleOptions'] }),
            ]);
            // The person editing may hold this role; pick up their own new access.
            await refreshUser();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to save the role.'));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        if (action.kind === 'save') {
            await save(action.draft, action.role);
            return;
        }
        setBusy(true);
        try {
            await deleteAdminRole(action.role.key);
            toast.success('Role deleted');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['adminRoles'] }),
                queryClient.invalidateQueries({ queryKey: ['adminRoleOptions'] }),
            ]);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to delete the role.'));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const columns = useMemo<Column<RoleResponse>[]>(() => [
        {
            header: 'Role',
            sortable: true,
            sortValue: (r) => r.name,
            className: 'px-6 py-4',
            cell: (r) => (
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 wrap-break-word">{r.name}</span>
                        {r.is_system && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                <LockClosedIcon className="h-3 w-3" aria-hidden="true" />
                                Built-in
                            </span>
                        )}
                    </div>
                    {r.description && <div className="text-sm text-gray-500 dark:text-gray-400 wrap-break-word">{r.description}</div>}
                </div>
            ),
        },
        {
            header: 'Admin panel access',
            className: 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400',
            cell: (r) => accessSummary(r),
        },
        {
            header: 'Users',
            sortable: true,
            sortValue: (r) => r.user_count,
            className: 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400',
            cell: (r) => r.user_count,
        },
        {
            header: 'Actions',
            align: 'right',
            className: 'px-6 py-4',
            cell: (r) => (
                <RowActions
                    label={`Actions for ${r.name}`}
                    actions={[
                        {
                            label: r.is_system || !canManage ? 'View access' : 'Edit',
                            icon: PencilSquareIcon,
                            onSelect: () => openEdit(r),
                        },
                        {
                            label: 'Delete',
                            icon: TrashIcon,
                            danger: true,
                            disabled: !canManage || r.is_system || r.user_count > 0,
                            hint: r.is_system
                                ? 'Built-in roles can\'t be deleted'
                                : r.user_count > 0
                                    ? `${r.user_count} ${r.user_count === 1 ? 'user holds' : 'users hold'} this role`
                                    : undefined,
                            onSelect: () => setPendingAction({ kind: 'delete', role: r }),
                        },
                    ]}
                />
            ),
        },
    ], [canManage]);

    const dialog = pendingAction?.kind === 'delete'
        ? {
            title: 'Delete this role?',
            description: 'This can\'t be undone.',
            confirmLabel: 'Delete Role',
            tone: 'danger' as const,
            icon: TrashIcon,
            body: <ConfirmSummary rows={[['Role', pendingAction.role.name]]} />,
        }
        : {
            title: 'Save changes to this role?',
            description: 'Everyone holding this role gets the new access the next time they load a page.',
            confirmLabel: 'Save Changes',
            tone: 'info' as const,
            icon: KeyIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Role', pendingAction?.kind === 'save' ? pendingAction.draft.name.trim() : undefined],
                    ['Users affected', pendingAction?.kind === 'save' ? String(pendingAction.role?.user_count ?? 0) : undefined],
                ]} />
            ),
        };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Roles & Permissions"
                subtitle="Create roles and choose what each one can do in the admin panel. Changes apply straight away, no deploy needed."
                actions={
                    canManage ? (
                        <Button icon={PlusIcon} onClick={openCreate}>New Role</Button>
                    ) : undefined
                }
            />

            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-200">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p>
                    Assign a role to someone from the Users page. Each person has one role, so to give someone two jobs, make a role that covers both.
                    <strong> View</strong> lets a role look at a page but not change anything; <strong>Full</strong> lets it change things too.
                    You can only give out access you have yourself.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
                    {error}
                </div>
            )}

            <DataTable
                data={roles}
                columns={columns}
                getRowId={(r) => r.key}
                loading={loadingRoles}
                searchPlaceholder="Search roles"
                itemsPerPage={20}
                emptyMessage="No roles yet."
            />

            {draft && (
                <Modal
                    open
                    onClose={() => { setDraft(null); setEditingRole(null); }}
                    title={editingRole ? (readOnly ? editingRole.name : `Edit ${editingRole.name}`) : 'New Role'}
                    subtitle={editingRole?.is_system ? 'Built-in role' : undefined}
                    maxWidth="3xl"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => { setDraft(null); setEditingRole(null); }}>
                                {readOnly || !canManage ? 'Close' : 'Cancel'}
                            </Button>
                            {!readOnly && canManage && (
                                <Button onClick={requestSave} loading={busy} disabled={!draft.name.trim()}>
                                    {editingRole ? 'Save Changes' : 'Create Role'}
                                </Button>
                            )}
                        </>
                    }
                >
                    <div className="space-y-6">
                        {editingRole?.is_system && (
                            <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                                <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                {editingRole.key === 'app_admin'
                                    ? 'App Admin always has full access to everything, including features added later. It can\'t be changed, so nobody can lock themselves out.'
                                    : 'This role has its own portal and flow built into the app, so its access can\'t be edited here.'}
                            </p>
                        )}
                        {editingRole && !editingRole.is_system && readOnly && (
                            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                                <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                This role holds access you don&apos;t have yourself, so only someone who does can change it.
                            </p>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            <Field label="Name *" htmlFor="role-name">
                                <Input
                                    id="role-name"
                                    type="text"
                                    value={draft.name}
                                    disabled={readOnly || !canManage}
                                    maxLength={100}
                                    onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                                    placeholder="e.g. Match Day Crew"
                                />
                            </Field>
                            <Field label="Description" htmlFor="role-description" hint="Shown on this page so people know what the role is for.">
                                <Textarea
                                    id="role-description"
                                    value={draft.description}
                                    disabled={readOnly || !canManage}
                                    onChange={(e) => setDraft((d) => d && { ...d, description: e.target.value })}
                                    placeholder="What does this role do?"
                                />
                            </Field>
                        </div>

                        <div className="space-y-5">
                            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">What this role can do</h3>
                            {grouped.map((group) => (
                                <section key={group.name} aria-label={group.name} className="rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h4 className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-400">
                                        {group.name}
                                    </h4>
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {group.features.map((f) => (
                                            <li key={f.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{f.label}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">{f.description}</div>
                                                </div>
                                                <LevelPicker
                                                    feature={f}
                                                    value={editingRole?.key === 'app_admin' ? 'full' : (draft.permissions[f.key] ?? 'none')}
                                                    ceiling={ceilingFor(f.key)}
                                                    disabled={readOnly || !canManage}
                                                    onChange={(level) => setLevel(f.key, level)}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};

export default AdminRoles;
