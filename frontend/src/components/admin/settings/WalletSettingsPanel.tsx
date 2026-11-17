import { useState } from 'react';
import toast from 'react-hot-toast';
import { WalletIcon } from '@heroicons/react/24/outline';
import { appSettingsApi } from '../../../services';
import type { AdminSettings, WalletSettings } from '../../../types';
import { formatNaira, getApiErrorMessage } from '../../../utils';
import { Button, ConfirmDialog, ConfirmSummary, Field, Input } from '../../ui';
import { SettingsSection } from './SettingsSection';

type Props = {
    settings: WalletSettings;
    onSaved: (next: AdminSettings) => void;
};

/** Keep in step with maxWalletBalanceKobo in the backend app setting service. */
const MAX_BALANCE_NAIRA = 100_000_000;

const toNairaText = (kobo: number) => String(kobo / 100);
// Parsed to kobo so ₦0.10 style typing never leaves a float in the request.
const toKobo = (text: string) => (text.trim() === '' ? NaN : Math.round(Number(text) * 100));

/** The smallest and largest top-up, and the most a wallet may hold, in naira. */
export const WalletSettingsPanel = ({ settings, onSaved }: Props) => {
    const [min, setMin] = useState(toNairaText(settings.min_topup_kobo));
    const [max, setMax] = useState(toNairaText(settings.max_topup_kobo));
    const [balance, setBalance] = useState(toNairaText(settings.max_balance_kobo));
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);

    const minKobo = toKobo(min);
    const maxKobo = toKobo(max);
    const balanceKobo = toKobo(balance);

    // One message per field, mirroring the server so a bad value is caught before the request.
    const minError = min === '' ? undefined : !(minKobo > 0) ? 'Enter an amount above ₦0.' : minKobo > maxKobo ? 'The smallest top-up can\'t be more than the largest top-up.' : undefined;
    const maxError = max === '' ? undefined : !(maxKobo > 0) ? 'Enter an amount above ₦0.' : maxKobo > balanceKobo ? 'The largest top-up can\'t be more than the largest wallet balance.' : undefined;
    const balanceError = balance === '' ? undefined : !(balanceKobo > 0) ? 'Enter an amount above ₦0.' : balanceKobo > MAX_BALANCE_NAIRA * 100 ? `The largest wallet balance can't be more than ${formatNaira(MAX_BALANCE_NAIRA)}.` : undefined;

    const valid = minKobo > 0 && maxKobo > 0 && balanceKobo > 0 && !minError && !maxError && !balanceError;
    const dirty = valid && (minKobo !== settings.min_topup_kobo || maxKobo !== settings.max_topup_kobo || balanceKobo !== settings.max_balance_kobo);

    const save = async () => {
        setSaving(true);
        try {
            const next = await appSettingsApi.saveWallet({ min_topup_kobo: minKobo, max_topup_kobo: maxKobo, max_balance_kobo: balanceKobo });
            onSaved(next);
            setMin(toNairaText(next.wallet.min_topup_kobo));
            setMax(toNairaText(next.wallet.max_topup_kobo));
            setBalance(toNairaText(next.wallet.max_balance_kobo));
            toast.success('Wallet limits saved.');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save the wallet limits.'));
        } finally {
            setSaving(false);
            setConfirming(false);
        }
    };

    return (
        <SettingsSection
            title="Wallet limits"
            description="How much people can add to their spend wallet. The limits apply to every new top-up straight away; money already in a wallet is never changed."
            footer={
                <Button onClick={() => setConfirming(true)} disabled={!dirty}>
                    Save wallet limits
                </Button>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Field label="Smallest top-up (₦)" htmlFor="set-wallet-min" hint="The least someone can add in one go." error={minError}>
                    <Input id="set-wallet-min" type="number" inputMode="decimal" min="1" step="1" value={min} invalid={!!minError} onChange={(e) => setMin(e.target.value)} />
                </Field>
                <Field label="Largest top-up (₦)" htmlFor="set-wallet-max" hint="The most someone can add in one go." error={maxError}>
                    <Input id="set-wallet-max" type="number" inputMode="decimal" min="1" step="1" value={max} invalid={!!maxError} onChange={(e) => setMax(e.target.value)} />
                </Field>
                <Field label="Largest wallet balance (₦)" htmlFor="set-wallet-balance" hint="A top-up that would take a wallet above this is refused." error={balanceError}>
                    <Input id="set-wallet-balance" type="number" inputMode="decimal" min="1" step="1" value={balance} invalid={!!balanceError} onChange={(e) => setBalance(e.target.value)} />
                </Field>
            </div>

            <ConfirmDialog
                open={confirming}
                title="Change the wallet limits?"
                description="These limits apply to every top-up made from now on."
                confirmLabel="Change Limits"
                tone="warning"
                icon={WalletIcon}
                pending={saving}
                body={
                    <ConfirmSummary
                        rows={[
                            ['Smallest top-up', `${formatNaira(settings.min_topup_kobo / 100)} to ${valid ? formatNaira(minKobo / 100) : min}`],
                            ['Largest top-up', `${formatNaira(settings.max_topup_kobo / 100)} to ${valid ? formatNaira(maxKobo / 100) : max}`],
                            ['Largest balance', `${formatNaira(settings.max_balance_kobo / 100)} to ${valid ? formatNaira(balanceKobo / 100) : balance}`],
                        ]}
                    />
                }
                onConfirm={save}
                onCancel={() => setConfirming(false)}
            />
        </SettingsSection>
    );
};
