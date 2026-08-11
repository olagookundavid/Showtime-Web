import React, { useState, useEffect } from 'react';
import { playerPortalApi, type TransferData } from '../../services/api';
import toast from 'react-hot-toast';

export const PlayerPortalTransfers: React.FC = () => {
    const [transfers, setTransfers] = useState<TransferData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getMyTransfers();
            setTransfers(res.data || []);
        } catch {
            toast.error('Failed to load transfer history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransfers();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
            case 'ACCEPTED':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Completed</span>;
            case 'PENDING':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Pending</span>;
            case 'REJECTED':
            case 'CANCELLED':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">{status}</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Transfer History</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Complete record of your club movements, direct sales, and transfer requests.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading transfer history...</div>
                ) : transfers.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No transfer records found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-4">Transfer Type</th>
                                    <th className="p-4">From Club</th>
                                    <th className="p-4">To Club</th>
                                    <th className="p-4">Fee / Value</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                {transfers.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                                            <span className="uppercase text-xs tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                {t.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 font-semibold text-gray-800 dark:text-gray-200">
                                            {t.from_team?.name || 'Free Agent'}
                                        </td>
                                        <td className="p-4 font-semibold text-sffl-red">
                                            {t.to_team?.name || 'Free Agent'}
                                        </td>
                                        <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">
                                            {t.asking_price ? `₦${t.asking_price.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(t.status)}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500">
                                            {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
