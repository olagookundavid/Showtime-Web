import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, Field, ImageUploadField, Input, Modal, Select } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaClubInput } from '../../../types';
import { useArenaScope } from '../../scope';
import { errorMessage } from '../../utils';

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#4e7050';

interface ClubFormModalProps {
  /** The club being edited. Leave out to register a new one. */
  club?: ArenaClub;
  onClose: () => void;
}

/**
 * Register a club, or edit one. Mount it only while it should be open, so the
 * fields start fresh each time. The division and manager are chosen at
 * registration only; later they change on the club's own page.
 */
export const ClubFormModal = ({ club, onClose }: ClubFormModalProps) => {
  const { divisions } = useArenaScope();
  const qc = useQueryClient();
  const editing = !!club;

  const [name, setName] = useState(club?.name ?? '');
  const [short, setShort] = useState(club?.short ?? '');
  const [color, setColor] = useState(club?.color ?? DEFAULT_COLOR);
  const [crest, setCrest] = useState(club?.crest_url ?? '');
  const [founded, setFounded] = useState(club?.founded_year ? String(club.founded_year) : '');
  const [divisionId, setDivisionId] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: ArenaClubInput) => (club ? arenaApi.updateClub(club.id, body) : arenaApi.createClub(body)),
    onSuccess: (result) => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(editing ? `${result.name} updated.` : `${result.name} registered.`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const trimmedName = name.trim();
  const errors = {
    name: trimmedName.length < 2 || trimmedName.length > 45 ? 'Give the club a name of 2 to 45 characters.' : '',
    short: short.length < 2 ? 'Use 2 or 3 letters or numbers, like "LFC".' : '',
    color: HEX.test(color) ? '' : 'Use a colour like #4e7050.',
    founded: founded && (!/^\d{4}$/.test(founded) || Number(founded) < 1990 || Number(founded) > new Date().getFullYear() + 1) ? 'Enter a year from 1990 to next year.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    const body: ArenaClubInput = {
      name: trimmedName,
      short,
      color: color.toLowerCase(),
      crest_url: crest,
      founded_year: founded ? Number(founded) : null,
    };
    if (!editing) {
      if (divisionId) body.division_id = divisionId;
      if (managerEmail.trim()) body.manager_email = managerEmail.trim();
    }
    mutation.mutate(body);
  };

  const show = (key: keyof typeof errors) => (submitted ? errors[key] : '');

  return (
    <Modal shape="square"
      open
      onClose={mutation.isPending ? undefined : onClose}
      title={editing ? `Edit ${club.name}` : 'Register a club'}
      subtitle={editing ? 'Change how the club appears across Arena.' : 'Add a club to the tournament. You can put it in a division and give it a manager now or later.'}
      maxWidth="lg"
      footer={
        <>
          <Button shape="square" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button shape="square" type="submit" form="arena-club-form" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Register club'}
          </Button>
        </>
      }
    >
      <form id="arena-club-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Club name" htmlFor="club-name" error={show('name')}>
          <Input shape="square" id="club-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={45} autoComplete="off" invalid={!!show('name')} placeholder="e.g. Lagos Lions" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Abbreviation" htmlFor="club-short" hint="2 or 3 letters or numbers, shown on tables and badges." error={show('short')}>
            <Input shape="square"
              id="club-short"
              value={short}
              onChange={(e) => setShort(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
              maxLength={3}
              autoComplete="off"
              invalid={!!show('short')}
              placeholder="LLN"
            />
          </Field>
          <Field label="Founded (optional)" htmlFor="club-founded" error={show('founded')}>
            <Input shape="square"
              id="club-founded"
              inputMode="numeric"
              value={founded}
              onChange={(e) => setFounded(e.target.value.replace(/\D/g, '').slice(0, 4))}
              invalid={!!show('founded')}
              placeholder="e.g. 2024"
            />
          </Field>
        </div>

        <Field label="Club colour" htmlFor="club-color-hex" hint="Used for the badge when there is no crest." error={show('color')}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick the club colour"
              value={HEX.test(color) ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 shrink-0 cursor-pointer border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800"
            />
            <Input shape="square"
              id="club-color-hex"
              value={color}
              onChange={(e) => setColor(e.target.value.startsWith('#') || !e.target.value ? e.target.value : `#${e.target.value}`)}
              maxLength={7}
              autoComplete="off"
              invalid={!!show('color')}
              className="w-full sm:w-40"
            />
          </div>
        </Field>

        <ImageUploadField
          label="Crest (optional)"
          value={crest}
          onChange={setCrest}
          folder="teams"
          isCommitted={saved}
          helperText="A square image works best. Without one, the abbreviation is shown on the club colour."
        />

        {!editing && (
          <>
            <Field label="Division (optional)" htmlFor="club-division" hint="You can also place clubs from the season's page. A division that already has fixtures can't take new clubs.">
              <Select shape="square" id="club-division" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
                <option value="">Not in a division yet</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Manager's email (optional)" htmlFor="club-manager" hint="The manager picks the team and makes offers. They must already have an Arena account.">
              <Input shape="square" id="club-manager" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} autoComplete="off" placeholder="manager@example.com" />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
};
