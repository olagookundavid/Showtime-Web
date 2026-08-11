import React, { useState, useEffect } from 'react';
import { playerPortalApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const PlayerPortalOverview: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getContracts();
            setContracts(res || []);
        } catch {
            toast.error('Failed to load contract details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const activeContract = contracts.find(c => c.status === 'ACTIVE');
    const pendingOffers = contracts.filter(c => c.status === 'PENDING');

    const handleRespond = async (contractId: string, action: 'accept' | 'reject') => {
        if (action === 'accept' && !window.confirm('Accept this contract offer? You will be signed to the team.')) return;
        try {
            await playerPortalApi.respondToContract(contractId, action);
            toast.success(`Contract offer ${action}ed!`);
            fetchContracts();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to respond to contract offer');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Player Portal</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">View active contract details and manage pending offers from team managers.</p>
            </div>

            {/* Pending Offers Alert Section */}
            {pendingOffers.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-sffl-red uppercase tracking-wide flex items-center gap-2">
                        <span>📩</span> Pending Contract Offers ({pendingOffers.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingOffers.map(c => (
                            <div key={c.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-2 border-sffl-red/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {c.team?.logo ? (
                                            <img src={c.team.logo} alt={c.team.name} className="w-10 h-10 object-contain" />
                                        ) : (
                                            <div className="w-10 h-10 bg-sffl-navy text-white rounded-xl flex items-center justify-center font-bold text-sm">
                                                {c.team?.name?.slice(0, 2) || 'TM'}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{c.team?.name}</h3>
                                            <p className="text-xs text-gray-400">Offered on {new Date(c.offered_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-md animate-pulse">
                                        ACTION REQUIRED
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                                    <div>
                                        <span className="text-xs text-gray-400 block">Length</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{c.contract_length} Team Matches</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Player Value</span>
                                        <span className="font-bold text-sffl-red">{c.player_value.toLocaleString()} pts</span>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => handleRespond(c.id, 'accept')}
                                        className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                                    >
                                        Accept Offer
                                    </button>
                                    <button
                                        onClick={() => handleRespond(c.id, 'reject')}
                                        className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 font-bold text-sm rounded-xl transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Contract Status Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">Current Contract Status</h2>
                    <Link to="/player-portal/contracts" className="text-xs text-sffl-red font-bold hover:underline">
                        View Full Contract History →
                    </Link>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-gray-400">Loading current status...</div>
                ) : activeContract ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-semibold uppercase">Current Team</span>
                            <div className="flex items-center gap-3">
                                {activeContract.team?.logo && (
                                    <img src={activeContract.team.logo} alt="" className="w-8 h-8 object-contain" />
                                )}
                                <h3 className="text-xl font-black text-gray-900 dark:text-white">{activeContract.team?.name}</h3>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-semibold uppercase">Contract Length</span>
                            <p className="text-xl font-black text-gray-900 dark:text-white">{activeContract.contract_length} matches</p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-semibold uppercase">Matches Played</span>
                            <p className="text-xl font-black text-gray-900 dark:text-white">{activeContract.matches_played} matches</p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-gray-400 font-semibold uppercase">Remaining</span>
                            <p className="text-xl font-black text-green-600 dark:text-green-400">{activeContract.matches_remaining} matches</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <span className="text-3xl mb-2 block">🏃</span>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Free Agent</h3>
                        <p className="text-xs text-gray-500 mt-1">You are not currently under contract with any team. Team managers can issue offers to sign you.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerPortalOverview;
