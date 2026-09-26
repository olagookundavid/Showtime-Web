import React, { useState, useEffect, useMemo } from 'react';
import { contractsApi, type ContractData, type Player } from '../../services/api';
import toast from 'react-hot-toast';
import {
    ArrowPathIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    InformationCircleIcon,
    MagnifyingGlassIcon,
    UserMinusIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

const PAGE_SIZE = 20;
const FREE_AGENT_PAGE_SIZE = 24;
const DEFAULT_LENGTH = 13;

type Tab = 'active' | 'pending' | 'free-agents';

type PendingAction =
    | { kind: 'offer'; player: Player; length: number }
    | { kind: 'extend'; contract: ContractData }
    | { kind: 'release'; contract: ContractData }
    | { kind: 'withdraw'; contract: ContractData };

const nameOf = (c: ContractData) => c.player?.name || 'Player';

const tabClass = (active: boolean) =>
    `min-h-11 px-4 sm:px-6 text-sm font-bold border-b-2 transition-colors ${
        active
            ? 'border-sffl-red text-sffl-red'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`;

const inputClass =
    'w-full min-h-11 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sffl-red';

const PlayerCell = ({ c }: { c: ContractData }) => (
    <div className="flex items-center gap-3 min-w-0">
        {c.player?.image ? (
            <img src={c.player.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
            <div className="w-8 h-8 rounded-full bg-sffl-navy/10 flex items-center justify-center font-bold text-xs text-sffl-navy dark:text-white shrink-0">
                {c.player?.name?.slice(0, 2) || 'P'}
            </div>
        )}
        <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white wrap-break-word">{c.player?.name || 'Unknown'}</div>
            {!!c.player?.jersey_number && <div className="text-xs text-gray-400">#{c.player.jersey_number}</div>}
        </div>
    </div>
);

export const TeamHeadContracts: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('active');

    // ── Active Contracts State (Server-side Filtered & Paginated) ──
    const [activeContracts, setActiveContracts] = useState<ContractData[]>([]);
    const [activePage, setActivePage] = useState<number>(1);
    const [activeTotal, setActiveTotal] = useState<number>(0);
    const [activeTotalPages, setActiveTotalPages] = useState<number>(1);
    const [activeLoading, setActiveLoading] = useState<boolean>(true);
    const [activeSearch, setActiveSearch] = useState<string>('');

    // ── Pending Contracts State (Server-side Filtered & Paginated) ──
    const [pendingContracts, setPendingContracts] = useState<ContractData[]>([]);
    const [pendingPage, setPendingPage] = useState<number>(1);
    const [pendingTotal, setPendingTotal] = useState<number>(0);
    const [pendingTotalPages, setPendingTotalPages] = useState<number>(1);
    const [pendingLoading, setPendingLoading] = useState<boolean>(true);
    const [pendingSearch, setPendingSearch] = useState<string>('');

    // ── Free Agents State (Server-side Filtered & Paginated) ──
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [freeAgentPage, setFreeAgentPage] = useState<number>(1);
    const [freeAgentTotal, setFreeAgentTotal] = useState<number>(0);
    const [freeAgentTotalPages, setFreeAgentTotalPages] = useState<number>(1);
    const [freeAgentsLoading, setFreeAgentsLoading] = useState<boolean>(false);
    const [freeAgentSearch, setFreeAgentSearch] = useState<string>('');

    // Offer form
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [contractLength, setContractLength] = useState<string>(String(DEFAULT_LENGTH));

    // Every write waits here for the confirm dialog.
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [extendLength, setExtendLength] = useState<string>(String(DEFAULT_LENGTH));
    const [busy, setBusy] = useState(false);

    // ── Fetch Active Contracts (WHERE status = 'ACTIVE') ──
    const fetchActiveContracts = async () => {
        setActiveLoading(true);
        try {
            const res = await contractsApi.getTeamContracts({
                status: 'ACTIVE',
                search: activeSearch || undefined,
                page: activePage,
                limit: PAGE_SIZE,
            });
            setActiveContracts(res.data || []);
            setActiveTotal(res.total || 0);
            setActiveTotalPages(res.total_pages || 1);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to fetch active contracts'));
        } finally {
            setActiveLoading(false);
        }
    };

    // ── Fetch Pending Contracts (WHERE status = 'PENDING') ──
    const fetchPendingContracts = async () => {
        setPendingLoading(true);
        try {
            const res = await contractsApi.getTeamContracts({
                status: 'PENDING',
                search: pendingSearch || undefined,
                page: pendingPage,
                limit: PAGE_SIZE,
            });
            setPendingContracts(res.data || []);
            setPendingTotal(res.total || 0);
            setPendingTotalPages(res.total_pages || 1);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to fetch pending contract offers'));
        } finally {
            setPendingLoading(false);
        }
    };

    // ── Fetch Free Agents ──
    const fetchFreeAgents = async () => {
        setFreeAgentsLoading(true);
        try {
            const res = await contractsApi.getFreeAgents({
                search: freeAgentSearch || undefined,
                page: freeAgentPage,
                limit: FREE_AGENT_PAGE_SIZE,
            });
            setFreeAgents(res.data || []);
            setFreeAgentTotal(res.total || 0);
            setFreeAgentTotalPages(res.total_pages || 1);
        } catch {
            toast.error('Failed to fetch free agents');
        } finally {
            setFreeAgentsLoading(false);
        }
    };

    // Initial badge counters fetch
    useEffect(() => {
        fetchActiveContracts();
        fetchPendingContracts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch active contracts when page/search changes
    useEffect(() => {
        if (activeTab === 'active') fetchActiveContracts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activePage, activeSearch]);

    // Re-fetch pending contracts when page/search changes
    useEffect(() => {
        if (activeTab === 'pending') fetchPendingContracts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, pendingPage, pendingSearch]);

    // Re-fetch free agents when page/search changes
    useEffect(() => {
        if (activeTab === 'free-agents') fetchFreeAgents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, freeAgentPage, freeAgentSearch]);

    // A table's search box starts empty when its tab opens, so its filter does too.
    const openTab = (tab: Tab) => {
        if (tab === 'active') { setActiveSearch(''); setActivePage(1); }
        if (tab === 'pending') { setPendingSearch(''); setPendingPage(1); }
        setActiveTab(tab);
    };

    const openOffer = (p: Player) => {
        setContractLength(String(DEFAULT_LENGTH));
        setSelectedPlayer(p);
    };

    const submitOffer = () => {
        if (!selectedPlayer) return;
        const length = parseInt(contractLength, 10);
        if (!(length >= 1 && length <= 50)) {
            toast.error('Contract length must be between 1 and 50 team matches.');
            return;
        }
        setPendingAction({ kind: 'offer', player: selectedPlayer, length });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        let extendBy = 0;
        if (action.kind === 'extend') {
            extendBy = parseInt(extendLength, 10);
            if (!(extendBy > 0)) {
                toast.error('Enter the number of team matches for the extension.');
                return;
            }
        }
        setBusy(true);
        try {
            switch (action.kind) {
                case 'offer':
                    await contractsApi.issue({ player_id: action.player.id, contract_length: action.length, player_value: 0 });
                    toast.success(`Contract offer sent to ${action.player.name}`);
                    setSelectedPlayer(null);
                    openTab('pending');
                    break;
                case 'extend':
                    await contractsApi.renew(action.contract.id, { contract_length: extendBy });
                    toast.success(`Extension offer sent to ${nameOf(action.contract)}`);
                    openTab('pending');
                    break;
                case 'release':
                    await contractsApi.release(action.contract.id);
                    toast.success(`${nameOf(action.contract)} released from contract`);
                    break;
                case 'withdraw':
                    await contractsApi.cancelOffer(action.contract.id);
                    toast.success(`Contract offer for ${nameOf(action.contract)} withdrawn`);
                    break;
            }
            fetchActiveContracts();
            fetchPendingContracts();
        } catch (err) {
            const fallback = {
                offer: 'Failed to issue contract offer',
                extend: 'Failed to offer contract extension',
                release: 'Failed to release player',
                withdraw: 'Failed to withdraw contract offer',
            }[action.kind];
            toast.error(getApiErrorMessage(err, fallback));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const activeColumns = useMemo<Column<ContractData>[]>(() => [
        { header: 'Player', cell: (c) => <PlayerCell c={c} /> },
        { header: 'Position', cell: (c) => <span className="text-gray-600 dark:text-gray-300 font-medium">{c.player?.position || '—'}</span> },
        {
            header: 'Played / Total',
            cell: (c) => <span className="font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">{c.matches_played} / {c.contract_length}</span>,
        },
        {
            header: 'Remaining',
            cell: (c) => (
                <span className={`px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap ${
                    c.matches_remaining <= 2
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                    {c.matches_remaining} matches left
                </span>
            ),
        },
        { header: 'Value', cell: (c) => <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">{c.player_value.toLocaleString()} pts</span> },
        {
            header: 'Actions',
            align: 'right',
            cell: (c) => (
                <RowActions
                    label={`Actions for ${nameOf(c)}`}
                    actions={[
                        {
                            label: 'Extend contract',
                            icon: ArrowPathIcon,
                            onSelect: () => {
                                setExtendLength(String(DEFAULT_LENGTH));
                                setPendingAction({ kind: 'extend', contract: c });
                            },
                        },
                        { label: 'Release player', icon: UserMinusIcon, danger: true, onSelect: () => setPendingAction({ kind: 'release', contract: c }) },
                    ]}
                />
            ),
        },
    ], []);

    const pendingColumns = useMemo<Column<ContractData>[]>(() => [
        { header: 'Player', cell: (c) => <PlayerCell c={c} /> },
        { header: 'Length', cell: (c) => <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{c.contract_length} team matches</span> },
        { header: 'Value', cell: (c) => <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">{c.player_value.toLocaleString()} pts</span> },
        { header: 'Offered', cell: (c) => <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{new Date(c.offered_at).toLocaleDateString()}</span> },
        {
            header: 'Status',
            cell: () => (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-md text-xs font-bold whitespace-nowrap">
                    Awaiting Player Acceptance
                </span>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (c) => (
                <RowActions
                    label={`Actions for ${nameOf(c)}`}
                    actions={[{ label: 'Withdraw offer', icon: XCircleIcon, danger: true, onSelect: () => setPendingAction({ kind: 'withdraw', contract: c }) }]}
                />
            ),
        },
    ], []);

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'offer': {
                const { player, length } = pendingAction;
                return {
                    title: `Offer ${player.name} a contract?`,
                    description: 'The player accepts or declines it from their Player Portal.',
                    confirmLabel: 'Send Offer',
                    tone: 'info' as const,
                    icon: DocumentTextIcon,
                    body: <ConfirmSummary rows={[['Player', player.name], ['Position', player.position], ['Length', `${length} team matches`]]} />,
                };
            }
            case 'extend': {
                const { contract } = pendingAction;
                return {
                    title: `Offer ${nameOf(contract)} an extension?`,
                    description: 'The player accepts or declines it from their Player Portal.',
                    confirmLabel: 'Send Extension Offer',
                    tone: 'info' as const,
                    icon: ArrowPathIcon,
                    body: (
                        <div className="space-y-3">
                            <ConfirmSummary rows={[
                                ['Player', nameOf(contract)],
                                ['Current contract', `${contract.matches_played} / ${contract.contract_length} matches`],
                            ]} />
                            <label className="block">
                                <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                                    Extension length (team matches) <span className="text-sffl-red">*</span>
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    value={extendLength}
                                    onChange={e => setExtendLength(e.target.value)}
                                    className={inputClass}
                                />
                            </label>
                        </div>
                    ),
                };
            }
            case 'release': {
                const { contract } = pendingAction;
                return {
                    title: `Release ${nameOf(contract)}?`,
                    description: 'They become a free agent straight away.',
                    confirmLabel: 'Release Player',
                    tone: 'warning' as const,
                    icon: UserMinusIcon,
                    body: <ConfirmSummary rows={[
                        ['Player', nameOf(contract)],
                        ['Position', contract.player?.position],
                        ['Remaining', `${contract.matches_remaining} matches`],
                    ]} />,
                };
            }
            default: {
                const contract = pendingAction?.contract;
                return {
                    title: contract ? `Withdraw the offer to ${nameOf(contract)}?` : 'Withdraw this offer?',
                    description: undefined,
                    confirmLabel: 'Withdraw Offer',
                    tone: 'warning' as const,
                    icon: XCircleIcon,
                    body: contract ? (
                        <ConfirmSummary rows={[
                            ['Player', nameOf(contract)],
                            ['Length', `${contract.contract_length} team matches`],
                            ['Offered', new Date(contract.offered_at).toLocaleDateString()],
                        ]} />
                    ) : undefined,
                };
            }
        }
    })();

    const countLabel = (n: number, one: string, many: string) => (
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{n} {n === 1 ? one : many}</span>
    );

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Contracts"
                subtitle="Offer, extend and release contracts for the players on your roster."
                actions={
                    <button
                        type="button"
                        onClick={() => openTab('free-agents')}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 min-h-11 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-lg shadow-md transition-colors"
                    >
                        <MagnifyingGlassIcon className="w-4 h-4" aria-hidden="true" />
                        Find Free Agents
                    </button>
                }
            />

            {/* Tabs */}
            <div className="flex overflow-x-auto whitespace-nowrap border-b border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => openTab('active')} aria-pressed={activeTab === 'active'} className={tabClass(activeTab === 'active')}>
                    Active Contracts ({activeTotal})
                </button>
                <button type="button" onClick={() => openTab('pending')} aria-pressed={activeTab === 'pending'} className={tabClass(activeTab === 'pending')}>
                    Pending Offers ({pendingTotal})
                </button>
                <button type="button" onClick={() => openTab('free-agents')} aria-pressed={activeTab === 'free-agents'} className={tabClass(activeTab === 'free-agents')}>
                    Free Agents Market
                </button>
            </div>

            {/* ── Tab 1: Active Contracts ── */}
            {activeTab === 'active' && (
                <DataTable
                    data={activeContracts}
                    columns={activeColumns}
                    getRowId={(c) => c.id}
                    loading={activeLoading}
                    searchPlaceholder="Search by player name"
                    onSearchSubmit={(q) => { setActiveSearch(q.trim()); setActivePage(1); }}
                    serverPage={activePage}
                    totalServerPages={activeTotalPages}
                    onPageChange={setActivePage}
                    headerActions={countLabel(activeTotal, 'Active Player', 'Active Players')}
                    emptyMessage={activeSearch ? 'No active contracts match your search.' : 'No active player contracts found for your team.'}
                />
            )}

            {/* ── Tab 2: Pending Offers ── */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {/* Managers repeatedly reported "I can't accept contracts". They can't —
                        only the player can, from their own portal. Saying so here is cheaper
                        than fielding the question, and points at the usual real cause when a
                        player says they can't either. */}
                    <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 p-3.5">
                        <InformationCircleIcon className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                            <span className="font-bold">Only the player can accept an offer</span>, from their own
                            Player Portal — there's no accept button on this side by design. If a player says they
                            can't see the offer, their account probably isn't linked to their player profile yet:
                            they need to claim it at <span className="font-mono font-bold">/claim</span> with your
                            team's claim code, and you approve it from <span className="font-bold">Account Claims</span>.
                        </p>
                    </div>

                    <DataTable
                        data={pendingContracts}
                        columns={pendingColumns}
                        getRowId={(c) => c.id}
                        loading={pendingLoading}
                        searchPlaceholder="Search pending offers"
                        onSearchSubmit={(q) => { setPendingSearch(q.trim()); setPendingPage(1); }}
                        serverPage={pendingPage}
                        totalServerPages={pendingTotalPages}
                        onPageChange={setPendingPage}
                        headerActions={countLabel(pendingTotal, 'Pending Offer', 'Pending Offers')}
                        emptyMessage={pendingSearch ? 'No pending contract offers match your search.' : 'No pending contract offers awaiting response.'}
                    />
                </div>
            )}

            {/* ── Tab 3: Free Agents ── */}
            {activeTab === 'free-agents' && (
                <div className="space-y-4">
                    <div className="relative w-full sm:max-w-md">
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Search free agents"
                            placeholder="Search free agents by name or position"
                            value={freeAgentSearch}
                            onChange={e => {
                                setFreeAgentSearch(e.target.value);
                                setFreeAgentPage(1);
                            }}
                            className="w-full min-h-11 pl-10 pr-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red"
                        />
                    </div>

                    {freeAgentsLoading ? (
                        <Spinner label="Loading free agents" />
                    ) : freeAgents.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            No free agents found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {freeAgents.map(p => (
                                    <div key={p.id} className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {p.image ? (
                                                <img src={p.image} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-sffl-red/10 text-sffl-red flex items-center justify-center font-black text-lg shrink-0">
                                                    {p.name.slice(0, 2)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white wrap-break-word">{p.name}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{p.position || 'Unassigned'} · Free Agent</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => openOffer(p)}
                                            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 bg-sffl-red hover:bg-sffl-red/90 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            <DocumentTextIcon className="w-4 h-4" aria-hidden="true" />
                                            Offer Contract
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Footer */}
                            {freeAgentTotalPages > 1 && (
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                                    <div>
                                        Showing <span className="font-bold text-gray-900 dark:text-white">{(freeAgentPage - 1) * FREE_AGENT_PAGE_SIZE + 1}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(freeAgentPage * FREE_AGENT_PAGE_SIZE, freeAgentTotal)}</span> of <span className="font-bold text-gray-900 dark:text-white">{freeAgentTotal}</span> free agents
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFreeAgentPage(p => Math.max(1, p - 1))}
                                            disabled={freeAgentPage <= 1}
                                            className="inline-flex items-center gap-1 min-h-11 px-3 border border-gray-200 dark:border-gray-700 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
                                            Previous
                                        </button>
                                        <span className="font-bold text-gray-700 dark:text-gray-300 px-2 whitespace-nowrap">
                                            Page {freeAgentPage} of {freeAgentTotalPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setFreeAgentPage(p => Math.min(freeAgentTotalPages, p + 1))}
                                            disabled={freeAgentPage >= freeAgentTotalPages}
                                            className="inline-flex items-center gap-1 min-h-11 px-3 border border-gray-200 dark:border-gray-700 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Next
                                            <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Offer form. Escape and the backdrop leave it alone while its confirm is up. */}
            <Modal
                open={!!selectedPlayer}
                onClose={() => { if (!pendingAction) setSelectedPlayer(null); }}
                title="Offer Contract"
                maxWidth="md"
            >
                {selectedPlayer && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Player</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5 wrap-break-word">
                                {selectedPlayer.name}{' '}
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">({selectedPlayer.position || 'No Position'})</span>
                            </p>
                        </div>

                        <label className="block">
                            <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Contract Length (Team Matches)</span>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={contractLength}
                                onChange={e => setContractLength(e.target.value)}
                                className={inputClass}
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 block">Default is 13 matches (August standard).</span>
                        </label>

                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedPlayer(null)}
                                className="flex-1 min-h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-sm rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitOffer}
                                className="flex-1 min-h-11 bg-sffl-red hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors shadow-sm"
                            >
                                Send Contract Offer
                            </button>
                        </div>
                    </div>
                )}
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
