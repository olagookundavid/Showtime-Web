import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, Field, Input, Modal } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaSeason } from '../../../types';
import { errorMessage } from '../../utils';
import { dateValue, invalidateArena } from './seasonHelpers';

interface SeasonFormModalProps {
  /** Leave out to create a season. */
  season?: ArenaSeason;
  /** The number to offer for a new season. */
  suggestedNumber?: number;
  onClose: () => void;
  onSaved?: (season: ArenaSeason) => void;
}

const FORM_ID = 'arena-season-form';

/** Create a season, or edit one's name and dates. Mount it when needed so it always starts fresh. */
export const SeasonFormModal = ({ season, suggestedNumber = 1, onClose, onSaved }: SeasonFormModalProps) => {
  const qc = useQueryClient();
  const editing = Boolean(season);
  const [number, setNumber] = useState(String(season?.number ?? suggestedNumber));
  const [name, setName] = useState(season?.name ?? `Season ${suggestedNumber}`);
  const [nameTouched, setNameTouched] = useState(editing);
  const [startsOn, setStartsOn] = useState(dateValue(season?.starts_on));
  const [endsOn, setEndsOn] = useState(dateValue(season?.ends_on));
  const [submitted, setSubmitted] = useState(false);

  const numberValue = Number(number);
  const errors = {
    number: !editing && (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 999) ? 'Use a whole number from 1 to 999.' : '',
    name: name.trim().length < 2 || name.trim().length > 60 ? 'Give the season a name of 2 to 60 characters.' : '',
    dates: startsOn && endsOn && endsOn < startsOn ? "The season can't end before it starts." : '',
  };
  const hasErrors = Boolean(errors.number || errors.name || errors.dates);

  const save = useMutation({
    mutationFn: () => {
      const body = { number: numberValue, name: name.trim(), starts_on: startsOn, ends_on: endsOn };
      return season ? arenaApi.updateSeason(season.id, body) : arenaApi.createSeason(body);
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Season updated.' : `${saved.name} created.`);
      invalidateArena(qc);
      onSaved?.(saved);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onNumberChange = (value: string) => {
    setNumber(value);
    if (!nameTouched) setName(`Season ${value}`);
  };

  return (
    <Modal
      open
      onClose={save.isPending ? undefined : onClose}
      title={editing ? 'Edit season' : 'New season'}
      subtitle={editing ? season?.name : 'A season holds your divisions, clubs and fixtures'}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>
            {editing ? 'Save changes' : 'Create season'}
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
        <Field
          label="Season number"
          htmlFor="season-number"
          hint={editing ? "The number can't be changed once the season exists." : 'Seasons are numbered in order: 1, 2, 3...'}
          error={submitted ? errors.number : undefined}
        >
          <Input
            id="season-number"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={number}
            disabled={editing}
            invalid={submitted && Boolean(errors.number)}
            onChange={(e) => onNumberChange(e.target.value)}
          />
        </Field>
        <Field label="Season name" htmlFor="season-name" error={submitted ? errors.name : undefined}>
          <Input
            id="season-name"
            value={name}
            maxLength={60}
            placeholder="Season 1"
            invalid={submitted && Boolean(errors.name)}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
          />
        </Field>
        <Field label="Start date" htmlFor="season-start" hint="Optional. Fixtures begin on or after this date.">
          <Input id="season-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </Field>
        <Field label="End date" htmlFor="season-end" hint="Optional." error={submitted ? errors.dates : undefined}>
          <Input id="season-end" type="date" value={endsOn} min={startsOn || undefined} invalid={submitted && Boolean(errors.dates)} onChange={(e) => setEndsOn(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
};
