import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { playerPortalApi } from '../../services/api';
import type { OfferResponse } from '../../types/contracts';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfirmSummary } from '../ui/ConfirmSummary';
import { apiError } from './apiError';

interface OfferResponseDialogProps {
    /** The offer and the answer waiting to be confirmed. null keeps the dialog closed. */
    request: OfferResponse | null;
    onCancel: () => void;
    /** Runs after the request settles, so the page can close the dialog and refetch. */
    onDone: () => void;
}

/**
 * The confirm step before a player accepts or rejects a contract offer. Used by
 * both the Overview and Contracts pages, so the wording and the call live here.
 */
export const OfferResponseDialog = ({ request, onCancel, onDone }: OfferResponseDialogProps) => {
    const [busy, setBusy] = useState(false);

    const respond = async () => {
        if (!request) return;
        const { contract, action } = request;
        setBusy(true);
        try {
            await playerPortalApi.respondToContract(contract.id, action);
            toast.success(action === 'accept' ? 'Contract offer accepted' : 'Contract offer rejected');
        } catch (err) {
            toast.error(apiError(err).error || 'Failed to respond to contract offer');
        } finally {
            setBusy(false);
            onDone();
        }
    };

    const contract = request?.contract;
    const team = contract?.team?.name || 'the team';
    const accepting = request?.action === 'accept';

    return (
        <ConfirmDialog
            open={request !== null}
            title={accepting ? `Accept the offer from ${team}?` : `Reject the offer from ${team}?`}
            description={accepting ? 'You will be signed to the team.' : 'The team would have to send a new one.'}
            body={contract ? (
                <ConfirmSummary rows={[
                    ['Team', contract.team?.name],
                    ['Length', `${contract.contract_length.toLocaleString()} team matches`],
                    ['Value', `${contract.player_value.toLocaleString()} pts`],
                    ['Offered', new Date(contract.offered_at).toLocaleDateString()],
                ]} />
            ) : undefined}
            confirmLabel={accepting ? 'Accept Offer' : 'Reject Offer'}
            tone={accepting ? 'success' : 'warning'}
            icon={accepting ? CheckCircleIcon : XCircleIcon}
            pending={busy}
            onConfirm={respond}
            onCancel={onCancel}
        />
    );
};
