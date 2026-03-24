import { Loader } from '../../components/ui/Loader';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminListTickets, checkinTicket, adminCheckinTicket, verifyTicket, lookupTicketByCode, searchTicketsByEmail, getEventDays, type TicketResponse, type EventDayResponse } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const AdminTickets = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [filterEventDay, setFilterEventDay] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const { data: eventDaysData, isLoading: loadingEventDays } = useQuery({
        queryKey: ['adminEventDaysList'],
        queryFn: () => getEventDays(),
    });

    const { data: ticketsData, isLoading: loadingTickets } = useQuery({
        queryKey: ['adminTickets', { page, eventDay: filterEventDay, status: filterStatus }],
        queryFn: async () => {
            const data = await adminListTickets(page, 10, filterEventDay || undefined, filterStatus || undefined);
            return data;
        },
    });

    const eventDays: EventDayResponse[] = (eventDaysData as any)?.data ?? eventDaysData ?? [];
    const tickets: TicketResponse[] = (ticketsData as any)?.data ?? ticketsData ?? [];
    const totalPages = ticketsData?.total_pages || 1;
    const loading = loadingEventDays || loadingTickets;

    // Default to the latest event day if not set
    useEffect(() => {
        if (eventDays.length > 0 && !filterEventDay) {
            setFilterEventDay(eventDays[0].id);
        }
    }, [eventDays, filterEventDay]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'code' | 'email'>('code');
    const [searchResults, setSearchResults] = useState<TicketResponse[]>([]);
    const [searchError, setSearchError] = useState('');
    const [searching, setSearching] = useState(false);

    const [actionLoading, setActionLoading] = useState<string | null>(null);



    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (!q) return;
        setSearchError('');
        setSearchResults([]);
        setSearching(true);

        try {
            if (searchMode === 'code') {
                const result = await lookupTicketByCode(q.toUpperCase());
                setSearchResults([result]);
            } else {
                const results = await searchTicketsByEmail(q);
                if (results.length === 0) {
                    setSearchError('No tickets found for this email.');
                } else {
                    setSearchResults(results);
                }
            }
        } catch (err) {
            setSearchError(searchMode === 'code' ? 'Ticket not found.' : 'No tickets found for this email.');
        } finally {
            setSearching(false);
        }
    };

    // Verify a PENDING ticket via Paystack
    const handleVerify = async (ticket: TicketResponse) => {
        if (!ticket.paystack_reference) {
            alert('No Paystack reference found for this ticket.');
            return;
        }
        setActionLoading(ticket.id);
        try {
            const updated = await verifyTicket(ticket.paystack_reference);
            // Update in search results
            setSearchResults(prev => prev.map(t => t.id === ticket.id ? { ...t, status: updated.status } : t));
            // Trigger table refetch
            queryClient.invalidateQueries({ queryKey: ['adminTickets'] });

            if (updated.status === 'PAID') {
                alert('✅ Payment verified! Ticket is now PAID.');
            } else {
                alert(`Payment status: ${updated.status}`);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Verification failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Regular check-in (PAID → USED)
    const handleCheckin = async (ticketId: string) => {
        if (!user) return;
        setActionLoading(ticketId);
        try {
            await checkinTicket(ticketId, user.name || user.email);
            setSearchResults(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'USED' } : t));
            queryClient.invalidateQueries({ queryKey: ['adminTickets'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Check-in failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Admin force check-in (any status → USED)
    const handleAdminCheckin = async (ticketId: string) => {
        if (!user) return;
        if (!confirm('Force check-in this ticket? This will verify payment first if pending.')) return;
        setActionLoading(ticketId);
        try {
            await adminCheckinTicket(ticketId, user.name || user.email);
            setSearchResults(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'USED' } : t));
            queryClient.invalidateQueries({ queryKey: ['adminTickets'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Check-in failed');
        } finally {
            setActionLoading(null);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'USED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'FAILED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const ActionButtons = ({ t }: { t: TicketResponse }) => {
        const isLoading = actionLoading === t.id;

        if (t.status === 'USED') {
            return <span className="text-xs text-blue-500 font-semibold">✅ Checked In</span>;
        }

        if (t.status === 'PAID') {
            return (
                <button
                    onClick={() => handleCheckin(t.id)}
                    disabled={isLoading}
                    className="bg-green-600 text-white px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold hover:bg-green-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? '...' : '✅ Check In'}
                </button>
            );
        }

        if (t.status === 'PENDING') {
            return (
                <div className="flex justify-center gap-1.5">
                    <button
                        onClick={() => handleVerify(t)}
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-3 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md text-xs font-bold hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        title="Verify payment with Paystack"
                    >
                        {isLoading ? '...' : '🔍 Verify'}
                    </button>
                    <button
                        onClick={() => handleAdminCheckin(t.id)}
                        disabled={isLoading}
                        className="bg-orange-600 text-white px-3 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md text-xs font-bold hover:bg-orange-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        title="Force check-in (verifies payment first)"
                    >
                        {isLoading ? '...' : '⚡ Force'}
                    </button>
                </div>
            );
        }

        return <span className="text-xs text-gray-400">—</span>;
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Ticket Management</h1>

            {/* ── Search / Check-in Section ─────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">🔍 Ticket Search & Check-in</h2>

                {/* Search Mode Toggle */}
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => { setSearchMode('code'); setSearchQuery(''); setSearchResults([]); setSearchError(''); }}
                        className={`px-4 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === 'code' ? 'bg-sffl-navy text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                    >🔢 Search by Code</button>
                    <button
                        onClick={() => { setSearchMode('email'); setSearchQuery(''); setSearchResults([]); setSearchError(''); }}
                        className={`px-4 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === 'email' ? 'bg-sffl-navy text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                    >📧 Search by Email</button>
                </div>

                {/* Search Input */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type={searchMode === 'email' ? 'email' : 'text'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={searchMode === 'code' ? 'Enter ticket code (e.g. SFFL-A3K9X2)' : 'Enter email address'}
                            className={`w-full pl-3 pr-10 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${searchMode === 'code' ? 'uppercase' : ''}`}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searching || !searchQuery.trim()}
                        className="bg-sffl-navy text-white text-xs px-4 py-2 min-h-[44px] rounded-lg shadow-sm hover:shadow-md font-bold hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >{searching ? 'Searching...' : 'Search'}</button>
                </div>

                {searchError && (
                    <p className="text-red-500 text-sm mt-3 font-medium">❌ {searchError}</p>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">
                            {searchResults.length} ticket{searchResults.length > 1 ? 's' : ''} found
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Code</th>
                                        <th className="px-4 py-2 text-left">Event</th>
                                        <th className="px-4 py-2 text-left">Tier</th>
                                        <th className="px-4 py-2 text-left">Email</th>
                                        <th className="px-4 py-2 text-center">Qty</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                        <th className="px-4 py-2 text-center">Status</th>
                                        <th className="px-4 py-2 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {searchResults.map(t => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 font-mono font-bold text-sffl-navy dark:text-white text-sm">{t.ticket_code || '—'}</td>
                                            <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.event_title || '—'}</td>
                                            <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.tier_name || '—'}</td>
                                            <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.email}</td>
                                            <td className="px-4 py-3 text-center dark:text-gray-300">{t.quantity}</td>
                                            <td className="px-4 py-3 text-right font-semibold dark:text-white">₦{t.total_amount?.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}>{t.status}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <ActionButtons t={t} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ── All Tickets Table ─────────────────────────────────────────── */}

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <select
                    value={filterEventDay}
                    onChange={(e) => { setFilterEventDay(e.target.value); setPage(1); }}
                    className="px-3 py-2 min-h-[44px] z-50 border mb-2 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    {eventDays.map(ed => (
                        <option key={ed.id} value={ed.id} className="truncate">{ed.title} — {ed.date}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    className="px-3 py-2 min-h-[44px] z-50 border mb-2 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                    <option value="" className="truncate">All Statuses</option>
                    <option value="PENDING" className="truncate">Pending</option>
                    <option value="PAID" className="truncate">Paid</option>
                    <option value="USED" className="truncate">Used</option>
                    <option value="FAILED" className="truncate">Failed</option>
                </select>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                {loading ? (
                    <Loader />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Event</th>
                                    <th className="px-4 py-3 text-left">Tier</th>
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
                                        <td className="px-4 py-3 font-mono font-bold text-sffl-navy dark:text-white text-sm">{t.ticket_code || '—'}</td>
                                        <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.event_title || '—'}</td>
                                        <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.tier_name || '—'}</td>
                                        <td className="px-4 py-3 dark:text-gray-300 text-sm">{t.email}</td>
                                        <td className="px-4 py-3 text-center dark:text-gray-300">{t.quantity}</td>
                                        <td className="px-4 py-3 text-right font-semibold dark:text-white">₦{t.total_amount?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}>{t.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <ActionButtons t={t} />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400">No tickets found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 min-h-[44px] rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">← Prev</button>
                        <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 min-h-[44px] rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
};
