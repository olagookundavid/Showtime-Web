import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Field, IconButton, Input, Modal, Select } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaDivision } from '../../../types';
import { WEEKDAYS, errorMessage } from '../../utils';
import { invalidateArena } from './seasonHelpers';

const MAX_SLOTS = 6;
const FORM_ID = 'arena-division-form';

interface DivisionFormModalProps {
  seasonId: string;
  /** Leave out to add a division. */
  division?: ArenaDivision;
  onClose: () => void;
}

/** Add a division, or edit its name, playoff places, match day and kick-off times. */
export const DivisionFormModal = ({ seasonId, division, onClose }: DivisionFormModalProps) => {
  const qc = useQueryClient();
  const editing = Boolean(division);
  const [name, setName] = useState(division?.name ?? '');
  const [description, setDescription] = useState(division?.description ?? '');
  const [playoffSpots, setPlayoffSpots] = useState(String(division?.playoff_spots ?? 4));
  const [day, setDay] = useState(String(division?.kickoff_day ?? 0));
  const [slots, setSlots] = useState<string[]>(division?.kickoff_slots?.length ? division.kickoff_slots : ['20:00', '20:30']);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    name: name.trim().length < 2 || name.trim().length > 40 ? 'Give the division a name of 2 to 40 characters.' : '',
    slots: slots.length === 0 || slots.some((s) => !/^\d{2}:\d{2}$/.test(s)) ? 'Add at least one kick-off time, and fill in every box.' : '',
  };
  const hasErrors = Boolean(errors.name || errors.slots);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim(),
        playoff_spots: Number(playoffSpots),
        kickoff_day: Number(day),
        kickoff_slots: slots,
      };
      return division ? arenaApi.updateDivision(division.id, body) : arenaApi.createDivision(seasonId, body);
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Division updated.' : `${saved.name} added.`);
      invalidateArena(qc);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setSlot = (index: number, value: string) => setSlots((prev) => prev.map((s, i) => (i === index ? value : s)));

  return (
    <Modal shape="square"
      open
      onClose={onClose}
      title={editing ? 'Edit division' : 'Add a division'}
      subtitle={editing ? division?.name : 'A league of clubs that play each other'}
      maxWidth="xl"
      footer={
        <>
          <Button shape="square" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button shape="square" type="submit" form={FORM_ID} loading={save.isPending}>
            {editing ? 'Save changes' : 'Add division'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (!hasErrors) save.mutate();
        }}
      >
        <Field label="Division name" htmlFor="division-name" error={submitted ? errors.name : undefined} className="sm:col-span-2">
          <Input shape="square"
            id="division-name"
            value={name}
            maxLength={40}
            placeholder="Premier Division"
            invalid={submitted && Boolean(errors.name)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Description" htmlFor="division-description" hint="Optional. One short line shown to visitors." className="sm:col-span-2">
          <Input shape="square" id="division-description" value={description} maxLength={90} placeholder="The top flight" onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label="Playoff places" htmlFor="division-playoffs" hint="How many clubs go on to the knock-out rounds after the league.">
          <Select shape="square" id="division-playoffs" value={playoffSpots} onChange={(e) => setPlayoffSpots(e.target.value)}>
            <option value="0">No playoffs</option>
            <option value="2">Top 2 (straight final)</option>
            <option value="4">Top 4 (semi-finals and final)</option>
          </Select>
        </Field>
        <Field label="Match day" htmlFor="division-day" hint="The day of the week matches are played.">
          <Select shape="square" id="division-day" value={day} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((w, i) => (
              <option key={w} value={i}>
                {w}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Kick-off times"
            hint={`In West Africa Time (WAT). Matches on a match day are spread over these times. Up to ${MAX_SLOTS}.`}
            error={submitted ? errors.slots : undefined}
          >
            <ul className="flex flex-col gap-2">
              {slots.map((slot, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input shape="square"
                    type="time"
                    aria-label={`Kick-off time ${i + 1}`}
                    value={slot}
                    invalid={submitted && !/^\d{2}:\d{2}$/.test(slot)}
                    className="w-full max-w-48"
                    onChange={(e) => setSlot(i, e.target.value)}
                  />
                  <IconButton shape="square"
                    icon={TrashIcon}
                    variant="danger"
                    label={`Remove kick-off time ${i + 1}`}
                    disabled={slots.length <= 1}
                    onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
                  />
                </li>
              ))}
            </ul>
          </Field>
          <Button shape="square"
            variant="outline"
            size="sm"
            icon={PlusIcon}
            className="mt-2"
            disabled={slots.length >= MAX_SLOTS}
            onClick={() => setSlots((prev) => [...prev, '21:00'])}
          >
            Add a kick-off time
          </Button>
        </div>
      </form>
    </Modal>
  );
};
