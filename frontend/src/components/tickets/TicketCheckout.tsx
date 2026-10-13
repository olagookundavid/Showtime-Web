import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCardIcon, LockClosedIcon, MinusIcon, PlusIcon, SparklesIcon, TicketIcon } from '@heroicons/react/24/outline';
import { getUserProfile, purchaseTicket, quoteTicketPrice } from '../../services/api';
import { newsletterEnabled, subscribeToNewsletter, toFirstName } from '../../services/newsletter';
import type {
    AuthUser,
    DiscountPreview,
    PurchaseTicketPayload,
    PurchaseType,
    TicketProductDayResponse,
    TicketProductResponse,
} from '../../types';
import { Button, Checkbox, ConfirmDialog, ConfirmSummary, Field, IconButton, Input, Modal } from '../ui';
import { DiscountCodeInput } from '../discounts';
import { formatDayShort, naira } from './ticketFormat';

interface TicketCheckoutProps {
    product: TicketProductResponse;
    /** The days being bought: one for a normal ticket, two or more for a Game Pass. */
    days: TicketProductDayResponse[];
    purchaseType: PurchaseType;
    /** The access code that unlocked this ticket, if it is a hidden one. */
    accessCode?: string;
    onClose: () => void;
}

/**
 * Collects the buyer's details and starts payment. Used by both the single-ticket
 * page and the Game Pass page, so the two cannot drift apart.
 *
 * What the buyer sees is a preview. The server prices the selection again at
 * purchase from the product's own prices, and ignores any amount sent from here.
 */
export const TicketCheckout = ({ product, days, purchaseType, accessCode, onClose }: TicketCheckoutProps) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isPass = purchaseType === 'GAME_PASS';
    const dayIds = days.map((d) => d.event_day_id);

    const [quantity, setQuantity] = useState(1);
    // Server-priced preview of an applied discount code. Display only — the
    // server re-prices the code at purchase time.
    const [discount, setDiscount] = useState<DiscountPreview | null>(null);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [referralCode, setReferralCode] = useState(searchParams.get('ref') ?? '');
    const [useAccountEmail, setUseAccountEmail] = useState(false);
    const [userProfile, setUserProfile] = useState<AuthUser | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');
    // Consent must be given actively, so this starts unticked and stays out of
    // the purchase validation — it can never block or fail a ticket sale.
    const [joinNewsletter, setJoinNewsletter] = useState(false);
    // A purchase creates a ticket order, so it waits for an explicit confirm.
    const [confirmPurchase, setConfirmPurchase] = useState(false);

    // The same pricing code the purchase uses, so the figure shown is the figure
    // charged. Kept while a new quantity loads so the total doesn't flicker.
    const { data: quote } = useQuery({
        queryKey: ['ticketQuote', product.id, dayIds, purchaseType, quantity],
        queryFn: () =>
            quoteTicketPrice({
                product_id: product.id,
                event_day_ids: dayIds,
                purchase_type: purchaseType,
                quantity,
            }),
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

    // Check auth status on mount
    useEffect(() => {
        const token = localStorage.getItem('showtime_access_token');
        if (!token) return;
        getUserProfile()
            .then((profile) => {
                setUserProfile(profile);
                setUseAccountEmail(true);
                setEmail(profile.email);
                setName(profile.full_name);
                if (profile.phone) setPhone(profile.phone);
            })
            .catch(() => setUserProfile(null)); // Not logged in or expired
    }, []);

    // Sync email and name when toggle changes
    useEffect(() => {
        if (useAccountEmail && userProfile) {
            setEmail(userProfile.email);
            setName(userProfile.full_name);
        }
    }, [useAccountEmail, userProfile]);

    // Until the server's quote arrives, fall back to the list prices.
    const listUnit = days.reduce((sum, d) => sum + d.price, 0);
    const unitPrice = quote?.unit_price ?? listUnit;
    const subtotal = quote?.subtotal ?? listUnit * quantity;
    const passDiscount = quote?.game_pass_discount_amount ?? 0;
    const passPercent = quote?.game_pass_discount_percent ?? 0;
    const codeDiscount = !isPass ? (discount?.discount_amount ?? 0) : 0;
    const total = Math.max(0, subtotal - passDiscount - codeDiscount);
    const free = total === 0;

    const handlePurchase = async () => {
        if (!email || !name || !phone.trim()) {
            setError('Full Name, Email and Phone Number are required');
            return;
        }
        setError('');
        setPurchasing(true);

        try {
            const payload: PurchaseTicketPayload = {
                product_id: product.id,
                purchase_type: purchaseType,
                event_day_ids: dayIds,
                email,
                name,
                phone,
                quantity,
                referral_code: referralCode.trim() || undefined,
                access_code: accessCode || undefined,
                // Send the code, not the amount — the server recomputes it.
                discount_code: !isPass ? discount?.code || undefined : undefined,
            };

            const result = await purchaseTicket(payload);

            // Fire-and-forget, deliberately after the sale succeeded and never
            // awaited: `keepalive` lets it complete even though the next line
            // navigates away to Paystack, and a failure here is invisible to
            // the buyer rather than costing them their ticket.
            if (joinNewsletter) {
                void subscribeToNewsletter({ firstName: toFirstName(name), email }, { keepalive: true });
            }

            if (result.authorization_url) {
                window.location.href = result.authorization_url;
            } else if (result.paystack_reference) {
                // Free ticket case - redirect to success page
                navigate(`/tickets/confirm?reference=${result.paystack_reference}`);
            }
        } catch (err: unknown) {
            const errorResponse = err as { response?: { data?: { error?: string } } };
            setError(errorResponse.response?.data?.error || 'Failed to initiate purchase. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const noun = isPass ? 'Game Pass' : 'ticket';

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title={isPass ? 'Buy Game Pass' : 'Purchase Tickets'}
                maxWidth="lg"
                shape="square"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="square"
                            size="lg"
                            className="flex-1"
                            disabled={purchasing}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            shape="square"
                            size="lg"
                            className="flex-1"
                            loading={purchasing}
                            icon={free ? TicketIcon : CreditCardIcon}
                            disabled={purchasing || !email || !name || !phone.trim()}
                            onClick={() => setConfirmPurchase(true)}
                        >
                            {purchasing ? 'Processing…' : free ? `Get Free ${isPass ? 'Pass' : 'Ticket'}` : 'Pay with Paystack'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* What is being bought */}
                    <div className="bg-gray-50 p-4 dark:bg-gray-700">
                        <div className="inline-block bg-sffl-navy px-3 py-1 text-xs font-bold text-white">
                            {product.name}
                            {isPass && ` Game Pass · ${days.length} match days`}
                        </div>
                        <ul className="mt-3 space-y-2">
                            {days.map((d) => (
                                <li key={d.id} className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="min-w-0">
                                        <span className="block font-bold wrap-break-word text-sffl-navy dark:text-white">
                                            {d.event_title}
                                        </span>
                                        <span className="block text-xs text-gray-600 dark:text-gray-300">
                                            {formatDayShort(d.event_date)}
                                            {d.event_venue && ` • ${d.event_venue}`}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-bold text-sffl-navy dark:text-white">
                                        {d.price === 0 ? 'Free' : naira(d.price)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {isPass && (
                            <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                                One code gets you in on every one of these days.
                            </p>
                        )}
                    </div>

                    {/* Auth Toggle */}
                    {userProfile && (
                        <div className="border border-blue-100 bg-blue-50 px-3 py-1 dark:border-blue-800 dark:bg-blue-900/30">
                            <Checkbox
                                label={<span className="text-blue-800 dark:text-blue-300">Use my account information</span>}
                                checked={useAccountEmail}
                                onChange={(e) => setUseAccountEmail(e.target.checked)}
                            />
                        </div>
                    )}

                    <Field
                        label={
                            <>
                                Full Name <span className="text-red-500">*</span>
                            </>
                        }
                        htmlFor="ticket-name"
                    >
                        <Input
                            id="ticket-name"
                            type="text"
                            shape="square"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. John Doe"
                            required
                            disabled={useAccountEmail}
                        />
                    </Field>

                    <Field
                        label={
                            <>
                                Email Address <span className="text-red-500">*</span>
                            </>
                        }
                        htmlFor="ticket-email"
                        hint={`Your ${noun} will be sent to this email`}
                    >
                        <Input
                            id="ticket-email"
                            type="email"
                            shape="square"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. example@mail.com"
                            required
                            disabled={useAccountEmail}
                        />
                    </Field>

                    <Field
                        label={
                            <>
                                Phone Number <span className="ml-1 text-sffl-red">*</span>
                            </>
                        }
                        htmlFor="ticket-phone"
                        hint={`We may call you regarding your ${noun}`}
                    >
                        <Input
                            id="ticket-phone"
                            type="tel"
                            shape="square"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +234..."
                            required
                        />
                    </Field>

                    <Field
                        label={
                            <>
                                Referral Code <span className="ml-1 font-normal text-gray-500">(optional)</span>
                            </>
                        }
                        htmlFor="ticket-referral"
                        hint="If you were referred, enter the referrer's code"
                    >
                        <Input
                            id="ticket-referral"
                            type="text"
                            shape="square"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value)}
                            placeholder="SFFL-XXXX"
                        />
                    </Field>

                    <Field label={isPass ? 'How many passes' : 'Quantity'}>
                        <div className="flex items-center gap-4">
                            <IconButton
                                variant="secondary"
                                shape="square"
                                icon={MinusIcon}
                                label="Decrease quantity"
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            />
                            <span className="w-12 text-center text-xl font-bold dark:text-white" aria-live="polite">
                                {quantity}
                            </span>
                            <IconButton
                                variant="secondary"
                                shape="square"
                                icon={PlusIcon}
                                label="Increase quantity"
                                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                            />
                        </div>
                    </Field>

                    {/* Discount codes are for single tickets (a Game Pass has its own
                        percentage off), and there is nothing to take off a free one. */}
                    {!isPass && unitPrice > 0 && (
                        <div className="border-t pt-4 dark:border-gray-700">
                            <DiscountCodeInput
                                productId={product.id}
                                eventDayId={days[0]?.event_day_id}
                                quantity={quantity}
                                onChange={setDiscount}
                                disabled={purchasing}
                            />
                        </div>
                    )}

                    {/* Total */}
                    <div className="space-y-1.5 border-t pt-4 dark:border-gray-700">
                        {(passDiscount > 0 || codeDiscount > 0) && (
                            <div className="flex items-baseline justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                                <span className="text-gray-500 line-through dark:text-gray-400">{naira(subtotal)}</span>
                            </div>
                        )}
                        {passDiscount > 0 && (
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 text-gray-500 dark:text-gray-400">
                                    Game Pass discount ({passPercent}% off)
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    −{naira(passDiscount)}
                                </span>
                            </div>
                        )}
                        {codeDiscount > 0 && (
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 break-all text-gray-500 dark:text-gray-400">
                                    Discount ({discount?.code})
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    −{naira(codeDiscount)}
                                </span>
                            </div>
                        )}
                        <div className="flex items-baseline justify-between">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Total:</span>
                            <span className="text-2xl font-black text-sffl-red sm:text-3xl">{naira(total)}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Optional newsletter opt-in. Unticked by default — a pre-ticked box isn't consent. */}
                    {newsletterEnabled && (
                        <label className="flex cursor-pointer items-start gap-3 border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40">
                            <Checkbox
                                className="mt-0.5"
                                checked={joinNewsletter}
                                onChange={(e) => setJoinNewsletter(e.target.checked)}
                            />
                            <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                <span className="font-bold text-gray-800 dark:text-white">Send me the Showtime newsletter</span>
                                <br />
                                Fixtures, match news and ticket drops. Unsubscribe any time.
                            </span>
                        </label>
                    )}
                    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
                        {free ? (
                            <SparklesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                            <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        {free
                            ? `Your free ${noun} will be sent instantly`
                            : 'You will be redirected to Paystack for secure payment'}
                    </p>
                </div>
            </Modal>

            {/* Sits outside the Modal, so its backdrop clicks don't close the purchase. */}
            <ConfirmDialog
                open={confirmPurchase}
                title={free ? `Get this free ${noun}?` : isPass ? 'Pay for this Game Pass?' : 'Pay for these tickets?'}
                description={
                    free
                        ? `Your ${noun} will be emailed to you straight away.`
                        : 'You will be taken to Paystack to complete payment.'
                }
                confirmLabel={free ? `Get free ${noun}` : 'Pay now'}
                tone="info"
                icon={TicketIcon}
                pending={purchasing}
                body={
                    <ConfirmSummary
                        rows={[
                            ['Ticket', product.name],
                            [isPass ? 'Match days' : 'Match day', days.map((d) => d.event_title).join(', ')],
                            ['Quantity', String(quantity)],
                            ['Total', naira(total)],
                        ]}
                    />
                }
                onConfirm={async () => {
                    await handlePurchase();
                    setConfirmPurchase(false);
                }}
                onCancel={() => setConfirmPurchase(false)}
            />
        </>
    );
};
