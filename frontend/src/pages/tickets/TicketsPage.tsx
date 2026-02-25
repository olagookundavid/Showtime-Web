import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getEventDays, getEventDayByDate, purchaseTicket, type EventDayResponse, type TicketTierResponse, type PurchaseTicketPayload } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const TicketsPage = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const [eventDays, setEventDays] = useState<EventDayResponse[]>([]);
    const [selectedEventDay, setSelectedEventDay] = useState<EventDayResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState<TicketTierResponse | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [email, setEmail] = useState(user?.email || '');
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const dateParam = searchParams.get('date');
                if (dateParam) {
                    // Fetch specific event day by date
                    try {
                        const eventDay = await getEventDayByDate(dateParam);
                        setSelectedEventDay(eventDay);
                        setEventDays([eventDay]);
                    } catch {
                        // No event day for this date, fetch all
                        const allDays = await getEventDays();
                        setEventDays(allDays);
                    }
                } else {
                    const allDays = await getEventDays();
                    setEventDays(allDays);
                }
            } catch (err) {
                console.error('Failed to fetch event days:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [searchParams]);

    useEffect(() => {
        if (user?.email) setEmail(user.email);
    }, [user]);

    const handlePurchase = async () => {
        if (!selectedEventDay || !selectedTier || !email) return;
        setError('');
        setPurchasing(true);

        try {
            const payload: PurchaseTicketPayload = {
                event_day_id: selectedEventDay.id,
                tier_id: selectedTier.id,
                email,
                quantity,
            };

            const result = await purchaseTicket(payload);

            if (result.authorization_url) {
                window.location.href = result.authorization_url;
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to initiate purchase. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const openPurchaseModal = (eventDay: EventDayResponse, tier: TicketTierResponse) => {
        setSelectedEventDay(eventDay);
        setSelectedTier(tier);
        setQuantity(1);
        setError('');
    };

    const closePurchaseModal = () => {
        setSelectedTier(null);
        setQuantity(1);
        setError('');
    };

    const tierColorMap: Record<string, string> = {
        'Regular': 'from-blue-500 to-blue-700',
        'VIP': 'from-amber-500 to-amber-700',
        'VVIP': 'from-purple-500 to-purple-800',
    };

    const getTierGradient = (name: string) => {
        return tierColorMap[name] || 'from-gray-600 to-gray-800';
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-sffl-red to-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">BUY TICKETS</h1>
                <p className="text-gray-200 mt-2 text-lg">Secure your spot for upcoming game days</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : eventDays.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                    <div className="text-6xl mb-4">🎟️</div>
                    <h2 className="text-2xl font-bold text-gray-700 dark:text-white mb-2">No Upcoming Events</h2>
                    <p className="text-gray-500 dark:text-gray-400">Check back soon for new game day schedules!</p>
                    <Link to="/matches" className="inline-block mt-6 bg-sffl-navy text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 transition">
                        View Matches
                    </Link>
                </div>
            ) : (
                <div className="space-y-10">
                    {eventDays.map((eventDay) => (
                        <div key={eventDay.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                            {/* Event Day Header */}
                            <div className="bg-sffl-navy text-white p-6">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black">{eventDay.title}</h2>
                                        <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-300 text-sm">
                                            <span>📅 {new Date(eventDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                            {eventDay.venue && <span>📍 {eventDay.venue}</span>}
                                        </div>
                                    </div>
                                    {eventDay.matches && eventDay.matches.length > 0 && (
                                        <div className="bg-white/10 px-4 py-2 rounded-lg text-center">
                                            <div className="text-2xl font-black">{eventDay.matches.length}</div>
                                            <div className="text-xs uppercase tracking-wider text-gray-300">
                                                {eventDay.matches.length === 1 ? 'Match' : 'Matches'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Matches on this day */}
                                {eventDay.matches && eventDay.matches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {eventDay.matches.map((m) => (
                                            <span key={m.id} className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold">
                                                {m.home_team} vs {m.away_team} • {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Ticket Tiers */}
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">Select Your Ticket</h3>
                                {(!eventDay.tiers || eventDay.tiers.length === 0) ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <p className="text-lg font-medium">Tickets coming soon!</p>
                                        <p className="text-sm mt-1">Check back later for pricing.</p>
                                    </div>
                                ) : (
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {eventDay.tiers.map((tier) => {
                                            const isSoldOut = tier.capacity > 0 && tier.available <= 0;
                                            return (
                                                <div
                                                    key={tier.id}
                                                    className={`rounded-xl overflow-hidden shadow-md transition-all duration-300 ${isSoldOut ? 'opacity-60' : 'hover:shadow-xl hover:-translate-y-1'}`}
                                                >
                                                    <div className={`bg-gradient-to-br ${getTierGradient(tier.name)} text-white p-5`}>
                                                        <div className="text-xs font-bold uppercase tracking-wider opacity-80">{tier.name}</div>
                                                        <div className="text-3xl font-black mt-1">₦{tier.price.toLocaleString()}</div>
                                                        {tier.description && (
                                                            <p className="text-sm mt-2 opacity-90">{tier.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="p-4 bg-gray-50 dark:bg-gray-700">
                                                        {tier.capacity > 0 && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                                                {isSoldOut ? (
                                                                    <span className="text-red-500 font-bold">SOLD OUT</span>
                                                                ) : (
                                                                    <span>{tier.available} of {tier.capacity} remaining</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => openPurchaseModal(eventDay, tier)}
                                                            disabled={isSoldOut}
                                                            className="w-full bg-sffl-red hover:bg-red-700 text-white font-black py-3 px-6 rounded-lg transition transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                        >
                                                            {isSoldOut ? 'Sold Out' : '🎟️ Buy Now'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Purchase Modal */}
            {selectedTier && selectedEventDay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-in">
                        <h3 className="text-2xl font-black text-sffl-navy dark:text-white mb-4">Purchase Tickets</h3>

                        <div className="space-y-4 mb-6">
                            {/* Event Info */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <div className="font-bold text-sffl-navy dark:text-white">
                                    {selectedEventDay.title}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    {new Date(selectedEventDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    {selectedEventDay.venue && ` • ${selectedEventDay.venue}`}
                                </div>
                                <div className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${getTierGradient(selectedTier.name)} text-white`}>
                                    {selectedTier.name} — ₦{selectedTier.price.toLocaleString()}/ticket
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Your ticket will be sent to this email</p>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white w-10 h-10 rounded-lg font-bold text-lg"
                                    >−</button>
                                    <span className="font-bold text-xl w-12 text-center dark:text-white">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white w-10 h-10 rounded-lg font-bold text-lg"
                                    >+</button>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="border-t dark:border-gray-700 pt-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Total:</span>
                                    <span className="text-3xl font-black text-sffl-red">₦{(selectedTier.price * quantity).toLocaleString()}</span>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={closePurchaseModal}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition"
                                disabled={purchasing}
                            >Cancel</button>
                            <button
                                onClick={handlePurchase}
                                disabled={purchasing || !email}
                                className="flex-1 bg-sffl-red hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {purchasing ? (
                                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                                ) : (
                                    '💳 Pay with Paystack'
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-4">
                            🔒 You will be redirected to Paystack for secure payment
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
