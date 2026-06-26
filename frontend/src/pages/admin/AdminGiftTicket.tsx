import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GiftIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getAllEventDays, giftTicket, type EventDayResponse, type TicketResponse } from '../../services/api';

export const AdminGiftTicket = () => {
    const { data: eventDays = [], isLoading } = useQuery({
        queryKey: ['adminEventDaysList'],
        queryFn: () => getAllEventDays(),
    });

    const [eventDayId, setEventDayId] = useState('');
    const [tierId, setTierId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [issued, setIssued] = useState<TicketResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopyCode = async () => {
        if (!issued?.ticket_code) return;
        try {
            await navigator.clipboard.writeText(issued.ticket_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const selectedEventDay: EventDayResponse | undefined = eventDays.find((e) => e.id === eventDayId);
    const tiers = selectedEventDay?.tiers || [];

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setQuantity(1);
        setTierId('');
    };

    const handleSubmit = async () => {
        if (!eventDayId || !tierId || !name.trim() || !email.trim()) {
            toast.error('Event, tier, recipient name and email are required');
            return;
        }
        setSubmitting(true);
        setIssued(null);
        try {
            const result = await giftTicket({
                event_day_id: eventDayId,
                tier_id: tierId,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim() || undefined,
                quantity,
            });
            setIssued(result);
            toast.success(`Ticket gifted to ${result.email} — confirmation email sent`);
            resetForm();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to gift ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass =
        'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none';
    const labelClass = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-sffl-red/10 text-sffl-red p-2 rounded-xl">
                    <GiftIcon className="w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black italic text-gray-900 dark:text-white">Administrator</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gift a complimentary ticket without payment</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 md:p-7 mt-5 space-y-5">
                {/* Event Day */}
                <div>
                    <label className={labelClass}>Event Day</label>
                    <select
                        value={eventDayId}
                        onChange={(e) => {
                            setEventDayId(e.target.value);
                            setTierId('');
                        }}
                        className={inputClass}
                        disabled={isLoading}
                    >
                        <option value="">{isLoading ? 'Loading…' : 'Select an event day'}</option>
                        {eventDays.map((ed) => (
                            <option key={ed.id} value={ed.id}>
                                {ed.title} — {new Date(ed.date).toLocaleDateString()}
                                {ed.is_active ? '' : ' (inactive)'}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tier */}
                <div>
                    <label className={labelClass}>Ticket Tier</label>
                    <select
                        value={tierId}
                        onChange={(e) => setTierId(e.target.value)}
                        className={inputClass}
                        disabled={!selectedEventDay}
                    >
                        <option value="">{selectedEventDay ? 'Select a tier' : 'Select an event day first'}</option>
                        {tiers.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name} — ₦{t.price.toLocaleString()}
                                {t.capacity > 0 ? ` (${t.available} left)` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Recipient Name */}
                <div>
                    <label className={labelClass}>Recipient Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        className={inputClass}
                    />
                </div>

                {/* Recipient Email */}
                <div>
                    <label className={labelClass}>Recipient Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@mail.com"
                        className={inputClass}
                    />
                    <p className="text-xs text-gray-500 mt-1">The ticket and confirmation email are sent here</p>
                </div>

                {/* Phone */}
                <div>
                    <label className={labelClass}>
                        Phone Number <span className="text-gray-500 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +234..."
                        className={inputClass}
                    />
                </div>

                {/* Quantity */}
                <div>
                    <label className={labelClass}>Quantity</label>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white w-10 h-10 rounded-lg font-bold text-lg"
                        >−</button>
                        <span className="font-bold text-xl w-12 text-center dark:text-white">{quantity}</span>
                        <button
                            type="button"
                            onClick={() => setQuantity(Math.min(10, quantity + 1))}
                            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white w-10 h-10 rounded-lg font-bold text-lg"
                        >+</button>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={submitting || !eventDayId || !tierId || !name.trim() || !email.trim()}
                    className="w-full bg-sffl-red hover:bg-[#A52323] text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Issuing…</>
                    ) : (
                        <>🎁 Gift Ticket</>
                    )}
                </button>

                {issued && (
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm">
                        <p className="font-bold text-green-700 dark:text-green-400">Ticket issued 🎉</p>
                        <p className="text-gray-700 dark:text-gray-300 mt-1">
                            Sent to <span className="font-semibold">{issued.email}</span>.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <code className="font-mono font-bold text-base bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white select-all">
                                {issued.ticket_code}
                            </code>
                            <button
                                type="button"
                                onClick={handleCopyCode}
                                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg transition"
                            >
                                {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminGiftTicket;
