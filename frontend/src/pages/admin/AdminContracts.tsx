import React, { useState, useEffect } from 'react';
import { adminTransfersApi, contractsApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';

export const AdminContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(25);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await contractsApi.getTeamContracts({
                status: statusFilter || undefined,
                search: search || undefined,
                page,
                limit,
            });
            setContracts(res.data || []);
            setTotal(res.total || 0);
            setTotalPages(res.total_pages || 1);
        } catch {
            toast.error('Failed to load contracts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, [page, limit, statusFilter, search]);

    const handleOverride = async (contractId: string, currentStatus: string) => {
        const newStatus = window.prompt(`Override contract status (ACTIVE, EXPIRED, TERMINATED, REJECTED, CANCELLED). Current: ${currentStatus}`, 'EXPIRED');
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Admin Contract Oversight</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Global audit, filtering, and status management for all player contracts.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search player or team..."
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sffl-red"
                    />

                    <select
                        value={statusFilter}
                        onChange={e => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sffl-red"
                    >
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PENDING">PENDING</option>
                        <option value="EXPIRED">EXPIRED</option>
                        <option value="TERMINATED">TERMINATED</option>
                        <option value="CANCELLED">CANCELLED</option>
                    </select>

                    <select
                        value={limit}
                        onChange={e => {
                            setLimit(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sffl-red"
                    >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading contracts...</div>
                ) : contracts.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No contract records match your filter criteria.</div>
                ) : (
                    <div>
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
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player?.name || 'Unknown Player'}</td>
                                            <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">{c.team?.name || 'Unassigned'}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                    c.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : c.status === 'PENDING'
                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        : c.status === 'EXPIRED'
                                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
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

                        {/* Pagination Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                            <div>
                                Showing <span className="font-bold text-gray-900 dark:text-white">{contracts.length > 0 ? (page - 1) * limit + 1 : 0}</span> to <span className="font-bold text-gray-900 dark:text-white">{Math.min(page * limit, total)}</span> of <span className="font-bold text-gray-900 dark:text-white">{total}</span> total contracts
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ← Previous
                                </button>
                                <span className="font-bold text-gray-700 dark:text-gray-300 px-2">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg font-bold disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminContracts;
