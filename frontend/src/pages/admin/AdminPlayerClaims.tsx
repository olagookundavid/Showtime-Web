import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowUturnLeftIcon,
    CheckCircleIcon,
    NoSymbolIcon,
    UserCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { adminClaimsApi } from '../../services/api';
import type { ClaimCodeData, ClaimKind, PlayerClaimData } from '../../types';
import { DataTable, type Column, RowActions, ConfirmDialog, ConfirmSummary, Button, Field, Input, Select, Tabs, DashboardPageHeader } from '../../components';
import { getApiErrorMessage } from '../../utils';

const NO_CLAIMS: PlayerClaimData[] = [];
const NO_CODES: ClaimCodeData[] = [];

const label = (c: PlayerClaimData) => c.player_name || c.proposed_name || c.claimed_email;

type PendingAction =
    | { kind: 'approve'; claim: PlayerClaimData }
    | { kind: 'reject'; claim: PlayerClaimData }
    | { kind: 'revoke'; claim: PlayerClaimData }
    | { kind: 'revokeCode'; code: ClaimCodeData };

const KIND_TABS = [
    ['NEW_PLAYER', 'New player requests'],
    ['ROSTER', 'Roster claims'],
    ['', 'Everything'],
] as const;

/**
 * Cross-team oversight of the player account claim flow.
 *
 * Admins can act on any team's claims and, uniquely, revoke an approval — the escape
 * hatch for when a manager approves the wrong person. Revoking demotes the account back
 * to player_pending and returns the claim to the review queue rather than deleting
 * anything, so the mistake is recoverable in both directions.
 */
export const AdminPlayerClaims: React.FC = () => {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<string>('PENDING');
    // New-player requests are the league office's own queue rather than oversight of
    // someone else's, so they get their own view instead of being mixed in.
    const [kind, setKind] = useState<'' | ClaimKind>('NEW_PLAYER');
    const [search, setSearch] = useState('');
    const [showCodes, setShowCodes] = useState(false);

    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const { data: claims = NO_CLAIMS, isLoading, error } = useQuery({
        queryKey: ['adminClaims', status, kind, search],
        queryFn: async () => {
            const res = await adminClaimsApi.list({
                status: status || 'ALL',
                search: search || undefined,
                kind: kind || undefined,
                limit: 100,
            });
            return res.data || [];
        },
        placeholderData: (prev) => prev,
    });

    const { data: codes = NO_CODES, isLoading: loadingCodes } = useQuery({
        queryKey: ['adminClaimCodes'],
        queryFn: adminClaimsApi.listCodes,
        enabled: showCodes,
    });

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        if (action.kind === 'reject' && !reason.trim()) {
            toast.error('A reason is required.');
            return;
        }
        setBusy(true);
        try {
            switch (action.kind) {
                case 'approve':
                    await adminClaimsApi.approve(action.claim.id);
                    toast.success(`${label(action.claim)} approved`);
                    break;
                case 'reject':
                    await adminClaimsApi.reject(action.claim.id, reason.trim());
                    toast.success('Claim rejected');
                    break;
                case 'revoke':
                    await adminClaimsApi.revoke(action.claim.id);
                    toast.success('Approval revoked');
                    break;
                case 'revokeCode':
                    await adminClaimsApi.revokeCode(action.code.id);
                    toast.success('Code revoked');
                    break;
            }
            queryClient.invalidateQueries({ queryKey: action.kind === 'revokeCode' ? ['adminClaimCodes'] : ['adminClaims'] });
        } catch (err) {
            const fallback = {
                approve: 'Failed to approve',
                reject: 'Failed to reject',
                revoke: 'Failed to revoke',
                revokeCode: 'Failed to revoke the code',
            }[action.kind];
            toast.error(getApiErrorMessage(err, fallback));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const claimColumns = useMemo<Column<PlayerClaimData>[]>(() => [
        {
            header: 'Claimant',
            sortable: true,
            sortValue: (c) => label(c),
            cell: (c) => (
                <div className="flex items-center gap-3 min-w-0">
                    {c.claimed_photo ? (
                        <img src={c.claimed_photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{label(c)}</div>
                        <div className="text-xs text-gray-400 truncate">
                            {c.claimed_email}
                            {!c.email_verified && ' · unconfirmed'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            header: 'Team',
            sortable: true,
            sortValue: (c) => c.team_name || '',
            cell: (c) => <span className="text-gray-600 dark:text-gray-300">{c.team_name || '—'}</span>,
        },
        {
            header: 'Record',
            cell: (c) =>
                c.claim_kind === 'NEW_PLAYER' ? (
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                        {c.endorsement === 'ENDORSED' ? (
                            <span className="font-bold text-green-600 dark:text-green-400">Manager vouches for them</span>
                        ) : c.endorsement === 'DECLINED' ? (
                            <span className="font-bold text-red-600 dark:text-red-400">Manager cannot vouch</span>
                        ) : (
                            <span className="font-bold text-amber-600 dark:text-amber-400">Awaiting manager's word</span>
                        )}
                        {c.endorsement_note && (
                            <div className="mt-0.5 text-gray-500 dark:text-gray-400 max-w-xs wrap-break-word">
                                “{c.endorsement_note}”
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                        {c.matches_played} match{c.matches_played === 1 ? '' : 'es'}
                        {c.past_teams?.length ? ` · ${c.past_teams.join(', ')}` : ''}
                    </span>
                ),
        },
        {
            header: 'Status',
            sortable: true,
            sortValue: (c) => c.status,
            cell: (c) => (
                <span
                    className={`px-2 py-1 rounded-md text-xs font-bold ${
                        c.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : c.status === 'APPROVED'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                >
                    {c.status}
                </span>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (c) => (
                <RowActions
                    label={`Actions for ${label(c)}`}
                    actions={
                        c.status === 'PENDING'
                            ? [
                                { label: 'Approve', icon: CheckCircleIcon, onSelect: () => setPendingAction({ kind: 'approve', claim: c }) },
                                {
                                    label: 'Reject',
                                    icon: XCircleIcon,
                                    danger: true,
                                    onSelect: () => {
                                        setReason('');
                                        setPendingAction({ kind: 'reject', claim: c });
                                    },
                                },
                            ]
                            : c.status === 'APPROVED'
                            ? [{ label: 'Revoke approval', icon: ArrowUturnLeftIcon, danger: true, onSelect: () => setPendingAction({ kind: 'revoke', claim: c }) }]
                            : [{ label: 'No actions', icon: NoSymbolIcon, disabled: true, hint: 'This claim was rejected.' }]
                    }
                />
            ),
        },
    ], []);

    const codeColumns = useMemo<Column<ClaimCodeData>[]>(() => [
        {
            header: 'Team',
            sortable: true,
            sortValue: (c) => c.team_name || '',
            cell: (c) => <span className="font-semibold text-gray-900 dark:text-white">{c.team_name || '—'}</span>,
        },
        {
            header: 'Code',
            cell: (c) => <span className="font-mono font-bold tracking-widest text-gray-900 dark:text-white">{c.code}</span>,
        },
        {
            header: 'Uses',
            cell: (c) => <span className="text-gray-600 dark:text-gray-300">{c.uses} / {c.max_uses}</span>,
        },
        {
            header: 'Expires',
            cell: (c) => (
                <span className="whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                </span>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (c) => (
                <RowActions
                    label={`Actions for ${c.team_name || 'team'} code ${c.code}`}
                    actions={[{ label: 'Revoke code', icon: NoSymbolIcon, danger: true, onSelect: () => setPendingAction({ kind: 'revokeCode', code: c }) }]}
                />
            ),
        },
    ], []);

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'reject': {
                const { claim } = pendingAction;
                return {
                    title: `Reject ${label(claim)}?`,
                    description: undefined,
                    confirmLabel: 'Reject Claim',
                    tone: 'warning' as const,
                    icon: XCircleIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={[
                                ['Claimant', label(claim)],
                                ['Email', claim.claimed_email],
                                ['Team', claim.team_name],
                            ]} />
                            <Field label={<>Reason <span className="text-sffl-red">*</span></>} htmlFor="claim-reject-reason">
                                <Input
                                    id="claim-reject-reason"
                                    type="text"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Why is this claim being rejected?"
                                />
                            </Field>
                        </div>
                    ),
                };
            }
            case 'revoke': {
                const { claim } = pendingAction;
                return {
                    title: `Revoke the approval for ${label(claim)}?`,
                    description: 'Their account drops back to pending, they lose player portal access, and the claim returns to the review queue.',
                    confirmLabel: 'Revoke Approval',
                    tone: 'warning' as const,
                    icon: ArrowUturnLeftIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Claimant', label(claim)],
                            ['Email', claim.claimed_email],
                            ['Team', claim.team_name],
                        ]} />
                    ),
                };
            }
            case 'revokeCode': {
                const { code } = pendingAction;
                return {
                    title: 'Revoke this claim code?',
                    description: 'That team cannot claim accounts until a new one is generated.',
                    confirmLabel: 'Revoke Code',
                    tone: 'warning' as const,
                    icon: NoSymbolIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Team', code.team_name],
                            ['Code', code.code],
                            ['Uses', `${code.uses} / ${code.max_uses}`],
                        ]} />
                    ),
                };
            }
            default: {
                const claim = pendingAction?.claim;
                return {
                    title: claim ? `Approve ${label(claim)}?` : 'Approve this claim?',
                    description: 'This creates their player login.',
                    confirmLabel: 'Approve',
                    tone: 'success' as const,
                    icon: CheckCircleIcon,
                    body: claim ? (
                        <ConfirmSummary rows={[
                            ['Claimant', label(claim)],
                            ['Email', claim.claimed_email],
                            ['Team', claim.team_name],
                        ]} />
                    ) : undefined,
                };
            }
        }
    })();

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Account Claims"
                subtitle="Team managers review their own squads. Use this to oversee every team and to undo a wrong approval."
                actions={
                    <Button
                        variant="secondary"
                        icon={UserCircleIcon}
                        onClick={() => setShowCodes(v => !v)}
                        aria-pressed={showCodes}
                        className="w-full sm:w-auto"
                    >
                        {showCodes ? 'Hide claim codes' : 'Show claim codes'}
                    </Button>
                }
            />

            {showCodes && (
                <DataTable
                    data={codes}
                    columns={codeColumns}
                    getRowId={(c) => c.id}
                    loading={loadingCodes}
                    searchable={false}
                    emptyMessage="No live claim codes. Managers generate their own from their dashboard."
                />
            )}

            <Tabs
                aria-label="Claim type"
                items={KIND_TABS.map(([value, label]) => ({ value, label }))}
                value={kind}
                onChange={setKind}
            />

            {kind === 'NEW_PLAYER' && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    These are people not on any roster asking to join the league. Nobody else can
                    approve them. There is no match history to check them against, so the team
                    manager's endorsement is the only outside evidence you have.
                </p>
            )}

            {error && (
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm font-medium text-red-700 dark:text-red-300">
                    {getApiErrorMessage(error, 'Failed to load claims')}
                </div>
            )}

            <DataTable
                data={claims}
                columns={claimColumns}
                getRowId={(c) => c.id}
                loading={isLoading}
                searchPlaceholder="Search by player name or email"
                onSearchSubmit={(q) => setSearch(q.trim())}
                emptyMessage="No claims match this filter."
                headerActions={
                    <Select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        aria-label="Filter by status"
                        className="w-full sm:w-56"
                    >
                        <option value="PENDING">Awaiting review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="">All statuses</option>
                    </Select>
                }
            />

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

export default AdminPlayerClaims;
