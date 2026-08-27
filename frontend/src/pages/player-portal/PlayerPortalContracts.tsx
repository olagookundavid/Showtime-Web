import React, { useState, useEffect } from 'react';
import { playerPortalApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';
import { NotLinkedNotice } from '../../components/player-portal/NotLinkedNotice';
import { apiError } from '../../components/player-portal/apiError';

export const PlayerPortalContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [notLinked, setNotLinked] = useState<boolean>(false);
    const [responding, setResponding] = useState<string | null>(null);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getContracts();
            setContracts(res || []);
            setNotLinked(false);
        } catch (err) {
            if (apiError(err).code === 'PLAYER_NOT_LINKED') {
                setNotLinked(true);
            } else {
                toast.error('Failed to load contract history');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    // A pending offer is actionable from this page too. It used to be reachable
    // only from the Overview tab, so players who came looking for their contracts
    // here found the offer listed with no way to answer it.
    const handleRespond = async (contractId: string, action: 'accept' | 'reject') => {
        if (action === 'accept' && !window.confirm('Accept this contract offer? You will be signed to the team.')) return;
        if (action === 'reject' && !window.confirm('Reject this contract offer? The team would have to send a new one.')) return;
        setResponding(contractId);
        try {
            await playerPortalApi.respondToContract(contractId, action);
            toast.success(`Contract offer ${action}ed!`);
            fetchContracts();
        } catch (err) {
            toast.error(apiError(err).error || 'Failed to respond to contract offer');
        } finally {
            setResponding(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Contract History</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Complete timeline of your active, past, and expired contracts.</p>
            </div>

            {notLinked && <NotLinkedNotice />}

            {!notLinked && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading contracts...</div>
                ) : contracts.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        No contract records yet. Once your manager offers you a deal it will appear here for you to accept.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Team</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Contract Length</th>
                                    <th className="p-4">Matches Played</th>
                                    <th className="p-4">Value</th>
                                    <th className="p-4">Offered Date</th>
                                    <th className="p-4">Reason / Notes</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {contracts.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                            {c.team?.logo && (
                                                <img src={c.team.logo} alt="" className="w-6 h-6 object-contain" />
                                            )}
                                            {c.team?.name || 'Team'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                c.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : c.status === 'PENDING'
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : c.status === 'EXPIRED'
                                                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                    : 'bg-red-100 text-red-600'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">{c.contract_length} matches</td>
                                        <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">{c.matches_played}</td>
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player_value.toLocaleString()} pts</td>
                                        <td className="p-4 text-gray-400 text-xs">{new Date(c.offered_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-xs text-gray-500">{c.termination_reason || c.notes || '-'}</td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            {c.status === 'PENDING' ? (
                                                <div className="inline-flex gap-2">
                                                    <button
                                                        onClick={() => handleRespond(c.id, 'accept')}
                                                        disabled={responding === c.id}
                                                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {responding === c.id ? '…' : 'Accept'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespond(c.id, 'reject')}
                                                        disabled={responding === c.id}
                                                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}
        </div>
    );
};

export default PlayerPortalContracts;
