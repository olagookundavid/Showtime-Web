import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { getEventDays, getEventDayByDate, purchaseTicket, getUserProfile, type EventDayResponse, type TicketTierResponse, type PurchaseTicketPayload, type AuthUser, type DiscountPreview } from '../../services/api';
import { DiscountCodeInput } from '../../components/discounts/DiscountCodeInput';
import { newsletterEnabled, subscribeToNewsletter, toFirstName } from '../../services/newsletter';

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
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });

    const fetchAllDays = !dateParam || specificDayError;
    const fellBackFromMissingDate = !!dateParam && specificDayError;

    const { data: allDaysData, isLoading: loadingAll } = useQuery({
        queryKey: ['publicEventDays', appliedCode],
        queryFn: () => getEventDays(appliedCode),
        enabled: fetchAllDays,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });

    const [selectedEventDay, setSelectedEventDay] = useState<EventDayResponse | null>(null);
    const [selectedTier, setSelectedTier] = useState<TicketTierResponse | null>(null);
    const [quantity, setQuantity] = useState(1);
    // Server-priced preview of an applied discount code. Display only — the
    // server re-prices the code at purchase time.
    const [discount, setDiscount] = useState<DiscountPreview | null>(null);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [useAccountEmail, setUseAccountEmail] = useState(false);
    const [userProfile, setUserProfile] = useState<AuthUser | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');
    // Consent must be given actively, so this starts unticked and stays out of
    // the purchase validation — it can never block or fail a ticket sale.
    const [joinNewsletter, setJoinNewsletter] = useState(false);

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

    // Sync referral code from URL if present
    useEffect(() => {
        const refParam = searchParams.get('ref');
        if (refParam) {
            setReferralCode(refParam);
        }
    }, [searchParams]);

    // Lock body scroll while purchase modal is open on mobile
    useEffect(() => {
        if (selectedTier && selectedEventDay) {
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prevOverflow;
            };
        }
    }, [selectedTier, selectedEventDay]);

    const handlePurchase = async () => {
        if (!selectedEventDay || !selectedTier || !email || !name || !phone.trim()) {
            setError('Full Name, Email and Phone Number are required');
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
                referral_code: referralCode.trim() || undefined,
                // Send the code, not the amount — the server recomputes it.
                discount_code: discount?.code || undefined,
            };

            const result = await purchaseTicket(payload);

            // Fire-and-forget, deliberately after the sale succeeded and never
            // awaited: `keepalive` lets it complete even though the next line
            // navigates away to Paystack, and a failure here is invisible to
            // the buyer rather than costing them their ticket.
            if (joinNewsletter) {
                void subscribeToNewsletter(
                    { firstName: toFirstName(name), email },
                    { keepalive: true },
                );
            }

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
        // Fresh purchase, fresh consent — never carry a previous tick over.
        setJoinNewsletter(false);
        // Likewise for a code applied to a tier the buyer has moved on from.
        setDiscount(null);
    };

    const closePurchaseModal = () => {
        setSelectedTier(null);
        setQuantity(1);
        setError('');
        setDiscount(null);
    };

    // Totals for the purchase modal. selectedTier is null while the modal is
    // closed, which just makes these zero.
    const ticketSubtotal = (selectedTier?.price ?? 0) * quantity;
    const ticketDiscount = discount?.discount_amount ?? 0;
    const ticketTotal = Math.max(0, ticketSubtotal - ticketDiscount);

    const tierColorMap: Record<string, string> = {
        'Regular': 'from-red-500 to-red-700',
        'VIP': 'from-amber-500 to-amber-700',
        'VVIP': 'from-purple-500 to-purple-800',
    };

    const getTierGradient = (name: string) => {
        return tierColorMap[name] || 'from-gray-600 to-gray-800';
    };

    return (
        <div className="space-y-4 md:space-y-8">
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

            {fellBackFromMissingDate && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-4 rounded-xl text-sm">
                      <strong className="font-bold">No event found for {dateParam}.</strong>{' '}
                      Showing all upcoming events instead.
                  </div>
              )}

              <div className="bg-gradient-to-r from-red-600/10 to-transparent border border-red-500/20 p-4 rounded-xl flex justify-between items-center gap-4 dark:text-gray-200">
                  <div>
                      <h4 className="font-bold text-sm">Earn rewards by inviting friends! 🏈</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Generate a referral code and get payouts for every ticket sold.</p>
                  </div>
                  <Link to="/tickets/referrals" className="bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold px-4 py-2 rounded-lg transition shrink-0">
                      Get Referral Link
                  </Link>
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
                                                        {tier.description && (
                                                            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-line">
                                                                {tier.description}
                                                            </p>
                                                        )}
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
            {selectedTier && selectedEventDay && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn"
                    onClick={closePurchaseModal}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in border border-gray-100 dark:border-gray-700 my-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                            <h3 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                                Purchase Tickets
                            </h3>
                            <button
                                onClick={closePurchaseModal}
                                aria-label="Close"
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl leading-none p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
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
                                    Phone Number <span className="text-sffl-red ml-1">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g. +234..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">We may call you regarding your ticket</p>
                            </div>

                            {/* Referral Code */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Referral Code <span className="text-gray-500 font-normal ml-1">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={referralCode}
                                    onChange={(e) => setReferralCode(e.target.value)}
                                    placeholder="SFFL-XXXX"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none uppercase"
                                />
                                <p className="text-xs text-gray-500 mt-1">If you were referred, enter the referrer's code</p>
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

                            {/* Discount code — hidden on free tiers, where
                                there is nothing left to take off. */}
                            {selectedTier.price > 0 && (
                                <div className="border-t dark:border-gray-700 pt-4">
                                    <DiscountCodeInput
                                        tierId={selectedTier.id}
                                        quantity={quantity}
                                        onChange={setDiscount}
                                        disabled={purchasing}
                                    />
                                </div>
                            )}

                            {/* Total */}
                            <div className="border-t dark:border-gray-700 pt-4 space-y-1.5">
                                {ticketDiscount > 0 && (
                                    <>
                                        <div className="flex justify-between items-baseline text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                                            <span className="text-gray-500 dark:text-gray-400 line-through">
                                                ₦{ticketSubtotal.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Discount ({discount?.code})</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                −₦{ticketDiscount.toLocaleString()}
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Total:</span>
                                    <span className="text-3xl font-black text-sffl-red">₦{ticketTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Optional newsletter opt-in. Unticked by default —
                                a pre-ticked box isn't consent. */}
                            {newsletterEnabled && (
                                <label className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={joinNewsletter}
                                        onChange={e => setJoinNewsletter(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 shrink-0 accent-sffl-red cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                        <span className="font-bold text-gray-800 dark:text-white">Send me the Showtime newsletter</span>
                                        <br />
                                        Fixtures, match news and ticket drops. Unsubscribe any time.
                                    </span>
                                </label>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50/90 dark:bg-gray-800/90 space-y-3">
                            <div className="flex gap-3">
                                <button
                                    onClick={closePurchaseModal}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white font-bold py-3 rounded-lg transition min-h-[44px]"
                                    disabled={purchasing}
                                >Cancel</button>
                                <button
                                    onClick={handlePurchase}
                                    disabled={purchasing || !email || !name || !phone.trim()}
                                    className="flex-1 bg-sffl-red hover:bg-[#A52323] text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                    {purchasing ? (
                                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                                    ) : (
                                        ticketTotal === 0 ? '🎟️ Get Free Ticket' : '💳 Pay with Paystack'
                                    )}
                                </button>
                            </div>

                            <p className="text-[11px] text-gray-500 text-center">
                                {ticketTotal === 0
                                    ? '✨ Your free ticket will be sent instantly'
                                    : '🔒 You will be redirected to Paystack for secure payment'}
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
