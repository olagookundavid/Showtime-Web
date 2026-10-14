import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { GiftIcon, ClipboardIcon, CheckIcon, CheckCircleIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { adminListTicketProducts, giftTicket } from '../../services/api';
import type { TicketResponse } from '../../types';
import { ConfirmDialog, ConfirmSummary, Button, Field, IconButton, Input, Select, DashboardPageHeader, TicketDayPicker } from '../../components';
import { getApiErrorMessage } from '../../utils';

const MAX_QUANTITY = 10;

export const AdminGiftTicket = () => {
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['adminTicketProducts'],
        queryFn: adminListTicketProducts,
    });

    const [productId, setProductId] = useState('');
    const [dayIds, setDayIds] = useState<string[]>([]);
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

    const activeProducts = products.filter((p) => p.is_active);
    const selectedProduct = activeProducts.find((p) => p.id === productId);
    // Only match days that can still be attended and are on sale.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
    const availableDays = (selectedProduct?.days ?? []).filter((d) => d.event_date >= today);
    const selectedDays = availableDays.filter((d) => dayIds.includes(d.event_day_id));

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setQuantity(1);
        setProductId('');
        setDayIds([]);
    };

    const requestGift = () => {
        if (!productId || selectedDays.length === 0 || !name.trim() || !email.trim()) {
            toast.error('Ticket, at least one match day, recipient name and email are required');
            return;
        }
        setConfirming(true);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setIssued(null);
        try {
            const result = await giftTicket({
                product_id: productId,
                event_day_ids: selectedDays.map((d) => d.event_day_id),
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
                {/* Ticket */}
                <Field label="Ticket" htmlFor="gift-product">
                    <Select
                        id="gift-product"
                        value={productId}
                        onChange={(e) => {
                            setProductId(e.target.value);
                            setDayIds([]);
                        }}
                        disabled={isLoading}
                    >
                        <option value="">{isLoading ? 'Loading tickets' : 'Select a ticket'}</option>
                        {activeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                                {p.is_hidden ? ' (hidden)' : ''}
                            </option>
                        ))}
                    </Select>
                </Field>

                {/* Match days */}
                <Field
                    label="Match days"
                    hint="Pick one or more. One code covers every match day picked."
                >
                    {!selectedProduct ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Select a ticket first.</p>
                    ) : availableDays.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            This ticket has no upcoming match days. Link it to a tournament on the Ticket Products page, or wait for the next fixtures.
                        </p>
                    ) : (
                        <TicketDayPicker
                            mode="multi"
                            name="Match days to gift"
                            days={availableDays}
                            selected={dayIds}
                            onChange={setDayIds}
                        />
                    )}
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
                    disabled={submitting || !productId || selectedDays.length === 0 || !name.trim() || !email.trim()}
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
                title={selectedDays.length > 1 ? 'Gift this Game Pass?' : 'Gift this ticket?'}
                description="The ticket is issued without payment and emailed to the recipient straight away."
                confirmLabel="Gift Ticket"
                tone="success"
                icon={GiftIcon}
                pending={submitting}
                onConfirm={handleSubmit}
                onCancel={() => setConfirming(false)}
                body={
                    <ConfirmSummary rows={[
                        ['Ticket', selectedProduct?.name],
                        [selectedDays.length > 1 ? 'Match days' : 'Match day', selectedDays.map((d) => d.event_title).join(', ')],
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
