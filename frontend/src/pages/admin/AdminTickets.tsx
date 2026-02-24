import { useState, useEffect, useCallback } from 'react';
import { adminListTickets, checkinTicket, lookupTicketByCode, getMatches, type TicketResponse, type Match } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const AdminTickets = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<TicketResponse[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterMatch, setFilterMatch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [searchResult, setSearchResult] = useState<TicketResponse | null>(null);
    const [searchError, setSearchError] = useState('');
    const [checkinLoading, setCheckinLoading] = useState<string | null>(null);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminListTickets(page, 10, filterMatch || undefined, filterStatus || undefined);
            setTickets(data.data || []);
            setTotalPages(data.total_pages || 1);
        } catch (err) {
            console.error('Failed to fetch tickets:', err);
        } finally {
            setLoading(false);
        }
    }, [page, filterMatch, filterStatus]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await getMatches(undefined, 1, 50);
                setMatches(data.data || []);
            } catch (_) { }
        };
        fetchMatches();
    }, []);

    const handleSearch = async () => {
        if (!searchCode.trim()) return;
        setSearchError('');
        setSearchResult(null);
        try {
            const result = await lookupTicketByCode(searchCode.trim().toUpperCase());
            setSearchResult(result);
        } catch (err) {
            setSearchError('Ticket not found. Check the code and try again.');
        }
    };

    const handleCheckin = async (ticketId: string) => {
        if (!user) return;
        setCheckinLoading(ticketId);
        try {
            await checkinTicket(ticketId, user.name || user.email);
            await fetchTickets();
            if (searchResult?.id === ticketId) {
                setSearchResult({ ...searchResult, status: 'USED' });
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Check-in failed');
        } finally {
            setCheckinLoading(null);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'USED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'FAILED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'CANCELLED': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-sffl-navy dark:text-white">🎟️ Ticket Management</h1>

            {/* Ticket Lookup / Scanner */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">🔍 Ticket Lookup / Check-in</h2>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter ticket code (e.g. SFFL-A3K9X2)"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    />
                    <button
                        onClick={handleSearch}
                        className="bg-sffl-navy text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-900 transition"
                    >Search</button>
                </div>

                {searchError && (
                    <p className="text-red-500 text-sm mt-2 font-medium">{searchError}</p>
                )}

                {searchResult && (
                    <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-black text-lg text-sffl-navy dark:text-white">{searchResult.ticket_code}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{searchResult.match_title || `${searchResult.home_team} vs ${searchResult.away_team}`}</p>
                                <p className="text-sm text-gray-500">{searchResult.email} • Qty: {searchResult.quantity}</p>
                                <p className="text-xs text-gray-400 mt-1">₦{searchResult.total_amount?.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor(searchResult.status)}`}>
                                    {searchResult.status}
                                </span>
                                {searchResult.status === 'PAID' && (
                                    <button
                                        onClick={() => handleCheckin(searchResult.id)}
                                        disabled={checkinLoading === searchResult.id}
                                        className="block mt-3 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition disabled:opacity-50"
                                    >
                                        {checkinLoading === searchResult.id ? 'Checking in...' : '✅ Check In'}
                                    </button>
                                )}
                                {searchResult.status === 'USED' && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-semibold">
                                        Already used{searchResult.checked_in_at ? ` at ${new Date(searchResult.checked_in_at).toLocaleString()}` : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <select
                    value={filterMatch}
                    onChange={(e) => { setFilterMatch(e.target.value); setPage(1); }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    <option value="">All Matches</option>
                    {matches.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.home_team?.short_name || m.home_team?.name} vs {m.away_team?.short_name || m.away_team?.name}
                        </option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="USED">Used</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {/* Tickets Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Match</th>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {tickets.length > 0 ? tickets.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-mono font-bold text-sffl-navy dark:text-white">{t.ticket_code || '—'}</td>
                                        <td className="px-4 py-3 dark:text-gray-300">{t.home_team && t.away_team ? `${t.home_team} vs ${t.away_team}` : '—'}</td>
                                        <td className="px-4 py-3 dark:text-gray-300">{t.email}</td>
                                        <td className="px-4 py-3 text-center dark:text-gray-300">{t.quantity}</td>
                                        <td className="px-4 py-3 text-right font-semibold dark:text-white">₦{t.total_amount?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}>{t.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {t.status === 'PAID' ? (
                                                <button
                                                    onClick={() => handleCheckin(t.id)}
                                                    disabled={checkinLoading === t.id}
                                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition disabled:opacity-50"
                                                >
                                                    {checkinLoading === t.id ? '...' : 'Check In'}
                                                </button>
                                            ) : t.status === 'USED' ? (
                                                <span className="text-xs text-gray-400">✅ Done</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">No tickets found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30"
                        >← Prev</button>
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30"
                        >Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
};
