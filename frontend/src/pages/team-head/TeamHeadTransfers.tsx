import React, { useState, useEffect, useMemo } from 'react';
import { transfersApi, contractsApi, getTeams } from '../../services/api';
import type {
    Team,
    TransferData,
    TransferBidData,
    TeamBudgetData,
    TransferWindowData,
    ContractData,
} from '../../types';
import toast from 'react-hot-toast';
import {
    ArrowsRightLeftIcon,
    BanknotesIcon,
    ChatBubbleLeftEllipsisIcon,
    CheckCircleIcon,
    ClockIcon,
    LockClosedIcon,
    LockOpenIcon,
    PaperAirplaneIcon,
    TagIcon,
    UserPlusIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { DashboardPageHeader, Button, Field, Input, Select, Tabs, Textarea, DataTable, type Column, RowActions, type RowAction, ConfirmDialog, ConfirmSummary, Modal, Spinner } from '../../components';
import { getApiErrorMessage } from '../../utils';

type Tab = 'market' | 'my-listings' | 'incoming' | 'outgoing';

type PendingAction =
    | { kind: 'bid'; listing: TransferData; value: number }
    | { kind: 'list'; contract: ContractData; price: number }
    | { kind: 'directSale'; contract: ContractData; team: Team; price: number }
    | { kind: 'request'; team: Team; player: { id: string; name: string; position: string } }
    | { kind: 'bidResponse'; listing: TransferData; bid: TransferBidData; accept: boolean }
    /** `terms`: accepting the revised terms on our own request. `withdraw`: rejecting our own request. */
    | { kind: 'respond'; transfer: TransferData; accept: boolean; terms?: boolean; withdraw?: boolean }
    | { kind: 'review'; transfer: TransferData };

const pts = (n?: number) => (n ? `${n.toLocaleString()} pts` : undefined);
const playerName = (t: TransferData) => t.player?.name || 'Player';

// The Cancel and submit pair for a form modal's footer.
const FormButtons = ({ onCancel, onSubmit, disabled, label }: { onCancel: () => void; onSubmit: () => void; disabled?: boolean; label: string }) => (
    <>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSubmit} disabled={disabled}>{label}</Button>
    </>
);

const PlayerCell = ({ t }: { t: TransferData }) => (
    <div className="min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white wrap-break-word">{playerName(t)}</div>
        {t.player?.position && <div className="text-xs text-gray-400">{t.player.position}</div>}
    </div>
);

const TypeBadge = ({ t }: { t: TransferData }) => (
    <span className="px-2 py-0.5 bg-sffl-navy/10 text-sffl-navy dark:text-blue-300 text-xs font-bold rounded whitespace-nowrap">{t.type}</span>
);

const StatusBadge = ({ status }: { status: string }) => (
    <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full whitespace-nowrap">
        {status}
    </span>
);

export const TeamHeadTransfers: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('market');
    const [marketListings, setMarketListings] = useState<TransferData[]>([]);
    const [teamTransfers, setTeamTransfers] = useState<TransferData[]>([]);
    const [budget, setBudget] = useState<TeamBudgetData | null>(null);
    const [windowStatus, setWindowStatus] = useState<{ data: TransferWindowData | null; is_open: boolean }>({ data: null, is_open: false });
    const [myContracts, setMyContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Bidding form
    const [selectedListing, setSelectedListing] = useState<TransferData | null>(null);
    const [bidValue, setBidValue] = useState<number>(1000000);

    // Listing form
    const [showListModal, setShowListModal] = useState<boolean>(false);
    const [selectedContract, setSelectedContract] = useState<ContractData | null>(null);
    const [askingPrice, setAskingPrice] = useState<number>(1000000);

    // Direct Sale form
    const [showDirectSaleModal, setShowDirectSaleModal] = useState<boolean>(false);
    const [directSaleTargetTeamId, setDirectSaleTargetTeamId] = useState<string>('');
    const [directSalePrice, setDirectSalePrice] = useState<number>(1000000);

    // Transfer Request form
    const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
    const [requestTargetTeamId, setRequestTargetTeamId] = useState<string>('');
    const [requestPlayerId, setRequestPlayerId] = useState<string>('');
    const [requestPrice, setRequestPrice] = useState<number>(1000000);

    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [targetTeamPlayers, setTargetTeamPlayers] = useState<{ id: string; name: string; position: string }[]>([]);

    // Every write waits here for the confirm dialog.
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, wRes] = await Promise.all([
                transfersApi.getBudget(),
                transfersApi.getWindowStatus(),
            ]);
            setBudget(bRes);
            setWindowStatus(wRes);

            if (activeTab === 'market') {
                const mRes = await transfersApi.getMarket({ limit: 100 });
                setMarketListings(mRes.data || []);
            } else {
                const tRes = await transfersApi.getTeamTransfers({ limit: 100 });
                setTeamTransfers(tRes.data || []);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to fetch transfer data'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleFetchContractsForListing = async () => {
        try {
            const res = await contractsApi.getTeamContracts({ status: 'ACTIVE', limit: 100 });
            setMyContracts(res.data || []);
            setSelectedContract(null);
            setShowListModal(true);
        } catch {
            toast.error('Failed to load team active contracts');
        }
    };

    const handleOpenDirectSaleModal = async () => {
        try {
            const [cRes, tRes] = await Promise.all([
                contractsApi.getTeamContracts({ status: 'ACTIVE', limit: 100 }),
                getTeams(1, 100),
            ]);
            setMyContracts(cRes.data || []);
            setAllTeams((tRes.data || []).filter((tm: Team) => tm.id !== budget?.team_id));
            setSelectedContract(null);
            setDirectSaleTargetTeamId('');
            setShowDirectSaleModal(true);
        } catch {
            toast.error('Failed to load active players or teams');
        }
    };

    const handleOpenRequestModal = async () => {
        try {
            const tRes = await getTeams(1, 100);
            setAllTeams((tRes.data || []).filter((tm: Team) => tm.id !== budget?.team_id));
            setRequestTargetTeamId('');
            setRequestPlayerId('');
            setTargetTeamPlayers([]);
            setShowRequestModal(true);
        } catch {
            toast.error('Failed to load teams');
        }
    };

    const handleSelectTargetTeamForRequest = async (teamId: string) => {
        setRequestTargetTeamId(teamId);
        setRequestPlayerId('');
        if (!teamId) {
            setTargetTeamPlayers([]);
            return;
        }
        try {
            const res = await contractsApi.getTeamContracts({ team_id: teamId, status: 'ACTIVE', limit: 100 });
            const list = (res.data || []).map(c => ({
                id: c.player_id,
                name: c.player?.name || 'Player',
                position: c.player?.position || '',
            }));
            setTargetTeamPlayers(list);
        } catch {
            toast.error('Failed to load team roster');
        }
    };

    // ── Form submits: check the form, then ask for confirmation ──
    const submitBid = () => {
        if (!selectedListing) return;
        if (!(bidValue > 0)) {
            toast.error('Enter a bid amount.');
            return;
        }
        setPendingAction({ kind: 'bid', listing: selectedListing, value: bidValue });
    };

    const submitListing = () => {
        if (!selectedContract) return;
        if (!(askingPrice >= 0)) {
            toast.error('Enter an asking price.');
            return;
        }
        setPendingAction({ kind: 'list', contract: selectedContract, price: askingPrice });
    };

    const submitDirectSale = () => {
        const team = allTeams.find(tm => tm.id === directSaleTargetTeamId);
        if (!selectedContract || !team) {
            toast.error('Please select both a player and target team');
            return;
        }
        if (!(directSalePrice >= 0)) {
            toast.error('Enter the agreed sale price.');
            return;
        }
        setPendingAction({ kind: 'directSale', contract: selectedContract, team, price: directSalePrice });
    };

    const submitRequest = () => {
        const team = allTeams.find(tm => tm.id === requestTargetTeamId);
        const player = targetTeamPlayers.find(p => p.id === requestPlayerId);
        if (!team || !player) {
            toast.error('Please select a target team and player');
            return;
        }
        setPendingAction({ kind: 'request', team, player });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        if (action.kind === 'review' && !reviewNotes.trim()) {
            toast.error('Add your review notes or counter-terms.');
            return;
        }
        setBusy(true);
        try {
            switch (action.kind) {
                case 'bid':
                    await transfersApi.placeBid(action.listing.id, { bid_value: action.value });
                    toast.success('Bid placed successfully!');
                    setSelectedListing(null);
                    break;
                case 'list':
                    await transfersApi.createListing({ player_id: action.contract.player_id, asking_price: action.price });
                    toast.success('Player listed on transfer market');
                    setShowListModal(false);
                    break;
                case 'directSale':
                    await transfersApi.createDirectSale({ player_id: action.contract.player_id, to_team_id: action.team.id, price: action.price });
                    toast.success('Direct sale proposal submitted successfully');
                    setShowDirectSaleModal(false);
                    break;
                case 'request':
                    await transfersApi.createRequest({ player_id: action.player.id, to_team_id: action.team.id });
                    toast.success('Transfer request submitted successfully');
                    setShowRequestModal(false);
                    break;
                case 'bidResponse':
                    await transfersApi.respondToBid(action.listing.id, action.bid.id, action.accept ? 'accept' : 'reject');
                    toast.success(action.accept ? 'Bid accepted successfully' : 'Bid rejected successfully');
                    break;
                case 'respond':
                    await transfersApi.respond(action.transfer.id, { action: action.accept ? 'accept' : 'reject', notes: '' });
                    toast.success(action.accept ? 'Transfer request accepted' : action.withdraw ? 'Transfer request withdrawn' : 'Transfer request rejected');
                    break;
                case 'review':
                    await transfersApi.respond(action.transfer.id, { action: 'review', notes: reviewNotes.trim() });
                    toast.success('Transfer request sent back for review');
                    break;
            }
            fetchData();
        } catch (err) {
            const fallback = {
                bid: 'Failed to place bid',
                list: 'Failed to list player',
                directSale: 'Failed to create direct sale proposal',
                request: 'Failed to submit transfer request',
                bidResponse: 'Failed to respond to bid',
                respond: 'Failed to respond to transfer',
                review: 'Failed to respond to transfer',
            }[action.kind];
            toast.error(getApiErrorMessage(err, fallback));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const currentTeamId = budget?.team_id;

    const incomingTransfers = useMemo(() => teamTransfers.filter(t =>
        (t.status === 'PENDING' || t.status === 'REVIEW') && t.to_team?.id === currentTeamId
    ), [teamTransfers, currentTeamId]);
    const outgoingTransfers = useMemo(() => teamTransfers.filter(t =>
        (t.status === 'PENDING' || t.status === 'REVIEW') && t.from_team?.id === currentTeamId && t.type !== 'LISTING'
    ), [teamTransfers, currentTeamId]);
    const myListings = useMemo(() => teamTransfers.filter(t =>
        t.type === 'LISTING' && t.from_team?.id === currentTeamId
    ), [teamTransfers, currentTeamId]);

    const incomingColumns = useMemo<Column<TransferData>[]>(() => [
        { header: 'Player', sortable: true, sortValue: playerName, cell: (t) => <PlayerCell t={t} /> },
        { header: 'Type', cell: (t) => <TypeBadge t={t} /> },
        { header: 'From Club', cell: (t) => <span className="font-semibold text-gray-700 dark:text-gray-300">{t.from_team?.name || '—'}</span> },
        { header: 'Offered Value', cell: (t) => <span className="font-bold whitespace-nowrap">{pts(t.asking_price) || '—'}</span> },
        { header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
        {
            header: 'Actions',
            align: 'right',
            // Once we have sent a request back for review the ball is in the
            // requesting club's court, so we only watch from here.
            cell: (t) => (
                <RowActions
                    label={`Actions for ${playerName(t)}`}
                    actions={
                        t.status === 'REVIEW'
                            ? [{ label: 'No actions', icon: ClockIcon, disabled: true, hint: `Awaiting ${t.from_team?.name || 'the requesting club'}.` }]
                            : [
                                { label: 'Accept', icon: CheckCircleIcon, onSelect: () => setPendingAction({ kind: 'respond', transfer: t, accept: true }) },
                                ...(t.type === 'REQUEST'
                                    ? [{
                                        label: 'Request review',
                                        icon: ChatBubbleLeftEllipsisIcon,
                                        onSelect: () => {
                                            setReviewNotes('');
                                            setPendingAction({ kind: 'review', transfer: t });
                                        },
                                    }]
                                    : []),
                                { label: 'Reject', icon: XCircleIcon, danger: true, onSelect: () => setPendingAction({ kind: 'respond', transfer: t, accept: false }) },
                            ]
                    }
                />
            ),
        },
    ], []);

    const outgoingColumns = useMemo<Column<TransferData>[]>(() => [
        { header: 'Player', sortable: true, sortValue: playerName, cell: (t) => <PlayerCell t={t} /> },
        { header: 'Type', cell: (t) => <TypeBadge t={t} /> },
        { header: 'Target Club', cell: (t) => <span className="font-semibold text-gray-700 dark:text-gray-300">{t.to_team?.name || 'Open Market'}</span> },
        { header: 'Offered Value', cell: (t) => <span className="font-bold whitespace-nowrap">{pts(t.asking_price) || 'N/A'}</span> },
        {
            header: 'Status',
            cell: (t) => (
                <div className="space-y-1.5">
                    <StatusBadge status={t.status} />
                    {t.status === 'REVIEW' && t.review_notes && (
                        <p className="text-xs p-2 max-w-xs bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 wrap-break-word">
                            <span className="font-bold">Their review:</span> {t.review_notes}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            // A request sent back for review is ours to settle: the rules
            // allow us to accept or reject the revised terms, nothing else.
            cell: (t) => {
                const actions: RowAction[] = t.status === 'REVIEW' && t.type === 'REQUEST'
                    ? [
                        { label: 'Accept terms', icon: CheckCircleIcon, onSelect: () => setPendingAction({ kind: 'respond', transfer: t, accept: true, terms: true }) },
                        { label: 'Withdraw', icon: XCircleIcon, danger: true, onSelect: () => setPendingAction({ kind: 'respond', transfer: t, accept: false, withdraw: true }) },
                    ]
                    : [{ label: 'No actions', icon: ClockIcon, disabled: true, hint: 'Waiting on the other club.' }];
                return <RowActions label={`Actions for ${playerName(t)}`} actions={actions} />;
            },
        },
    ], []);

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'bid': {
                const { listing, value } = pendingAction;
                return {
                    title: `Bid ${value.toLocaleString()} pts for ${playerName(listing)}?`,
                    description: 'The selling club decides whether to accept it.',
                    confirmLabel: 'Place Bid',
                    tone: 'info' as const,
                    icon: BanknotesIcon,
                    body: <ConfirmSummary rows={[
                        ['Player', playerName(listing)],
                        ['Selling club', listing.from_team?.name],
                        ['Asking price', pts(listing.asking_price)],
                        ['Your bid', pts(value)],
                    ]} />,
                };
            }
            case 'list': {
                const { contract, price } = pendingAction;
                return {
                    title: `List ${contract.player?.name || 'this player'} on the transfer market?`,
                    description: 'Other clubs can bid on them while the window is open.',
                    confirmLabel: 'Publish Listing',
                    tone: 'info' as const,
                    icon: TagIcon,
                    body: <ConfirmSummary rows={[['Player', contract.player?.name], ['Position', contract.player?.position], ['Asking price', `${price.toLocaleString()} pts`]]} />,
                };
            }
            case 'directSale': {
                const { contract, team, price } = pendingAction;
                return {
                    title: `Propose selling ${contract.player?.name || 'this player'} to ${team.name}?`,
                    description: `${team.name} accepts or rejects the proposal.`,
                    confirmLabel: 'Submit Proposal',
                    tone: 'info' as const,
                    icon: ArrowsRightLeftIcon,
                    body: <ConfirmSummary rows={[['Player', contract.player?.name], ['Buyer', team.name], ['Price', `${price.toLocaleString()} pts`]]} />,
                };
            }
            case 'request': {
                const { team, player } = pendingAction;
                return {
                    title: `Request ${player.name} from ${team.name}?`,
                    description: `${team.name} accepts, rejects or sends it back for review.`,
                    confirmLabel: 'Send Request',
                    tone: 'info' as const,
                    icon: PaperAirplaneIcon,
                    body: <ConfirmSummary rows={[['Player', player.name], ['Position', player.position], ['Club', team.name]]} />,
                };
            }
            case 'bidResponse': {
                const { listing, bid, accept } = pendingAction;
                const club = bid.bidder_team?.name || 'this club';
                return {
                    title: accept ? `Accept ${club}'s bid for ${playerName(listing)}?` : `Reject ${club}'s bid?`,
                    description: accept ? 'Your player moves to their club and the sale completes.' : undefined,
                    confirmLabel: accept ? 'Accept Bid' : 'Reject Bid',
                    tone: accept ? 'success' as const : 'warning' as const,
                    icon: accept ? CheckCircleIcon : XCircleIcon,
                    body: <ConfirmSummary rows={[['Player', playerName(listing)], ['Bidder', bid.bidder_team?.name], ['Bid', pts(bid.bid_value)]]} />,
                };
            }
            case 'review': {
                const { transfer } = pendingAction;
                return {
                    title: `Send the request for ${playerName(transfer)} back for review?`,
                    description: `${transfer.from_team?.name || 'The requesting club'} sees your notes and accepts or withdraws.`,
                    confirmLabel: 'Request Review',
                    tone: 'info' as const,
                    icon: ChatBubbleLeftEllipsisIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={[['Player', playerName(transfer)], ['From', transfer.from_team?.name]]} />
                            <Field label={<>Review notes or counter-terms <span className="text-sffl-red">*</span></>} htmlFor="review-notes">
                                <Textarea
                                    id="review-notes"
                                    value={reviewNotes}
                                    onChange={e => setReviewNotes(e.target.value)}
                                    rows={3}
                                />
                            </Field>
                        </div>
                    ),
                };
            }
            default: {
                const action = pendingAction;
                const t = action?.transfer;
                const name = t ? playerName(t) : 'this player';
                const accept = !!action?.accept;
                return {
                    title: accept
                        ? action?.terms ? `Accept the revised terms for ${name}?` : `Accept the transfer of ${name}?`
                        : action?.withdraw ? `Withdraw your request for ${name}?` : `Reject the transfer of ${name}?`,
                    description: accept ? 'The player moves once the transfer completes.' : undefined,
                    confirmLabel: accept ? (action?.terms ? 'Accept Terms' : 'Accept') : action?.withdraw ? 'Withdraw' : 'Reject',
                    tone: accept ? 'success' as const : 'warning' as const,
                    icon: accept ? CheckCircleIcon : XCircleIcon,
                    body: t ? (
                        <ConfirmSummary rows={[
                            ['Player', name],
                            ['Type', t.type],
                            ['From', t.from_team?.name],
                            ['To', t.to_team?.name || 'Open Market'],
                            ['Value', pts(t.asking_price)],
                        ]} />
                    ) : undefined,
                };
            }
        }
    })();

    // A form's Escape and backdrop leave it alone while its confirm is up.
    const closeUnlessConfirming = (close: () => void) => () => {
        if (!pendingAction) close();
    };

    const bidOverBudget = budget ? bidValue > budget.remaining : false;
    const requestOverBudget = budget ? requestPrice > budget.remaining : false;

    const windowCloses = windowStatus.data?.closes_at ? ` (closes ${new Date(windowStatus.data.closes_at).toLocaleDateString()})` : '';

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Transfer Market"
                subtitle="Trade, list and bid on players across the league."
                actions={windowStatus.is_open && (
                    <>
                        <Button className="w-full sm:w-auto" icon={TagIcon} onClick={handleFetchContractsForListing}>
                            List Player for Sale
                        </Button>
                        <Button variant="navy" className="w-full sm:w-auto" icon={ArrowsRightLeftIcon} onClick={handleOpenDirectSaleModal}>
                            Direct Sale to Team
                        </Button>
                        <Button variant="secondary" className="w-full sm:w-auto" icon={UserPlusIcon} onClick={handleOpenRequestModal}>
                            Request Player Transfer
                        </Button>
                    </>
                )}
            />

            {/* Window Status Banner */}
            <div className={`p-4 rounded-xl shadow-sm border flex items-start gap-3 ${
                windowStatus.is_open
                    ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
            }`}>
                {windowStatus.is_open
                    ? <LockOpenIcon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                    : <LockClosedIcon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />}
                <div className="min-w-0">
                    <h2 className="font-bold text-sm">
                        Transfer window {windowStatus.is_open ? 'open' : 'closed'}
                    </h2>
                    <p className="text-xs opacity-80">
                        {windowStatus.is_open
                            ? `Active window: ${windowStatus.data?.name || 'Current Window'}${windowCloses}`
                            : 'The transfer window is currently closed. Buying, trading, and listing players are blocked until the next window opens.'}
                    </p>
                </div>
            </div>

            {/* Budget Card */}
            {budget && (
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                    <div className="space-y-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Team Budget</span>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{budget.remaining.toLocaleString()} pts</span>
                            <span className="text-xs font-semibold text-gray-500">remaining of {budget.total_budget.toLocaleString()} pts</span>
                        </div>
                    </div>

                    <div className="w-full sm:w-64 bg-gray-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden shrink-0">
                        <div
                            className="bg-sffl-red h-full transition-all duration-500"
                            style={{ width: `${budget.total_budget > 0 ? Math.min(100, (budget.spent / budget.total_budget) * 100) : 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <Tabs
                aria-label="Transfers"
                items={[
                    { value: 'market', label: 'Transfer Market' },
                    { value: 'my-listings', label: `My Listings (${myListings.length})` },
                    { value: 'incoming', label: `Incoming Offers (${incomingTransfers.length})` },
                    { value: 'outgoing', label: `Outgoing Proposals (${outgoingTransfers.length})` },
                ]}
                value={activeTab}
                onChange={setActiveTab}
            />

            {/* Tab 1: Transfer Market */}
            {activeTab === 'market' && (
                loading ? (
                    <Spinner label="Loading market listings" />
                ) : marketListings.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        No players currently listed on the transfer market.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                        {marketListings.map(t => {
                            const highestBid = t.bids && t.bids.length > 0 ? Math.max(...t.bids.map(b => b.bid_value)) : 0;
                            return (
                                <div key={t.id} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        {t.player?.image ? (
                                            <img src={t.player.image} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm shrink-0" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-sffl-navy/10 flex items-center justify-center font-bold text-sffl-navy dark:text-white shrink-0">
                                                #{t.player?.jersey_number || '?'}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg wrap-break-word">{t.player?.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{t.from_team?.name} · {t.player?.position}</p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl flex justify-between items-center gap-3 text-xs">
                                        <div>
                                            <span className="text-gray-400 block font-medium">Asking Price</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{t.asking_price?.toLocaleString()} pts</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-400 block font-medium">Highest Bid</span>
                                            <span className="font-bold text-sffl-red">{highestBid > 0 ? `${highestBid.toLocaleString()} pts` : 'No bids'}</span>
                                        </div>
                                    </div>

                                    {windowStatus.is_open && t.from_team?.id !== budget?.team_id && (
                                        <Button
                                            variant="navy"
                                            fullWidth
                                            icon={BanknotesIcon}
                                            onClick={() => {
                                                setSelectedListing(t);
                                                setBidValue(t.asking_price || 1000000);
                                            }}
                                        >
                                            Place Bid
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Tab 2: My Listings */}
            {activeTab === 'my-listings' && (
                loading ? (
                    <Spinner label="Loading your listings" />
                ) : myListings.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-12 text-center text-gray-400 rounded-2xl border border-gray-200 dark:border-gray-700">
                        You have no active player listings on the market.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {myListings.map(t => (
                            <div key={t.id} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        {t.player?.image ? (
                                            <img src={t.player.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-sffl-navy/10 flex items-center justify-center font-bold text-sffl-navy dark:text-white shrink-0">
                                                #{t.player?.jersey_number}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-gray-900 dark:text-white wrap-break-word">{t.player?.name}</h3>
                                            <span className="text-xs text-gray-400">Listed Asking Price: {t.asking_price?.toLocaleString()} pts</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs font-bold rounded-full self-start sm:self-center">
                                        Active Listing
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Received Bids ({t.bids?.length || 0})</h4>
                                    {!t.bids || t.bids.length === 0 ? (
                                        <p className="text-xs text-gray-500">No bids placed on this listing yet.</p>
                                    ) : (
                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {t.bids.map(b => (
                                                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-gray-900 dark:text-white">{b.bidder_team?.name}</span>
                                                        <span className="ml-3 font-mono font-bold text-sffl-red">{b.bid_value.toLocaleString()} pts</span>
                                                    </div>
                                                    {b.status === 'PENDING' ? (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="success"
                                                                onClick={() => setPendingAction({ kind: 'bidResponse', listing: t, bid: b, accept: true })}
                                                            >
                                                                Accept Bid
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                onClick={() => setPendingAction({ kind: 'bidResponse', listing: t, bid: b, accept: false })}
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                            b.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                            {b.status}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Tab 3: Incoming Offers */}
            {activeTab === 'incoming' && (
                <DataTable
                    data={incomingTransfers}
                    columns={incomingColumns}
                    getRowId={(t) => t.id}
                    loading={loading}
                    paginated={false}
                    searchPlaceholder="Search incoming offers"
                    emptyMessage="No incoming transfer requests or direct sale proposals."
                />
            )}

            {/* Tab 4: Outgoing Proposals */}
            {activeTab === 'outgoing' && (
                <DataTable
                    data={outgoingTransfers}
                    columns={outgoingColumns}
                    getRowId={(t) => t.id}
                    loading={loading}
                    paginated={false}
                    searchPlaceholder="Search outgoing proposals"
                    emptyMessage="No active outgoing transfer requests or direct sale proposals."
                />
            )}

            {/* Place Bid */}
            <Modal
                open={!!selectedListing}
                onClose={closeUnlessConfirming(() => setSelectedListing(null))}
                title="Place Bid"
                maxWidth="md"
                footer={selectedListing && (
                    <FormButtons
                        onCancel={() => setSelectedListing(null)}
                        onSubmit={submitBid}
                        disabled={bidOverBudget}
                        label="Submit Bid"
                    />
                )}
            >
                {selectedListing && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Target Player</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5 wrap-break-word">
                                {selectedListing.player?.name}{' '}
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">({selectedListing.from_team?.name})</span>
                            </p>
                        </div>

                        <Field
                            label="Your Bid Amount (Points)"
                            htmlFor="bid-amount"
                            error={budget && bidOverBudget ? `Remaining Budget: ${budget.remaining.toLocaleString()} pts` : undefined}
                            hint={budget && !bidOverBudget ? `Remaining Budget: ${budget.remaining.toLocaleString()} pts` : undefined}
                        >
                            <Input
                                id="bid-amount"
                                type="number"
                                step="100000"
                                min="100000"
                                value={bidValue}
                                onChange={e => setBidValue(parseInt(e.target.value, 10))}
                                invalid={bidOverBudget}
                            />
                        </Field>
                    </div>
                )}
            </Modal>

            {/* List Player for Sale */}
            <Modal
                open={showListModal}
                onClose={closeUnlessConfirming(() => setShowListModal(false))}
                title="List Player for Sale"
                maxWidth="md"
                footer={<FormButtons onCancel={() => setShowListModal(false)} onSubmit={submitListing} disabled={!selectedContract} label="Publish Listing" />}
            >
                <div className="space-y-4">
                    <Field label="Select Player" htmlFor="listing-player">
                        <Select
                            id="listing-player"
                            value={selectedContract?.id || ''}
                            onChange={e => {
                                const c = myContracts.find(mc => mc.id === e.target.value);
                                setSelectedContract(c || null);
                                if (c) setAskingPrice(c.player_value);
                            }}
                        >
                            <option value="">Choose an active player</option>
                            {myContracts.map(c => (
                                <option key={c.id} value={c.id}>{c.player?.name} ({c.player?.position}) - Val: {c.player_value.toLocaleString()} pts</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Asking Price (Points)" htmlFor="listing-asking-price">
                        <Input
                            id="listing-asking-price"
                            type="number"
                            step="100000"
                            min="0"
                            value={askingPrice}
                            onChange={e => setAskingPrice(parseInt(e.target.value, 10))}
                        />
                    </Field>
                </div>
            </Modal>

            {/* Direct Sale */}
            <Modal
                open={showDirectSaleModal}
                onClose={closeUnlessConfirming(() => setShowDirectSaleModal(false))}
                title="Propose Direct Sale"
                maxWidth="md"
                footer={
                    <FormButtons
                        onCancel={() => setShowDirectSaleModal(false)}
                        onSubmit={submitDirectSale}
                        disabled={!selectedContract || !directSaleTargetTeamId}
                        label="Submit Sale Proposal"
                    />
                }
            >
                <div className="space-y-4">
                    <Field label="Select Player to Sell" htmlFor="direct-sale-player">
                        <Select
                            id="direct-sale-player"
                            value={selectedContract?.id || ''}
                            onChange={e => {
                                const c = myContracts.find(mc => mc.id === e.target.value);
                                setSelectedContract(c || null);
                                if (c) setDirectSalePrice(c.player_value);
                            }}
                        >
                            <option value="">Choose an active player</option>
                            {myContracts.map(c => (
                                <option key={c.id} value={c.id}>{c.player?.name} ({c.player?.position})</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Target Buyer Team" htmlFor="direct-sale-team">
                        <Select id="direct-sale-team" value={directSaleTargetTeamId} onChange={e => setDirectSaleTargetTeamId(e.target.value)}>
                            <option value="">Choose a target team</option>
                            {allTeams.map(tm => (
                                <option key={tm.id} value={tm.id}>{tm.name}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Agreed Sale Price (Points)" htmlFor="direct-sale-price">
                        <Input
                            id="direct-sale-price"
                            type="number"
                            step="100000"
                            min="0"
                            value={directSalePrice}
                            onChange={e => setDirectSalePrice(parseInt(e.target.value, 10))}
                        />
                    </Field>
                </div>
            </Modal>

            {/* Transfer Request */}
            <Modal
                open={showRequestModal}
                onClose={closeUnlessConfirming(() => setShowRequestModal(false))}
                title="Request Player Transfer"
                maxWidth="md"
                footer={
                    <FormButtons
                        onCancel={() => setShowRequestModal(false)}
                        onSubmit={submitRequest}
                        disabled={!requestPlayerId || requestOverBudget}
                        label="Send Transfer Request"
                    />
                }
            >
                <div className="space-y-4">
                    <Field label="Target Team" htmlFor="request-team">
                        <Select id="request-team" value={requestTargetTeamId} onChange={e => handleSelectTargetTeamForRequest(e.target.value)}>
                            <option value="">Choose a team</option>
                            {allTeams.map(tm => (
                                <option key={tm.id} value={tm.id}>{tm.name}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Select Target Player" htmlFor="request-player">
                        <Select
                            id="request-player"
                            value={requestPlayerId}
                            onChange={e => setRequestPlayerId(e.target.value)}
                            disabled={!requestTargetTeamId}
                        >
                            <option value="">Choose a player</option>
                            {targetTeamPlayers.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                            ))}
                        </Select>
                    </Field>

                    <Field
                        label="Offered Transfer Value (Points)"
                        htmlFor="request-price"
                        error={budget && requestOverBudget ? `Remaining Budget: ${budget.remaining.toLocaleString()} pts` : undefined}
                        hint={budget && !requestOverBudget ? `Remaining Budget: ${budget.remaining.toLocaleString()} pts` : undefined}
                    >
                        <Input
                            id="request-price"
                            type="number"
                            step="100000"
                            min="100000"
                            value={requestPrice}
                            onChange={e => setRequestPrice(parseInt(e.target.value, 10))}
                            invalid={requestOverBudget}
                        />
                    </Field>
                </div>
            </Modal>

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
