import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { Button, Field, Modal, Textarea } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaContract } from '../../../types';
import { arenaKeys } from '../../hooks';
import { errorMessage } from '../../utils';
import { MANAGE_KEY } from './ContractShared';

const MAX_REASON = 300;
const FORM_ID = 'offer-decline-form';

/** Turning down another club's request for one of your players, with an optional reason they will read. */
export const OfferDeclineModal = ({ contract, onClose }: { contract: ArenaContract; onClose: () => void }) => {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const decline = useMutation({
    mutationFn: () => arenaApi.declineRelease(contract.id, reason.trim()),
    onSuccess: () => {
      toast.success(`You declined to release ${contract.player_name}.`);
      qc.invalidateQueries({ queryKey: MANAGE_KEY });
      qc.invalidateQueries({ queryKey: arenaKeys.me });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    decline.mutate();
  };

  return (
    <Modal shape="square"
      open
      onClose={decline.isPending ? undefined : onClose}
      title={`Decline the request for ${contract.player_name}?`}
      subtitle={`${contract.club_name} will be told, and their offer ends.`}
      maxWidth="lg"
      footer={
        <>
          <Button shape="square" variant="secondary" onClick={onClose} disabled={decline.isPending}>
            Cancel
          </Button>
          <Button shape="square" type="submit" form={FORM_ID} variant="danger" icon={XCircleIcon} loading={decline.isPending}>
            Decline request
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <Field label="Reason (optional)" htmlFor="decline-reason" hint={`${reason.length} / ${MAX_REASON}. ${contract.club_name} can read this on the offer.`}>
          <Textarea shape="square"
            id="decline-reason"
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: we need him for the rest of the season."
          />
        </Field>
      </form>
    </Modal>
  );
};
