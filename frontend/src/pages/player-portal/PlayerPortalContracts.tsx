import React, { useState, useEffect } from 'react';
import { playerPortalApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';

export const PlayerPortalContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getContracts();
            setContracts(res || []);
        } catch {
            toast.error('Failed to load contract history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Contract History</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Complete timeline of your active, past, and expired contracts.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading contracts...</div>
                ) : contracts.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No contract records found.</div>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerPortalContracts;
