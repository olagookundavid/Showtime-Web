import React, { useState, useEffect } from 'react';
import { transfersApi, contractsApi, getTeams, type TransferData, type TeamBudgetData, type TransferWindowData, type ContractData, type Team } from '../../services/api';
import toast from 'react-hot-toast';

export const TeamHeadTransfers: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'market' | 'my-listings' | 'incoming' | 'outgoing'>('market');
    const [marketListings, setMarketListings] = useState<TransferData[]>([]);
    const [teamTransfers, setTeamTransfers] = useState<TransferData[]>([]);
    const [budget, setBudget] = useState<TeamBudgetData | null>(null);
    const [windowStatus, setWindowStatus] = useState<{ data: TransferWindowData | null; is_open: boolean }>({ data: null, is_open: false });
    const [myContracts, setMyContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Bidding state
    const [selectedListing, setSelectedListing] = useState<TransferData | null>(null);
    const [bidValue, setBidValue] = useState<number>(1000000);
    const [submittingBid, setSubmittingBid] = useState<boolean>(false);

    // Listing player state
    const [showListModal, setShowListModal] = useState<boolean>(false);
    const [selectedContract, setSelectedContract] = useState<ContractData | null>(null);
    const [askingPrice, setAskingPrice] = useState<number>(1000000);
    const [submittingListing, setSubmittingListing] = useState<boolean>(false);

    // Direct Sale state
    const [showDirectSaleModal, setShowDirectSaleModal] = useState<boolean>(false);
    const [directSaleTargetTeamId, setDirectSaleTargetTeamId] = useState<string>('');
    const [directSalePrice, setDirectSalePrice] = useState<number>(1000000);
    const [submittingDirectSale, setSubmittingDirectSale] = useState<boolean>(false);

    // Transfer Request state
    const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
    const [requestTargetTeamId, setRequestTargetTeamId] = useState<string>('');
    const [requestPlayerId, setRequestPlayerId] = useState<string>('');
    const [requestPrice, setRequestPrice] = useState<number>(1000000);
    const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [targetTeamPlayers, setTargetTeamPlayers] = useState<{ id: string; name: string; position: string }[]>([]);

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
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to fetch transfer data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
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

    const handleCreateDirectSale = async () => {
        if (!selectedContract || !directSaleTargetTeamId) {
            toast.error('Please select both a player and target team');
            return;
        }
        setSubmittingDirectSale(true);
        try {
            await transfersApi.createDirectSale({
                player_id: selectedContract.player_id,
                to_team_id: directSaleTargetTeamId,
                price: directSalePrice,
            });
            toast.success('Direct sale proposal submitted successfully');
            setShowDirectSaleModal(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create direct sale proposal');
        } finally {
            setSubmittingDirectSale(false);
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

    const handleCreateRequest = async () => {
        if (!requestPlayerId || !requestTargetTeamId) {
            toast.error('Please select a target team and player');
            return;
        }
        setSubmittingRequest(true);
        try {
            await transfersApi.createRequest({
                player_id: requestPlayerId,
                to_team_id: requestTargetTeamId,
            });
            toast.success('Transfer request submitted successfully');
            setShowRequestModal(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to submit transfer request');
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleListPlayer = async () => {
        if (!selectedContract) return;
        setSubmittingListing(true);
        try {
            await transfersApi.createListing({
                player_id: selectedContract.player_id,
                asking_price: askingPrice,
            });
            toast.success('Player listed on transfer market');
            setShowListModal(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to list player');
        } finally {
            setSubmittingListing(false);
        }
    };

    const handlePlaceBid = async () => {
        if (!selectedListing) return;
        setSubmittingBid(true);
        try {
            await transfersApi.placeBid(selectedListing.id, { bid_value: bidValue });
            toast.success('Bid placed successfully!');
            setSelectedListing(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to place bid');
        } finally {
            setSubmittingBid(false);
        }
    };

    const handleRespondToBid = async (transferId: string, bidId: string, action: 'accept' | 'reject') => {
        if (action === 'accept' && !window.confirm('Accepting this bid will transfer your player and complete the sale. Proceed?')) return;
        try {
            await transfersApi.respondToBid(transferId, bidId, action);
            toast.success(`Bid ${action}ed successfully`);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to respond to bid');
        }
    };

    const handleRespondToTransfer = async (transferId: string, action: 'accept' | 'reject' | 'review') => {
        let notes = '';
        if (action === 'review') {
            notes = window.prompt('Enter review notes or requested counter-terms:') || '';
            if (!notes) return;
        }

        try {
            await transfersApi.respond(transferId, { action, notes });
            toast.success(`Transfer request ${action}ed`);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to respond to transfer');
        }
    };

    const currentTeamId = budget?.team_id;

    const incomingTransfers = teamTransfers.filter(t => 
        (t.status === 'PENDING' || t.status === 'REVIEW') && t.to_team?.id === currentTeamId
    );
    const outgoingTransfers = teamTransfers.filter(t => 
        (t.status === 'PENDING' || t.status === 'REVIEW') && t.from_team?.id === currentTeamId
    );
    const myListings = teamTransfers.filter(t => 
        t.type === 'LISTING' && t.from_team?.id === currentTeamId
    );

    return (
        <div className="space-y-6">
            {/* Window Status Banner */}
            <div className={`p-4 rounded-xl shadow-sm border flex items-center justify-between ${
                windowStatus.is_open
                    ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
            }`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl">{windowStatus.is_open ? '🔓' : '🔒'}</span>
                    <div>
                        <h4 className="font-bold text-sm uppercase tracking-wide">
                            Transfer Window Status: {windowStatus.is_open ? 'OPEN' : 'CLOSED'}
                        </h4>
                        <p className="text-xs opacity-80">
                            {windowStatus.is_open
                                ? `Active window: ${windowStatus.data?.name || 'Current Window'} (closes ${new Date(windowStatus.data?.closes_at || '').toLocaleDateString()})`
                                : 'The transfer window is currently closed. Buying, trading, and listing players are blocked until the next window opens.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Budget Header Card */}
            {budget && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Team Budget Standing</span>
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-gray-900 dark:text-white">{budget.remaining.toLocaleString()} pts</span>
                            <span className="text-xs font-semibold text-gray-500">remaining of {budget.total_budget.toLocaleString()} pts</span>
                        </div>
                    </div>

                    <div className="w-full sm:w-64 bg-gray-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                        <div
                            className="bg-sffl-red h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (budget.spent / budget.total_budget) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Transfer Hub</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trade, list, and bid on players across the league.</p>
                </div>

                {windowStatus.is_open && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleFetchContractsForListing}
                            className="inline-flex items-center justify-center px-4 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                        >
                            + List Player for Sale
                        </button>
                        <button
                            onClick={handleOpenDirectSaleModal}
                            className="inline-flex items-center justify-center px-4 py-2.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                        >
                            + Direct Sale to Team
                        </button>
                        <button
                            onClick={handleOpenRequestModal}
                            className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                        >
                            + Request Player Transfer
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('market')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'market'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Transfer Market
                </button>
                <button
                    onClick={() => setActiveTab('my-listings')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'my-listings'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    My Listings ({myListings.length})
                </button>
                <button
                    onClick={() => setActiveTab('incoming')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'incoming'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Incoming Offers ({incomingTransfers.length})
                </button>
                <button
                    onClick={() => setActiveTab('outgoing')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'outgoing'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Outgoing Proposals ({outgoingTransfers.length})
                </button>
            </div>

            {/* Tab 1: Transfer Market */}
            {activeTab === 'market' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full p-12 text-center text-gray-400">Loading market listings...</div>
                    ) : marketListings.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-gray-400">No players currently listed on the transfer market.</div>
                    ) : (
                        marketListings.map(t => {
                            const highestBid = t.bids && t.bids.length > 0 ? Math.max(...t.bids.map(b => b.bid_value)) : 0;
                            return (
                                <div key={t.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                                    <div className="flex items-center gap-4">
                                        {t.player?.image ? (
                                            <img src={t.player.image} alt={t.player.name} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-sffl-navy/10 flex items-center justify-center font-bold text-sffl-navy">
                                                #{t.player?.jersey_number || '?'}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{t.player?.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{t.from_team?.name} • {t.player?.position}</p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl flex justify-between items-center text-xs">
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
                                        <button
                                            onClick={() => {
                                                setSelectedListing(t);
                                                setBidValue(t.asking_price || 1000000);
                                            }}
                                            className="w-full py-2.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-bold text-xs rounded-xl shadow transition-colors"
                                        >
                                            Place Bid
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Tab 2: My Listings */}
            {activeTab === 'my-listings' && (
                <div className="space-y-6">
                    {myListings.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-12 text-center text-gray-400 rounded-2xl border border-gray-200 dark:border-gray-700">
                            You have no active player listings on the market.
                        </div>
                    ) : (
                        myListings.map(t => (
                            <div key={t.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                                    <div className="flex items-center gap-4">
                                        {t.player?.image ? (
                                            <img src={t.player.image} alt={t.player.name} className="w-12 h-12 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-sffl-navy/10 flex items-center justify-center font-bold text-sffl-navy">
                                                #{t.player?.jersey_number}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{t.player?.name}</h3>
                                            <span className="text-xs text-gray-400">Listed Asking Price: {t.asking_price?.toLocaleString()} pts</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs font-bold rounded-full self-start sm:self-center">
                                        ACTIVE LISTING
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Received Bids ({t.bids?.length || 0})</h4>
                                    {!t.bids || t.bids.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic">No bids placed on this listing yet.</p>
                                    ) : (
                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {t.bids.map(b => (
                                                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                                                    <div>
                                                        <span className="font-bold text-gray-900 dark:text-white">{b.bidder_team?.name}</span>
                                                        <span className="ml-3 font-mono font-bold text-sffl-red">{b.bid_value.toLocaleString()} pts</span>
                                                    </div>
                                                    {b.status === 'PENDING' ? (
                                                        <div className="space-x-2">
                                                            <button
                                                                onClick={() => handleRespondToBid(t.id, b.id, 'accept')}
                                                                className="px-3 py-1 bg-green-500 text-white font-bold text-xs rounded-lg hover:bg-green-600 transition-colors"
                                                            >
                                                                Accept Bid
                                                            </button>
                                                            <button
                                                                onClick={() => handleRespondToBid(t.id, b.id, 'reject')}
                                                                className="px-3 py-1 bg-red-100 text-red-600 font-bold text-xs rounded-lg hover:bg-red-200 transition-colors"
                                                            >
                                                                Reject
                                                            </button>
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
                        ))
                    )}
                </div>
            )}

            {/* Tab 3: Incoming Offers */}
            {activeTab === 'incoming' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {incomingTransfers.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No incoming transfer requests or direct sale proposals.</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {incomingTransfers.map(t => (
                                <div key={t.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-sffl-navy/10 text-sffl-navy text-xs font-bold rounded">
                                                {t.type}
                                            </span>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{t.player?.name}</h3>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            From: <span className="font-bold text-gray-700 dark:text-gray-300">{t.from_team?.name}</span> • Offered Value: <span className="font-bold">{t.asking_price?.toLocaleString()} pts</span>
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRespondToTransfer(t.id, 'accept')}
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl transition-colors"
                                        >
                                            Accept
                                        </button>
                                        {t.type === 'REQUEST' && (
                                            <button
                                                onClick={() => handleRespondToTransfer(t.id, 'review')}
                                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors"
                                            >
                                                Request Review
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRespondToTransfer(t.id, 'reject')}
                                            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 font-bold text-xs rounded-xl transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 4: Outgoing Proposals */}
            {activeTab === 'outgoing' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {outgoingTransfers.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No active outgoing transfer requests or direct sale proposals.</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {outgoingTransfers.map(t => (
                                <div key={t.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-sffl-navy/10 text-sffl-navy text-xs font-bold rounded">
                                                {t.type}
                                            </span>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{t.player?.name}</h3>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Target Club: <span className="font-bold text-gray-700 dark:text-gray-300">{t.to_team?.name || 'Free Agent'}</span> • Offered Value: <span className="font-bold">{t.asking_price ? `${t.asking_price.toLocaleString()} pts` : 'N/A'}</span>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full">
                                            {t.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal for Placing Bid */}
            {selectedListing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Place Bid</h3>
                            <button onClick={() => setSelectedListing(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Target Player</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{selectedListing.player?.name} ({selectedListing.from_team?.name})</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Your Bid Amount (Points)
                                </label>
                                <input
                                    type="number"
                                    step="100000"
                                    min="100000"
                                    value={bidValue}
                                    onChange={e => setBidValue(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                                {budget && (
                                    <span className={`text-xs mt-1 block font-medium ${bidValue > budget.remaining ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                        Remaining Budget: {budget.remaining.toLocaleString()} pts
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setSelectedListing(null)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePlaceBid}
                                disabled={submittingBid || (budget ? bidValue > budget.remaining : false)}
                                className="flex-1 py-2.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submittingBid ? 'Placing Bid...' : 'Submit Bid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Listing Player */}
            {showListModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">List Player for Sale</h3>
                            <button onClick={() => setShowListModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select Player</label>
                                <select
                                    onChange={e => {
                                        const c = myContracts.find(mc => mc.id === e.target.value);
                                        setSelectedContract(c || null);
                                        if (c) setAskingPrice(c.player_value);
                                    }}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                >
                                    <option value="">-- Choose active player --</option>
                                    {myContracts.map(c => (
                                        <option key={c.id} value={c.id}>{c.player?.name} ({c.player?.position})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Asking Price (Points)</label>
                                <input
                                    type="number"
                                    step="100000"
                                    min="100000"
                                    value={askingPrice}
                                    onChange={e => setAskingPrice(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setShowListModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleListPlayer}
                                disabled={submittingListing || !selectedContract}
                                className="flex-1 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submittingListing ? 'Publishing...' : 'Publish Listing'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Direct Sale */}
            {showDirectSaleModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Propose Direct Sale</h3>
                            <button onClick={() => setShowDirectSaleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select Player to Sell</label>
                                <select
                                    onChange={e => {
                                        const c = myContracts.find(mc => mc.id === e.target.value);
                                        setSelectedContract(c || null);
                                        if (c) setDirectSalePrice(c.player_value);
                                    }}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                >
                                    <option value="">-- Choose active player --</option>
                                    {myContracts.map(c => (
                                        <option key={c.id} value={c.id}>{c.player?.name} ({c.player?.position})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Target Buyer Team</label>
                                <select
                                    value={directSaleTargetTeamId}
                                    onChange={e => setDirectSaleTargetTeamId(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                >
                                    <option value="">-- Choose target team --</option>
                                    {allTeams.map(tm => (
                                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Agreed Sale Price (Points)</label>
                                <input
                                    type="number"
                                    step="100000"
                                    min="0"
                                    value={directSalePrice}
                                    onChange={e => setDirectSalePrice(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setShowDirectSaleModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateDirectSale}
                                disabled={submittingDirectSale || !selectedContract || !directSaleTargetTeamId}
                                className="flex-1 py-2.5 bg-sffl-navy hover:bg-sffl-navy/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submittingDirectSale ? 'Submitting...' : 'Submit Sale Proposal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Transfer Request */}
            {showRequestModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Request Player Transfer</h3>
                            <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Target Team</label>
                                <select
                                    value={requestTargetTeamId}
                                    onChange={e => handleSelectTargetTeamForRequest(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                >
                                    <option value="">-- Choose team --</option>
                                    {allTeams.map(tm => (
                                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select Target Player</label>
                                <select
                                    value={requestPlayerId}
                                    onChange={e => setRequestPlayerId(e.target.value)}
                                    disabled={!requestTargetTeamId}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold disabled:opacity-50"
                                >
                                    <option value="">-- Choose player --</option>
                                    {targetTeamPlayers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Offered Transfer Value (Points)</label>
                                <input
                                    type="number"
                                    step="100000"
                                    min="100000"
                                    value={requestPrice}
                                    onChange={e => setRequestPrice(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                                {budget && (
                                    <span className={`text-xs mt-1 block font-medium ${requestPrice > budget.remaining ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                        Remaining Budget: {budget.remaining.toLocaleString()} pts
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRequest}
                                disabled={submittingRequest || !requestPlayerId || (budget ? requestPrice > budget.remaining : false)}
                                className="flex-1 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submittingRequest ? 'Sending Request...' : 'Send Transfer Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
