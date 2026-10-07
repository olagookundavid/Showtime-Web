import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GiftIcon, ClipboardIcon, CheckIcon, CheckCircleIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { getAllEventDays, giftTicket } from '../../services/api';
import type { EventDayResponse, TicketResponse } from '../../types/tickets';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Button, Field, IconButton, Input, Select } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';

const MAX_QUANTITY = 10;

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
    const [confirming, setConfirming] = useState(false);
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
    const selectedTier = tiers.find((t) => t.id === tierId);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setQuantity(1);
        setTierId('');
    };

    const requestGift = () => {
        if (!eventDayId || !tierId || !name.trim() || !email.trim()) {
            toast.error('Event, tier, recipient name and email are required');
            return;
        }
        setConfirming(true);
    };

    const handleSubmit = async () => {
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
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to gift ticket'));
        } finally {
            setSubmitting(false);
            setConfirming(false);
        }
    };

    return (
        <div>
            <DashboardPageHeader
                title="Administrator"
                subtitle="Gift a complimentary ticket without payment."
                className="mb-6"
            />

            <div className="max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow p-4 sm:p-5 md:p-7 space-y-5">
                {/* Event Day */}
                <Field label="Event Day" htmlFor="gift-event-day">
                    <Select
                        id="gift-event-day"
                        value={eventDayId}
                        onChange={(e) => {
                            setEventDayId(e.target.value);
                            setTierId('');
                        }}
                        disabled={isLoading}
                    >
                        <option value="">{isLoading ? 'Loading event days' : 'Select an event day'}</option>
                        {eventDays.map((ed) => (
                            <option key={ed.id} value={ed.id}>
                                {ed.title} — {new Date(ed.date).toLocaleDateString()}
                                {ed.is_active ? '' : ' (inactive)'}
                            </option>
                        ))}
                    </Select>
                </Field>

                {/* Tier */}
                <Field label="Ticket Tier" htmlFor="gift-tier">
                    <Select
                        id="gift-tier"
                        value={tierId}
                        onChange={(e) => setTierId(e.target.value)}
                        disabled={!selectedEventDay}
                    >
                        <option value="">{selectedEventDay ? 'Select a tier' : 'Select an event day first'}</option>
                        {tiers.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name} — ₦{t.price.toLocaleString()}
                                {t.capacity > 0 ? ` (${t.available} left)` : ''}
                            </option>
                        ))}
                    </Select>
                </Field>

                {/* Recipient Name */}
                <Field label="Recipient Name" htmlFor="gift-name">
                    <Input
                        id="gift-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                    />
                </Field>

                {/* Recipient Email */}
                <Field label="Recipient Email" htmlFor="gift-email" hint="The ticket and confirmation email are sent here">
                    <Input
                        id="gift-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@mail.com"
                    />
                </Field>

                {/* Phone */}
                <Field
                    label={<>Phone Number <span className="text-gray-500 font-normal ml-1">(optional)</span></>}
                    htmlFor="gift-phone"
                >
                    <Input
                        id="gift-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +234 801 234 5678"
                    />
                </Field>

                {/* Quantity */}
                <div>
                    <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Quantity</span>
                    <div className="flex items-center gap-4">
                        <IconButton
                            variant="secondary"
                            icon={MinusIcon}
                            label="Decrease quantity"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                        />
                        <span className="font-bold text-xl w-12 text-center dark:text-white" aria-live="polite">{quantity}</span>
                        <IconButton
                            variant="secondary"
                            icon={PlusIcon}
                            label="Increase quantity"
                            onClick={() => setQuantity(Math.min(MAX_QUANTITY, quantity + 1))}
                            disabled={quantity >= MAX_QUANTITY}
                        />
                    </div>
                </div>

                <Button
                    icon={GiftIcon}
                    onClick={requestGift}
                    disabled={submitting || !eventDayId || !tierId || !name.trim() || !email.trim()}
                    fullWidth
                >
                    Gift Ticket
                </Button>

                {issued && (
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm">
                        <p className="inline-flex items-center gap-1.5 font-bold text-green-700 dark:text-green-400">
                            <CheckCircleIcon className="w-5 h-5" aria-hidden="true" />
                            Ticket issued
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 mt-1 wrap-break-word">
                            Sent to <span className="font-semibold">{issued.email}</span>.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <code className="font-mono font-bold text-base bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white select-all break-all">
                                {issued.ticket_code}
                            </code>
                            <Button
                                variant="success"
                                icon={copied ? CheckIcon : ClipboardIcon}
                                onClick={handleCopyCode}
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirming}
                title="Gift this ticket?"
                description="The ticket is issued without payment and emailed to the recipient straight away."
                confirmLabel="Gift Ticket"
                tone="success"
                icon={GiftIcon}
                pending={submitting}
                onConfirm={handleSubmit}
                onCancel={() => setConfirming(false)}
                body={
                    <ConfirmSummary rows={[
                        ['Event', selectedEventDay?.title],
                        ['Tier', selectedTier?.name],
                        ['Recipient', name.trim()],
                        ['Email', email.trim()],
                        ['Quantity', String(quantity)],
                    ]} />
                }
            />
        </div>
    );
};

export default AdminGiftTicket;
