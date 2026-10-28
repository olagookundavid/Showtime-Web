import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCardIcon, LockClosedIcon, MinusIcon, PlusIcon, SparklesIcon, StarIcon } from '@heroicons/react/24/outline';
import { getUserProfile, purchaseSeasonPass } from '../../services';
import { newsletterEnabled, subscribeToNewsletter, toFirstName } from '../../services/newsletter';
import type { AuthUser, PurchaseSeasonPassPayload, SeasonPassResponse } from '../../types';
import { Button, Checkbox, ConfirmDialog, ConfirmSummary, Field, IconButton, Input, Modal } from '../ui';
import { formatDayLong, naira } from './ticketFormat';

interface SeasonPassCheckoutProps {
    pass: SeasonPassResponse;
    onClose: () => void;
}

/**
 * Collects the buyer's details and starts payment for a season pass.
 *
 * A season pass has one fixed price set by an admin: there is no day picker and
 * no server quote, so the total shown here is exactly what the server charges.
 */
export const SeasonPassCheckout = ({ pass, onClose }: SeasonPassCheckoutProps) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [quantity, setQuantity] = useState(1);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [referralCode, setReferralCode] = useState(searchParams.get('ref') ?? '');
    const [useAccountEmail, setUseAccountEmail] = useState(false);
    const [userProfile, setUserProfile] = useState<AuthUser | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState('');
    // Consent must be given actively, so this starts unticked and stays out of
    // the purchase validation — it can never block or fail a purchase.
    const [joinNewsletter, setJoinNewsletter] = useState(false);
    // A purchase creates a ticket order, so it waits for an explicit confirm.
    const [confirmPurchase, setConfirmPurchase] = useState(false);

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

    const total = pass.price * quantity;
    const free = total === 0;

    const handlePurchase = async () => {
        if (!email || !name || !phone.trim()) {
            setError('Full Name, Email and Phone Number are required');
            return;
        }
        setError('');
        setPurchasing(true);

        try {
            const payload: PurchaseSeasonPassPayload = {
                season_pass_id: pass.id,
                email,
                name,
                phone,
                quantity,
                referral_code: referralCode.trim() || undefined,
            };

            const result = await purchaseSeasonPass(payload);

            // Fire-and-forget, deliberately after the sale succeeded and never
            // awaited: `keepalive` lets it complete even though the next line
            // navigates away to Paystack, and a failure here is invisible to
            // the buyer rather than costing them their pass.
            if (joinNewsletter) {
                void subscribeToNewsletter({ firstName: toFirstName(name), email }, { keepalive: true });
            }

            if (result.authorization_url) {
                window.location.href = result.authorization_url;
            } else if (result.paystack_reference) {
                // Free pass case - redirect to success page
                navigate(`/tickets/confirm?reference=${result.paystack_reference}`);
            }
        } catch (err: unknown) {
            const errorResponse = err as { response?: { data?: { error?: string } } };
            setError(errorResponse.response?.data?.error || 'Failed to initiate purchase. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title="Buy Season Pass"
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
                            icon={free ? StarIcon : CreditCardIcon}
                            disabled={purchasing || !email || !name || !phone.trim()}
                            onClick={() => setConfirmPurchase(true)}
                        >
                            {purchasing ? 'Processing…' : free ? 'Get Free Pass' : 'Pay with Paystack'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* What is being bought */}
                    <div className="bg-gray-50 p-4 dark:bg-gray-700">
                        <div className="inline-block bg-sffl-navy px-3 py-1 text-xs font-bold text-white">
                            {pass.name} Season Pass
                        </div>
                        <p className="mt-3 text-sm font-bold text-sffl-navy dark:text-white">
                            Valid through {formatDayLong(pass.ends_on)}
                        </p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            Your code gets you in on every match day up to and including that date.
                        </p>
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
                        htmlFor="season-pass-name"
                    >
                        <Input
                            id="season-pass-name"
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
                        htmlFor="season-pass-email"
                        hint="Your Season Pass will be sent to this email"
                    >
                        <Input
                            id="season-pass-email"
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
                        htmlFor="season-pass-phone"
                        hint="We may call you regarding your Season Pass"
                    >
                        <Input
                            id="season-pass-phone"
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
                        htmlFor="season-pass-referral"
                        hint="If you were referred, enter the referrer's code"
                    >
                        <Input
                            id="season-pass-referral"
                            type="text"
                            shape="square"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value)}
                            placeholder="SFFL-XXXX"
                        />
                    </Field>

                    <Field label="How many passes">
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

                    {/* Total */}
                    <div className="space-y-1.5 border-t pt-4 dark:border-gray-700">
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
                            ? 'Your free Season Pass will be sent instantly'
                            : 'You will be redirected to Paystack for secure payment'}
                    </p>
                </div>
            </Modal>

            {/* Sits outside the Modal, so its backdrop clicks don't close the purchase. */}
            <ConfirmDialog
                open={confirmPurchase}
                title={free ? 'Get this free Season Pass?' : 'Pay for this Season Pass?'}
                description={
                    free
                        ? 'Your Season Pass will be emailed to you straight away.'
                        : 'You will be taken to Paystack to complete payment.'
                }
                confirmLabel={free ? 'Get free pass' : 'Pay now'}
                tone="info"
                icon={StarIcon}
                pending={purchasing}
                body={
                    <ConfirmSummary
                        rows={[
                            ['Pass', pass.name],
                            ['Valid through', formatDayLong(pass.ends_on)],
                            ['Passes', String(quantity)],
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
