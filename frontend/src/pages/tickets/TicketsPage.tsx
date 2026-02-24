import { useState, useEffect } from 'react';
import { getMatches, purchaseTicket, type Match, type PurchaseTicketPayload } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const TICKET_PRICE = 5000; // ₦5,000 per ticket

export const TicketsPage = () => {
    const { user } = useAuth();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [email, setEmail] = useState(user?.email || '');
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await getMatches(undefined, 1, 20, 'SCHEDULED');
                setMatches(data.data || []);
            } catch (err) {
                console.error('Failed to fetch matches:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, []);

    useEffect(() => {
        if (user?.email) setEmail(user.email);
    }, [user]);

    const handlePurchase = async () => {
        if (!selectedMatch || !email) return;
        setError('');
        setPurchasing(true);

        try {
            const payload: PurchaseTicketPayload = {
                match_id: selectedMatch.id,
                email,
                quantity,
                unit_price: TICKET_PRICE,
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

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-sffl-red to-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">BUY TICKETS</h1>
                <p className="text-gray-200 mt-2 text-lg">Secure your spot for upcoming matches</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : matches.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                    <div className="text-6xl mb-4">🎟️</div>
                    <h2 className="text-2xl font-bold text-gray-700 dark:text-white mb-2">No Upcoming Matches</h2>
                    <p className="text-gray-500 dark:text-gray-400">Check back soon for new match schedules!</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((match) => (
                        <div
                            key={match.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                        >
                            {/* Match Header */}
                            <div className="bg-sffl-navy text-white p-6">
                                <div className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-2">
                                    {match.competition?.name || 'SFFL'}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col items-center flex-1">
                                        {match.home_team?.logo && (
                                            <img src={match.home_team.logo} alt="" className="w-12 h-12 object-contain mb-1" />
                                        )}
                                        <span className="text-sm font-bold text-center">{match.home_team?.short_name || match.home_team?.name}</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-400 mx-4">VS</span>
                                    <div className="flex flex-col items-center flex-1">
                                        {match.away_team?.logo && (
                                            <img src={match.away_team.logo} alt="" className="w-12 h-12 object-contain mb-1" />
                                        )}
                                        <span className="text-sm font-bold text-center">{match.away_team?.short_name || match.away_team?.name}</span>
                                    </div>
                                </div>
                                <div className="text-sm space-y-1 text-gray-300 mt-4">
                                    <p>📅 {new Date(match.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    <p>🕐 {new Date(match.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p>📍 {match.venue}</p>
                                </div>
                            </div>

                            {/* Price + Button */}
                            <div className="p-6">
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-3xl font-black text-sffl-red">₦{TICKET_PRICE.toLocaleString()}</span>
                                    <span className="text-gray-500">per ticket</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedMatch(match);
                                        setQuantity(1);
                                        setError('');
                                    }}
                                    className="w-full bg-sffl-red hover:bg-red-700 text-white font-black py-3 px-6 rounded-lg transition transform hover:scale-105 shadow-md"
                                >
                                    🎟️ Purchase Tickets
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Purchase Modal */}
            {selectedMatch && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-in">
                        <h3 className="text-2xl font-black text-sffl-navy dark:text-white mb-4">Purchase Tickets</h3>

                        <div className="space-y-4 mb-6">
                            {/* Match Info */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <div className="font-bold text-sffl-navy dark:text-white">
                                    {selectedMatch.home_team?.name} vs {selectedMatch.away_team?.name}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    {new Date(selectedMatch.date).toLocaleDateString()} • {selectedMatch.venue}
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
                                    <span className="text-3xl font-black text-sffl-red">₦{(TICKET_PRICE * quantity).toLocaleString()}</span>
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
                                onClick={() => {
                                    setSelectedMatch(null);
                                    setQuantity(1);
                                    setError('');
                                }}
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
