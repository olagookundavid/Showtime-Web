import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { getEventDays, getEventDayByDate, purchaseTicket, getUserProfile, type EventDayResponse, type TicketTierResponse, type PurchaseTicketPayload, type AuthUser } from '../../services/api';

export const TicketsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dateParam = searchParams.get('date');

    const [accessCode, setAccessCode] = useState('');
    const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);

    const { data: specificDay, isError: specificDayError } = useQuery({
        queryKey: ['publicEventDay', dateParam, appliedCode],
        queryFn: () => getEventDayByDate(dateParam!, appliedCode),
        enabled: !!dateParam,
        retry: false,
    });

    const fetchAllDays = !dateParam || specificDayError;

    const { data: allDaysData, isLoading: loadingAll } = useQuery({
        queryKey: ['publicEventDays', appliedCode],
        queryFn: () => getEventDays(appliedCode),
        enabled: fetchAllDays,
    });

    const [selectedEventDay, setSelectedEventDay] = useState<EventDayResponse | null>(null);
    const [selectedTier, setSelectedTier] = useState<TicketTierResponse | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [useAccountEmail, setUseAccountEmail] = useState(false);
    const [userProfile, setUserProfile] = useState<AuthUser | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');

    const eventDays = specificDay && !specificDayError ? [specificDay] : (allDaysData || []);
    const loading = (!!dateParam && specificDay === undefined && !specificDayError) || (fetchAllDays && loadingAll);

    useEffect(() => {
        if (specificDay && !specificDayError) {
            setSelectedEventDay(specificDay);
        }
    }, [specificDay, specificDayError]);

    // Check auth status on mount
    useEffect(() => {
        const token = localStorage.getItem('showtime_access_token');
        if (token) {
            getUserProfile()
                .then(profile => {
                    setUserProfile(profile);
                    setUseAccountEmail(true);
                    setEmail(profile.email);
                    setName(profile.full_name);
                    if (profile.phone) setPhone(profile.phone);
                })
                .catch(() => {
                    // Not logged in or expired
                    setUserProfile(null);
                });
        }
    }, []);

    // Sync email and name when toggle changes
    useEffect(() => {
        if (useAccountEmail && userProfile) {
            setEmail(userProfile.email);
            setName(userProfile.full_name);
        } else if (!useAccountEmail && userProfile) {
            // Optional: could clear if they want to override
        }
    }, [useAccountEmail, userProfile]);

    const handlePurchase = async () => {
        if (!selectedEventDay || !selectedTier || !email || !name) {
            setError('Full Name and Email are required');
            return;
        }
        setError('');
        setPurchasing(true);

        try {
            const payload: PurchaseTicketPayload = {
                event_day_id: selectedEventDay.id,
                tier_id: selectedTier.id,
                email,
                name,
                phone,
                quantity,
            };

            const result = await purchaseTicket(payload);

            if (result.authorization_url) {
                window.location.href = result.authorization_url;
            } else if (result.paystack_reference) {
                // Free ticket case - redirect to success page
                navigate(`/tickets/confirm?reference=${result.paystack_reference}`);
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
        'Regular': 'from-red-500 to-red-700',
        'VIP': 'from-amber-500 to-amber-700',
        'VVIP': 'from-purple-500 to-purple-800',
    };

    const getTierGradient = (name: string) => {
        return tierColorMap[name] || 'from-gray-600 to-gray-800';
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
            {/* Header - Compact for Mobile */}
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">TICKETS</h1>
                    <p className="text-gray-200 mt-1 text-xs md:text-lg">Secure your spot</p>
                </div>
                <div className="bg-white/10 p-3 md:p-4 rounded-xl backdrop-blur-sm w-full md:w-auto">
                    <p className="text-[10px] font-bold mb-1.5 uppercase tracking-widest text-gray-200">Access Code?</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="CODE"
                            className="px-3 py-1.5 rounded-lg bg-white/20 text-white placeholder-gray-400 border border-white/30 focus:outline-none focus:ring-1 focus:ring-white/50 w-full md:w-48 uppercase text-xs"
                        />
                        <button
                            onClick={() => setAppliedCode(accessCode.trim())}
                            className="bg-white text-sffl-navy font-bold px-4 py-1.5 rounded-lg text-xs hover:bg-gray-100 transition shadow-sm"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-12 h-12 border-4 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
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
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight">{eventDay.title}</h2>
                                        <div className="flex flex-wrap items-center gap-3 mt-1 text-gray-400 text-[10px] md:text-sm">
                                            <span>📅 {new Date(eventDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                            {eventDay.venue && <span>📍 {eventDay.venue}</span>}
                                        </div>
                                    </div>
                                    {eventDay.matches && eventDay.matches.length > 0 && (
                                        <div className="bg-white/10 px-3 py-1 rounded-lg text-center hidden md:block">
                                            <div className="text-xl font-black">{eventDay.matches.length}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-gray-300">Matches</div>
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

                            {/* Ticket Tiers - High Density */}
                            <div className="p-3 md:p-6">
                                <h3 className="text-[10px] uppercase font-black text-gray-400 mb-3 tracking-widest">Select Ticket</h3>
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
                                                    <div className={`bg-gradient-to-br ${getTierGradient(tier.name)} text-white p-3 md:p-5`}>
                                                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{tier.name}</div>
                                                        <div className="text-xl md:text-3xl font-black mt-0.5 md:mt-1">₦{tier.price.toLocaleString()}</div>
                                                    </div>
                                                    <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-700">
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
                                                            className="w-full bg-sffl-red hover:bg-[#A52323] text-white font-black py-2 md:py-3 rounded-lg text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isSoldOut ? 'Sold Out' : 'Buy Now'}
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
                        <h3 className="text-2xl font-black text-sffl-navy dark:text-white mb-4">
                            Purchase Tickets
                        </h3>

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

                            {/* Auth Toggle */}
                            {userProfile && (
                                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <input
                                        type="checkbox"
                                        id="useAccountEmail"
                                        checked={useAccountEmail}
                                        onChange={(e) => setUseAccountEmail(e.target.checked)}
                                        className="w-4 h-4 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                                    />
                                    <label htmlFor="useAccountEmail" className="text-xs font-bold text-blue-800 dark:text-blue-300 cursor-pointer">
                                        Use my account information
                                    </label>
                                </div>
                            )}

                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition-opacity ${useAccountEmail ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                                    required
                                    disabled={useAccountEmail}
                                />
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
                                    placeholder="e.g. example@mail.com"
                                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none transition-opacity ${useAccountEmail ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                                    required
                                    disabled={useAccountEmail}
                                />
                                <p className="text-xs text-gray-500 mt-1">Your ticket will be sent to this email</p>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Phone Number <span className="text-gray-500 font-normal ml-1">(optional)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g. +234..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">We may call you regarding your ticket</p>
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
                                disabled={purchasing || !email || !name}
                                className="flex-1 bg-sffl-red hover:bg-[#A52323] text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {purchasing ? (
                                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                                ) : (
                                    selectedTier.price === 0 ? '🎟️ Get Free Ticket' : '💳 Pay with Paystack'
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-4">
                            {selectedTier.price === 0
                                ? '✨ Your free ticket will be sent instantly'
                                : '🔒 You will be redirected to Paystack for secure payment'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
