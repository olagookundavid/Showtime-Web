import React, { useState, useEffect } from 'react';
import { contractsApi, type ContractData, type Player } from '../../services/api';
import toast from 'react-hot-toast';

export const TeamHeadContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'free-agents'>('active');
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>('');

    // Modal state
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [contractLength, setContractLength] = useState<number>(13);
    const [playerValue, setPlayerValue] = useState<number>(1000000);
    const [issuing, setIssuing] = useState<boolean>(false);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await contractsApi.getTeamContracts({ limit: 100 });
            setContracts(res.data || []);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to fetch team contracts');
        } finally {
            setLoading(false);
        }
    };

    const fetchFreeAgents = async () => {
        try {
            const res = await contractsApi.getFreeAgents({ search, limit: 50 });
            setFreeAgents(res.data || []);
        } catch (err: any) {
            toast.error('Failed to fetch free agents');
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    useEffect(() => {
        if (activeTab === 'free-agents') {
            fetchFreeAgents();
        }
    }, [activeTab, search]);

    const handleIssueContract = async () => {
        if (!selectedPlayer) return;
        setIssuing(true);
        try {
            await contractsApi.issue({
                player_id: selectedPlayer.id,
                contract_length: Number(contractLength),
                player_value: Number(playerValue),
            });
            toast.success(`Contract offer sent to ${selectedPlayer.name}`);
            setSelectedPlayer(null);
            fetchContracts();
            setActiveTab('pending');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to issue contract offer');
        } finally {
            setIssuing(false);
        }
    };

    const handleRelease = async (contractId: string, playerName: string) => {
        if (!window.confirm(`Are you sure you want to release ${playerName}? They will become a free agent.`)) return;
        try {
            await contractsApi.release(contractId);
            toast.success(`${playerName} released from contract`);
            fetchContracts();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to release player');
        }
    };

    const handleRenew = async (contractId: string, playerName: string) => {
        const lenStr = window.prompt(`Enter renewal contract length in team matches for ${playerName}:`, '13');
        if (!lenStr) return;
        const len = parseInt(lenStr, 10);
        if (isNaN(len) || len <= 0) {
            toast.error('Invalid match count');
            return;
        }

        try {
            await contractsApi.renew(contractId, { contract_length: len });
            toast.success(`Extension offer sent to ${playerName}`);
            fetchContracts();
            setActiveTab('pending');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to offer contract extension');
        }
    };

    const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
    const pendingContracts = contracts.filter(c => c.status === 'PENDING');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Team Contracts</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Issue, renew, and manage player contracts for your roster.</p>
                </div>
                <button
                    id="find-free-agents-btn"
                    onClick={() => setActiveTab('free-agents')}
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                >
                    + Find Free Agents
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'active'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Active Contracts ({activeContracts.length})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'pending'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Pending Offers ({pendingContracts.length})
                </button>
                <button
                    onClick={() => setActiveTab('free-agents')}
                    className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'free-agents'
                            ? 'border-sffl-red text-sffl-red'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Free Agents Market
                </button>
            </div>

            {/* Tab 1: Active Contracts */}
            {activeTab === 'active' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading contracts...</div>
                    ) : activeContracts.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No active player contracts found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="p-4">Player</th>
                                        <th className="p-4">Position</th>
                                        <th className="p-4">Matches Played / Total</th>
                                        <th className="p-4">Remaining</th>
                                        <th className="p-4">Value</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                    {activeContracts.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="p-4 font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                                                {c.player?.image ? (
                                                    <img src={c.player.image} alt={c.player.name} className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-sffl-navy/10 flex items-center justify-center font-bold text-xs text-sffl-navy">
                                                        {c.player?.name?.slice(0, 2) || 'P'}
                                                    </div>
                                                )}
                                                <div>
                                                    <div>{c.player?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-400">#{c.player?.jersey_number}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">{c.player?.position || '-'}</td>
                                            <td className="p-4 text-gray-900 dark:text-white font-mono font-bold">
                                                {c.matches_played} / {c.contract_length}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                    c.matches_remaining <= 2 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                }`}>
                                                    {c.matches_remaining} matches left
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player_value.toLocaleString()} pts</td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleRenew(c.id, c.player?.name || 'Player')}
                                                    className="px-3 py-1 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    Extend
                                                </button>
                                                <button
                                                    onClick={() => handleRelease(c.id, c.player?.name || 'Player')}
                                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    Release
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Pending Offers */}
            {activeTab === 'pending' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {pendingContracts.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No pending contract offers.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="p-4">Player</th>
                                        <th className="p-4">Offered Length</th>
                                        <th className="p-4">Offered Value</th>
                                        <th className="p-4">Offered Date</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                    {pendingContracts.map(c => (
                                        <tr key={c.id}>
                                            <td className="p-4 font-semibold text-gray-900 dark:text-white">{c.player?.name || 'Unknown'}</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">{c.contract_length} team matches</td>
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player_value.toLocaleString()} pts</td>
                                            <td className="p-4 text-gray-400 text-xs">{new Date(c.offered_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-md text-xs font-bold">
                                                    Awaiting Player Acceptance
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Free Agents */}
            {activeTab === 'free-agents' && (
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Search free agents by name or position..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full max-w-md px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {freeAgents.map(p => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {p.image ? (
                                        <img src={p.image} alt={p.name} className="w-12 h-12 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-sffl-red/10 text-sffl-red flex items-center justify-center font-black text-lg">
                                            {p.name.slice(0, 2)}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{p.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.position || 'Unassigned'} • Free Agent</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedPlayer(p)}
                                    className="px-3 py-1.5 bg-sffl-red hover:bg-sffl-red/90 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Offer Contract
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal for Offering Contract */}
            {selectedPlayer && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Offer Contract</h3>
                            <button onClick={() => setSelectedPlayer(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Player</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{selectedPlayer.name} ({selectedPlayer.position || 'No Position'})</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Contract Length (Team Matches)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={contractLength}
                                    onChange={e => setContractLength(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                                <span className="text-xs text-gray-400 mt-1 block">Default is 13 matches (August standard).</span>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Player Point Value
                                </label>
                                <input
                                    type="number"
                                    step="100000"
                                    min="100000"
                                    value={playerValue}
                                    onChange={e => setPlayerValue(parseInt(e.target.value, 10))}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                                <span className="text-xs text-gray-400 mt-1 block">Default is 1,000,000 points.</span>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setSelectedPlayer(null)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleIssueContract}
                                disabled={issuing}
                                className="flex-1 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {issuing ? 'Sending...' : 'Send Contract Offer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
