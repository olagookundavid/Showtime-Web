import React, { useState, useEffect } from 'react';
import { adminTransfersApi, contractsApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';

export const AdminContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            // Admin fetches all contracts by passing blank team_id
            const res = await contractsApi.getTeamContracts({ limit: 200 });
            setContracts(res.data || []);
        } catch {
            toast.error('Failed to load contracts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const handleOverride = async (contractId: string, currentStatus: string) => {
        const newStatus = window.prompt(`Override contract status (ACTIVE, EXPIRED, TERMINATED, REJECTED). Current: ${currentStatus}`, 'EXPIRED');
        if (!newStatus) return;

        try {
            await adminTransfersApi.overrideContract(contractId, newStatus.toUpperCase());
            toast.success(`Contract status updated to ${newStatus}`);
            fetchContracts();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to override contract status');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Admin Contract Oversight</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Global audit and override management for all player contracts.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading contracts...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Player</th>
                                    <th className="p-4">Team</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Played / Total</th>
                                    <th className="p-4">Value</th>
                                    <th className="p-4">Offered At</th>
                                    <th className="p-4 text-right">Admin Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {contracts.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player?.name}</td>
                                        <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">{c.team?.name}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono">{c.matches_played} / {c.contract_length}</td>
                                        <td className="p-4 font-bold">{c.player_value.toLocaleString()} pts</td>
                                        <td className="p-4 text-xs text-gray-400">{new Date(c.offered_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleOverride(c.id, c.status)}
                                                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg transition-colors"
                                            >
                                                Override Status
                                            </button>
                                        </td>
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

export default AdminContracts;
