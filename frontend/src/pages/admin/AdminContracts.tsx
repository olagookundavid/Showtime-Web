import React, { useState, useEffect, useRef } from 'react';
import { adminTransfersApi, contractsApi, type ContractData } from '../../services/api';
import toast from 'react-hot-toast';
import {
    ChevronDownIcon,
    CheckBadgeIcon,
    XCircleIcon,
    ClockIcon,
    NoSymbolIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Status options for the admin override dropdown
const OVERRIDE_STATUSES = [
    { value: 'EXPIRED', label: 'Mark Expired', icon: ClockIcon, color: 'text-orange-600 dark:text-orange-400' },
    { value: 'TERMINATED', label: 'Terminate', icon: XCircleIcon, color: 'text-red-600 dark:text-red-400' },
    { value: 'REJECTED', label: 'Reject', icon: NoSymbolIcon, color: 'text-gray-600 dark:text-gray-400' },
    { value: 'CANCELLED', label: 'Cancel', icon: NoSymbolIcon, color: 'text-gray-600 dark:text-gray-400' },
];

export const AdminContracts: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(25);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Dropdown menu state
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [forceAccepting, setForceAccepting] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const handleOverride = async (contractId: string, newStatus: string) => {
        const reason = window.prompt(`Reason for changing status to ${newStatus}? (optional)`);
        try {
            await adminTransfersApi.overrideContract(contractId, newStatus, reason || undefined);
            toast.success(`Contract status updated to ${newStatus}`);
            setOpenMenuId(null);
            fetchContracts();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to override contract status');
        }
    };

    const handleForceAccept = async (contractId: string, playerName: string) => {
        const confirmed = window.confirm(
            `⚠️ Force-Accept Contract\n\nThis will immediately activate the contract for "${playerName}" and assign them to the team — even if the player hasn't claimed their account.\n\nThis action will be recorded in the audit log with your admin name.\n\nProceed?`
        );
        if (!confirmed) return;

        setForceAccepting(contractId);
        try {
            const result = await adminTransfersApi.forceAcceptContract(contractId);
            toast.success(result.message || 'Contract force-accepted successfully');
            setOpenMenuId(null);
            fetchContracts();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to force-accept contract');
        } finally {
            setForceAccepting(null);
        }
    };

    const statusBadgeClass = (status: string): string => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'EXPIRED': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'TERMINATED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
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
                                        <th className="p-4">Notes</th>
                                        <th className="p-4 text-right">Admin Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                    {contracts.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{c.player?.name || 'Unknown Player'}</td>
                                            <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">{c.team?.name || 'Unassigned'}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusBadgeClass(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono">{c.matches_played} / {c.contract_length}</td>
                                            <td className="p-4 font-bold">{c.player_value.toLocaleString()} pts</td>
                                            <td className="p-4 text-xs text-gray-400">{new Date(c.offered_at).toLocaleDateString()}</td>
                                            <td className="p-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={c.notes || c.termination_reason || ''}>
                                                {c.termination_reason && (
                                                    <span className="text-red-500 font-semibold">{c.termination_reason}</span>
                                                )}
                                                {!c.termination_reason && c.notes && (
                                                    <span>{c.notes}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="relative inline-block" ref={openMenuId === c.id ? menuRef : undefined}>
                                                    <button
                                                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        Actions
                                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                                    </button>

                                                    {openMenuId === c.id && (
                                                        <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-1">
                                                            {/* Force Accept — only for PENDING contracts */}
                                                            {c.status === 'PENDING' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleForceAccept(c.id, c.player?.name || 'Unknown')}
                                                                        disabled={forceAccepting === c.id}
                                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition-colors"
                                                                    >
                                                                        {forceAccepting === c.id ? (
                                                                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <CheckBadgeIcon className="w-4 h-4" />
                                                                        )}
                                                                        <div>
                                                                            <span>{forceAccepting === c.id ? 'Activating...' : 'Force Accept'}</span>
                                                                            <p className="text-[10px] font-normal text-green-600/70 dark:text-green-400/60 mt-0.5">
                                                                                Activate without player approval
                                                                            </p>
                                                                        </div>
                                                                    </button>
                                                                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-700" />
                                                                </>
                                                            )}

                                                            {/* Override status options */}
                                                            {OVERRIDE_STATUSES
                                                                .filter(s => s.value !== c.status)
                                                                .map(s => (
                                                                    <button
                                                                        key={s.value}
                                                                        onClick={() => handleOverride(c.id, s.value)}
                                                                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm font-semibold ${s.color} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
                                                                    >
                                                                        <s.icon className="w-4 h-4" />
                                                                        {s.label}
                                                                    </button>
                                                                ))
                                                            }
                                                        </div>
                                                    )}
                                                </div>
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
