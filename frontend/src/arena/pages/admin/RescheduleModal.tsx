import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, Checkbox, Field, Input, Modal } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaMatch } from '../../../types';
import { errorMessage, formatDateTime, fromLagosInput, matchRound, toLagosInput } from '../../utils';
import { invalidateArena } from './seasonHelpers';

const FORM_ID = 'arena-reschedule-form';

interface RescheduleModalProps {
  match: ArenaMatch;
  onClose: () => void;
}

/** Move a match to a new kick-off time, or mark it postponed. Times are Lagos time. */
export const RescheduleModal = ({ match, onClose }: RescheduleModalProps) => {
  const qc = useQueryClient();
  const [kickoff, setKickoff] = useState(toLagosInput(match.kickoff_at));
  const [postponed, setPostponed] = useState(match.status === 'postponed');
  const [submitted, setSubmitted] = useState(false);

  const home = match.home?.name ?? 'To be decided';
  const away = match.away?.name ?? 'To be decided';
  const missing = !postponed && !kickoff;

  const save = useMutation({
    mutationFn: () => arenaApi.reschedule(match.id, { kickoff_at: kickoff ? fromLagosInput(kickoff) : null, postponed }),
    onSuccess: () => {
      toast.success(postponed ? 'Match marked as postponed.' : 'Kick-off time updated.');
      invalidateArena(qc);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal shape="square"
      open
      onClose={onClose}
      title="Reschedule match"
      subtitle={`${home} v ${away}`}
      maxWidth="md"
      footer={
        <>
          <Button shape="square" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button shape="square" type="submit" form={FORM_ID} loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (!missing) save.mutate();
        }}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {matchRound(match)}. Now {match.kickoff_at ? `${formatDateTime(match.kickoff_at)} WAT` : 'without a kick-off time'}
          {match.status === 'postponed' ? ' (postponed)' : ''}.
        </p>
        <Field
          label="Kick-off time (WAT)"
          htmlFor="reschedule-kickoff"
          hint="West Africa Time, wherever you are."
          error={submitted && missing ? 'Choose a new kick-off time, or tick Postponed.' : undefined}
        >
          <Input shape="square"
            id="reschedule-kickoff"
            type="datetime-local"
            value={kickoff}
            invalid={submitted && missing}
            onChange={(e) => setKickoff(e.target.value)}
          />
        </Field>
        <Checkbox
          checked={postponed}
          onChange={(e) => setPostponed(e.target.checked)}
          label="Postponed"
          hint="Tick this when the match can't go ahead and has no new time yet. Untick it once it is back on."
        />
      </form>
    </Modal>
  );
};
