import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    ClipboardDocumentIcon,
    HandThumbDownIcon,
    HandThumbUpIcon,
    KeyIcon,
    NoSymbolIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { teamHeadClaimsApi } from '../../services/api';
import type { ClaimCodeData, PlayerClaimData } from '../../types/claims';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { Button, Field, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

type PendingAction =
    | { kind: 'generateCode' }
    | { kind: 'revokeCode'; code: ClaimCodeData }
    | { kind: 'approve'; claim: PlayerClaimData }
    | { kind: 'reject'; claim: PlayerClaimData }
    | { kind: 'endorse'; claim: PlayerClaimData; endorse: boolean };

const STATUS_TABS: [Status, string][] = [
    ['PENDING', 'Awaiting review'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
];

const whoOf = (claim: PlayerClaimData) => claim.player_name || claim.proposed_name || claim.claimed_email;

const claimRows = (claim: PlayerClaimData): [string, string | undefined][] => [
    ['Claimant', whoOf(claim)],
    ['Email', claim.claimed_email],
    ['Jersey', claim.player_jersey_number ? `#${claim.player_jersey_number}` : undefined],
];

/**
 * The team manager's claim review screen.
 *
 * Every player was imported from historical data with no email, phone or photo, so there
 * is no contact detail to authenticate anyone against. The manager knowing these people
 * personally is the only identity check available — which is why each card puts what the
 * claimant submitted next to what the system already knows about that player. A claimant
 * can invent an email address; they cannot invent a season of appearances.
 */
export const TeamHeadClaims: React.FC = () => {
    const queryClient = useQueryClient();
    const [claims, setClaims] = useState<PlayerClaimData[]>([]);
    const [status, setStatus] = useState<Status>('PENDING');
    const [loading, setLoading] = useState(true);

    const [code, setCode] = useState<ClaimCodeData | null>(null);
    const [codeLoading, setCodeLoading] = useState(true);

    // Every write waits here for the confirm dialog.
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const res = await teamHeadClaimsApi.list({ status, limit: 100 });
            setClaims(res.data || []);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to load claims'));
        } finally {
            setLoading(false);
        }
    };

    const fetchCode = async () => {
        setCodeLoading(true);
        try {
            setCode(await teamHeadClaimsApi.getCode());
        } catch {
            setCode(null);
        } finally {
            setCodeLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    useEffect(() => {
        fetchCode();
    }, []);

    const copyCode = (value: string) => {
        navigator.clipboard.writeText(value).then(
            () => toast.success('Code copied'),
            () => toast.error('Could not copy the code'),
        );
    };

    // Opens the confirm, starting any note it asks for empty.
    const ask = (action: PendingAction) => {
        setNote('');
        setPendingAction(action);
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        const trimmed = note.trim();
        if (action.kind === 'reject' && !trimmed) {
            toast.error('A reason is required.');
            return;
        }
        if (action.kind === 'endorse' && !action.endorse && !trimmed) {
            toast.error('Tell the league office why you cannot vouch for them.');
            return;
        }
        setBusy(true);
        try {
            switch (action.kind) {
                case 'generateCode':
                    setCode(await teamHeadClaimsApi.generateCode());
                    toast.success('New claim code generated');
                    break;
                case 'revokeCode':
                    await teamHeadClaimsApi.revokeCode(action.code.id);
                    setCode(null);
                    toast.success('Claim code revoked');
                    break;
                case 'approve':
                    await teamHeadClaimsApi.approve(action.claim.id, {});
                    toast.success(`${whoOf(action.claim)} approved`);
                    break;
                case 'reject':
                    await teamHeadClaimsApi.reject(action.claim.id, trimmed);
                    toast.success('Claim rejected');
                    break;
                case 'endorse': {
                    // A new-player request is not the manager's to decide — the league office
                    // is. What the manager has that nobody else does is knowing whether this
                    // person is real, so their part is to say so. Advisory: the admin can
                    // still decide either way.
                    const who = action.claim.proposed_name || action.claim.claimed_email;
                    await teamHeadClaimsApi.endorse(action.claim.id, action.endorse, trimmed);
                    toast.success(action.endorse ? `You vouched for ${who}` : `Recorded — you cannot vouch for ${who}`);
                    break;
                }
            }
            if (action.kind !== 'generateCode' && action.kind !== 'revokeCode') {
                fetchClaims();
                // The layout's sidebar badge counts this queue.
                queryClient.invalidateQueries({ queryKey: ['teamHeadPendingClaims'] });
            }
        } catch (err) {
            const fallback = {
                generateCode: 'Failed to generate a code',
                revokeCode: 'Failed to revoke the code',
                approve: 'Failed to approve the claim',
                reject: 'Failed to reject the claim',
                endorse: 'Could not record your answer',
            }[action.kind];
            toast.error(getApiErrorMessage(err, fallback));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const noteField = (label: string, required: boolean, placeholder: string) => (
        <Field
            label={<>{label} {required ? <span className="text-sffl-red">*</span> : <span className="font-normal text-gray-400">(optional)</span>}</>}
            htmlFor="claim-note"
        >
            <Textarea id="claim-note" value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder={placeholder} />
        </Field>
    );

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'generateCode':
                return code
                    ? {
                        title: 'Replace your claim code?',
                        description: 'Anyone still using the old code will need the new one.',
                        confirmLabel: 'Rotate Code',
                        tone: 'warning' as const,
                        icon: ArrowPathIcon,
                        body: <ConfirmSummary rows={[['Current code', code.code], ['Used', `${code.uses} of ${code.max_uses}`]]} />,
                    }
                    : {
                        title: 'Generate a claim code?',
                        description: 'Share it with your squad so they can claim their accounts.',
                        confirmLabel: 'Generate Code',
                        tone: 'info' as const,
                        icon: KeyIcon,
                        body: undefined,
                    };
            case 'revokeCode':
                return {
                    title: 'Revoke this code?',
                    description: 'Players will not be able to claim their accounts until you generate a new one.',
                    confirmLabel: 'Revoke Code',
                    tone: 'warning' as const,
                    icon: NoSymbolIcon,
                    body: <ConfirmSummary rows={[['Code', pendingAction.code.code], ['Used', `${pendingAction.code.uses} of ${pendingAction.code.max_uses}`]]} />,
                };
            case 'reject': {
                const { claim } = pendingAction;
                return {
                    title: `Reject ${whoOf(claim)}?`,
                    description: 'They will see your reason.',
                    confirmLabel: 'Reject Claim',
                    tone: 'warning' as const,
                    icon: XCircleIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={claimRows(claim)} />
                            {noteField('Reason', true, 'Why are you rejecting this claim?')}
                        </div>
                    ),
                };
            }
            case 'endorse': {
                const { claim, endorse } = pendingAction;
                const who = claim.proposed_name || claim.claimed_email;
                return {
                    title: endorse ? `Vouch for ${who}?` : `Say you cannot vouch for ${who}?`,
                    description: 'The league office decides new-player requests. Your answer goes to them.',
                    confirmLabel: endorse ? 'I Vouch for Them' : 'I Cannot Vouch',
                    tone: endorse ? 'success' as const : 'warning' as const,
                    icon: endorse ? HandThumbUpIcon : HandThumbDownIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={[['Name', claim.proposed_name], ['Email', claim.claimed_email], ['Position', claim.proposed_position]]} />
                            {endorse
                                ? noteField('Anything the league office should know?', false, 'For example, how you know them')
                                : noteField('Why can you not vouch for them?', true, 'The league office will see this')}
                        </div>
                    ),
                };
            }
            default: {
                const claim = pendingAction?.claim;
                return {
                    title: claim ? `Approve ${whoOf(claim)}?` : 'Approve this claim?',
                    description: claim && !claim.email_verified
                        ? "They have not confirmed their email address yet. Approving is still fine if you know this is them; they may need help resetting a password later."
                        : 'This creates their login and gives them access to their player portal.',
                    confirmLabel: 'Approve',
                    tone: 'success' as const,
                    icon: CheckCircleIcon,
                    body: claim ? <ConfirmSummary rows={claimRows(claim)} /> : undefined,
                };
            }
        }
    })();

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Account Claims"
                subtitle="Players claim their accounts with your team code, and you confirm each one is who they say they are."
            />

            {/* The code a manager gives their squad */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-base font-black text-gray-900 dark:text-white">
                    Your team claim code
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Share this with your squad. They enter it at <span className="font-mono">/claim</span> to find
                    their name and set a password. Nothing happens until you approve them here.
                </p>

                {codeLoading ? (
                    <Spinner size="sm" className="py-4" label="Loading code" />
                ) : code ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <code className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 font-mono text-lg font-black tracking-widest text-gray-900 dark:text-white break-all">
                            {code.code}
                        </code>
                        <Button variant="secondary" size="md" icon={ClipboardDocumentIcon} onClick={() => copyCode(code.code)}>
                            Copy
                        </Button>
                        <Button variant="secondary" size="md" icon={ArrowPathIcon} onClick={() => ask({ kind: 'generateCode' })}>
                            Rotate
                        </Button>
                        <Button variant="danger" size="md" icon={NoSymbolIcon} onClick={() => ask({ kind: 'revokeCode', code })}>
                            Revoke
                        </Button>
                        <span className="text-xs text-gray-400">
                            used {code.uses} of {code.max_uses}
                            {code.expires_at && ` · expires ${new Date(code.expires_at).toLocaleDateString()}`}
                        </span>
                    </div>
                ) : (
                    <Button className="mt-4" icon={KeyIcon} onClick={() => ask({ kind: 'generateCode' })}>
                        Generate a claim code
                    </Button>
                )}
            </div>

            {/* Review queue */}
            <div>
                <Tabs
                    aria-label="Claim status"
                    className="mb-4"
                    items={STATUS_TABS.map(([value, label]) => ({ value, label }))}
                    value={status}
                    onChange={setStatus}
                />

                {loading ? (
                    <Spinner label="Loading claims" />
                ) : claims.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        {status === 'PENDING'
                            ? 'No claims awaiting your review.'
                            : `No ${status.toLowerCase()} claims.`}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {claims.map(claim => (
                            <div
                                key={claim.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
                                    {/* What the claimant submitted */}
                                    <div className="p-4 sm:p-5 min-w-0">
                                        <div className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">
                                            They say they are
                                        </div>
                                        <div className="flex items-start gap-4">
                                            {claim.claimed_photo ? (
                                                <img
                                                    src={claim.claimed_photo}
                                                    alt="Submitted photo"
                                                    className="w-20 h-20 shrink-0 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 text-center px-1">
                                                    No photo
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 text-sm space-y-1">
                                                <div className="font-bold text-gray-900 dark:text-white truncate">
                                                    {claim.player_name || claim.proposed_name || '—'}
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-300 truncate">
                                                    {claim.claimed_email}
                                                    {claim.email_verified ? (
                                                        <span className="ml-2 text-xs font-bold text-green-600 dark:text-green-400">
                                                            confirmed
                                                        </span>
                                                    ) : (
                                                        <span className="ml-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                                                            unconfirmed
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-300">
                                                    {claim.claimed_phone || 'No phone given'}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    submitted {new Date(claim.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        {claim.is_new_player_request && (
                                            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs">
                                                <div className="font-bold text-amber-700 dark:text-amber-400">
                                                    Not on your roster — decided by the league office
                                                </div>
                                                <div className="mt-1 text-gray-600 dark:text-gray-300">
                                                    Proposed: {claim.proposed_name || '—'}
                                                    {claim.proposed_jersey_number ? ` · #${claim.proposed_jersey_number}` : ''}
                                                    {claim.proposed_position ? ` · ${claim.proposed_position}` : ''}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* What the system already knows */}
                                    <div className="p-4 sm:p-5 min-w-0 bg-gray-50/50 dark:bg-gray-900/30">
                                        <div className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">
                                            What our records show
                                        </div>
                                        {claim.is_new_player_request ? (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                No existing record — this person has never been on the platform, so
                                                there is nothing here to check them against. That is why the league
                                                office decides these, and why your word carries the weight.
                                            </p>
                                        ) : (
                                            <dl className="text-sm space-y-2">
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Roster name</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white text-right">
                                                        {claim.player_name || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Jersey</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.player_jersey_number ? `#${claim.player_jersey_number}` : '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Position</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.player_position || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Matches played</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.matches_played}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Teams</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white text-right wrap-break-word min-w-0">
                                                        {claim.past_teams?.length ? claim.past_teams.join(', ') : '—'}
                                                    </dd>
                                                </div>
                                            </dl>
                                        )}
                                    </div>
                                </div>

                                {claim.status === 'PENDING' && claim.claim_kind === 'NEW_PLAYER' ? (
                                    <div className="px-4 sm:px-5 py-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                                        {claim.endorsement ? (
                                            <div className="flex flex-wrap items-center gap-3 justify-between">
                                                <div className="text-sm min-w-0">
                                                    <span
                                                        className={`font-bold ${
                                                            claim.endorsement === 'ENDORSED'
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                        }`}
                                                    >
                                                        {claim.endorsement === 'ENDORSED'
                                                            ? 'You vouched for this person'
                                                            : 'You could not vouch for this person'}
                                                    </span>
                                                    <span className="text-gray-400"> · waiting on the league office</span>
                                                    {claim.endorsement_note && (
                                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 wrap-break-word">
                                                            “{claim.endorsement_note}”
                                                        </div>
                                                    )}
                                                </div>
                                                <Button variant="secondary" size="md" onClick={() => ask({ kind: 'endorse', claim, endorse: claim.endorsement !== 'ENDORSED' })}>
                                                    Change my answer
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-3 justify-between">
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Do you know this person?
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <Button variant="danger" size="lg" icon={HandThumbDownIcon} onClick={() => ask({ kind: 'endorse', claim, endorse: false })}>
                                                        I cannot vouch
                                                    </Button>
                                                    <Button variant="primary" size="lg" icon={HandThumbUpIcon} onClick={() => ask({ kind: 'endorse', claim, endorse: true })}>
                                                        I vouch for them
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : claim.status === 'PENDING' ? (
                                    <div className="px-4 sm:px-5 py-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 justify-end">
                                        <Button variant="danger" size="lg" icon={XCircleIcon} onClick={() => ask({ kind: 'reject', claim })}>
                                            Reject
                                        </Button>
                                        <Button variant="primary" size="lg" icon={CheckCircleIcon} onClick={() => ask({ kind: 'approve', claim })}>
                                            Approve
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="px-4 sm:px-5 py-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 wrap-break-word">
                                        {claim.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                        {claim.reviewed_at && ` on ${new Date(claim.reviewed_at).toLocaleDateString()}`}
                                        {claim.reject_reason && ` — ${claim.reject_reason}`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

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

export default TeamHeadClaims;
