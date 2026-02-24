import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getTicketByReference, type TicketResponse } from '../../services/api';

export const TicketConfirmation = () => {
    const [searchParams] = useSearchParams();
    const [ticket, setTicket] = useState<TicketResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const reference = searchParams.get('reference') || searchParams.get('trxref');
        if (!reference) {
            setError('No payment reference found.');
            setLoading(false);
            return;
        }

        const fetchTicket = async () => {
            try {
                const data = await getTicketByReference(reference);
                setTicket(data);
            } catch (err) {
                setError('Could not find your ticket. Please check your email or contact support.');
            } finally {
                setLoading(false);
            }
        };

        // Small delay to let webhook process
        const timer = setTimeout(fetchTicket, 2000);
        return () => clearTimeout(timer);
    }, [searchParams]);

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto text-center py-24">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-2xl font-black text-sffl-navy dark:text-white mb-2">Verifying Payment...</h2>
                <p className="text-gray-500">Please wait while we confirm your transaction</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto text-center py-24">
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-2xl font-black text-red-600 mb-2">Something Went Wrong</h2>
                <p className="text-gray-500 mb-6">{error}</p>
                <Link to="/tickets" className="bg-sffl-navy text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 transition">
                    Back to Tickets
                </Link>
            </div>
        );
    }

    const isPaid = ticket?.status === 'PAID';
    const isPending = ticket?.status === 'PENDING';

    return (
        <div className="max-w-2xl mx-auto py-12 space-y-8">
            {/* Status Header */}
            <div className={`text-center p-8 rounded-2xl shadow-xl ${isPaid ? 'bg-gradient-to-r from-green-500 to-emerald-600' : isPending ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gradient-to-r from-red-500 to-red-700'} text-white`}>
                <div className="text-6xl mb-4">{isPaid ? '✅' : isPending ? '⏳' : '❌'}</div>
                <h1 className="text-3xl font-black mb-2">
                    {isPaid ? 'Payment Successful!' : isPending ? 'Payment Pending' : 'Payment Failed'}
                </h1>
                <p className="text-lg opacity-90">
                    {isPaid ? 'Your tickets are confirmed' : isPending ? 'Your payment is being processed' : 'Your payment could not be completed'}
                </p>
            </div>

            {/* Ticket Details */}
            {ticket && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                    {/* Ticket Code Banner */}
                    {isPaid && ticket.ticket_code && (
                        <div className="bg-sffl-navy text-white text-center py-6">
                            <p className="text-xs uppercase tracking-wider text-gray-300 mb-2">Your Ticket Code</p>
                            <p className="text-4xl font-black tracking-widest">{ticket.ticket_code}</p>
                            <p className="text-xs text-gray-400 mt-2">Show this code at the venue for check-in</p>
                        </div>
                    )}

                    {/* Details */}
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Match</span>
                                <p className="font-bold text-sffl-navy dark:text-white">{ticket.match_title || `${ticket.home_team} vs ${ticket.away_team}`}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Venue</span>
                                <p className="font-bold text-sffl-navy dark:text-white">{ticket.match_venue || '—'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Date</span>
                                <p className="font-bold text-sffl-navy dark:text-white">
                                    {ticket.match_date ? new Date(ticket.match_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Email</span>
                                <p className="font-bold text-sffl-navy dark:text-white">{ticket.email}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Qty</span>
                                <p className="font-bold text-sffl-navy dark:text-white">{ticket.quantity}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold">Total Paid</span>
                                <p className="font-black text-sffl-red text-xl">₦{ticket.total_amount?.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="border-t dark:border-gray-700 pt-4 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Reference: {ticket.paystack_reference}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-green-100 text-green-700' : isPending ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {ticket.status}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-center">
                <Link to="/tickets" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    ← Buy More Tickets
                </Link>
            </div>
        </div>
    );
};
