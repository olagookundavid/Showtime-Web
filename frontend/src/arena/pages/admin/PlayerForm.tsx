import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button, ConfirmDialog, ConfirmSummary, Field, ImageUploadField, Input, Modal, Select } from '../../../components';
import { LinkIcon } from '@heroicons/react/24/outline';
import { arenaApi } from '../../../services';
import type { ArenaPlatform, ArenaPlayer, ArenaPlayerInput, ArenaSquadRole } from '../../../types';
import { PLATFORMS, POSITIONS, SQUAD_ROLES, errorMessage } from '../../utils';
import { emptyPlayerDetails, playerDetailsErrors, shirtError, shirtValue, useClubOptions, type PlayerDetailsState } from './PlayerFormHelpers';

interface ShirtAndRoleProps {
  shirt: string;
  onShirt: (v: string) => void;
  role: ArenaSquadRole;
  onRole: (v: ArenaSquadRole) => void;
  idPrefix: string;
  error?: string;
}

/** Shirt number and squad role, the two details of putting someone on a squad. */
export const ShirtAndRoleFields = ({ shirt, onShirt, role, onRole, idPrefix, error }: ShirtAndRoleProps) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <Field label="Shirt number (optional)" htmlFor={`${idPrefix}-shirt`} hint="Leave empty to give the first free number." error={error}>
      <Input
        id={`${idPrefix}-shirt`}
        inputMode="numeric"
        value={shirt}
        onChange={(e) => onShirt(e.target.value.replace(/\D/g, '').slice(0, 2))}
        invalid={!!error}
        placeholder="e.g. 9"
      />
    </Field>
    <Field label="Squad role" htmlFor={`${idPrefix}-role`}>
      <Select id={`${idPrefix}-role`} value={role} onChange={(e) => onRole(e.target.value as ArenaSquadRole)}>
        {SQUAD_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
    </Field>
  </div>
);

interface PlayerDetailsFieldsProps {
  value: PlayerDetailsState;
  onChange: (v: PlayerDetailsState) => void;
  idPrefix: string;
  showErrors: boolean;
}

/** Gamertag, EA ID, platform and position: what every player has. */
export const PlayerDetailsFields = ({ value, onChange, idPrefix, showErrors }: PlayerDetailsFieldsProps) => {
  const errors = playerDetailsErrors(value);
  return (
    <>
      <Field label="Gamertag" htmlFor={`${idPrefix}-tag`} hint="The name they play under in EA FC." error={showErrors ? errors.gamertag : ''}>
        <Input
          id={`${idPrefix}-tag`}
          value={value.gamertag}
          onChange={(e) => onChange({ ...value, gamertag: e.target.value })}
          maxLength={32}
          autoComplete="off"
          invalid={showErrors && !!errors.gamertag}
        />
      </Field>
      <Field label="EA ID (optional)" htmlFor={`${idPrefix}-ea`} hint="Their EA account ID, if you have it.">
        <Input id={`${idPrefix}-ea`} value={value.eaId} onChange={(e) => onChange({ ...value, eaId: e.target.value })} maxLength={40} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Platform" htmlFor={`${idPrefix}-platform`}>
          <Select id={`${idPrefix}-platform`} value={value.platform} onChange={(e) => onChange({ ...value, platform: e.target.value as ArenaPlatform })}>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Main position" htmlFor={`${idPrefix}-position`} error={showErrors ? errors.position : ''}>
          <Select
            id={`${idPrefix}-position`}
            value={value.position}
            onChange={(e) => onChange({ ...value, position: e.target.value })}
            invalid={showErrors && !!errors.position}
          >
            <option value="">Choose a position</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
};

interface PlayerFormModalProps {
  /** The player being edited. Leave out to add a new one. */
  player?: ArenaPlayer;
  onClose: () => void;
}

/** Add a player (optionally linked to an account and on a club), or edit one's details. Mount only while open. */
export const PlayerFormModal = ({ player, onClose }: PlayerFormModalProps) => {
  const qc = useQueryClient();
  const clubs = useClubOptions();
  const editing = !!player;

  const [details, setDetails] = useState(() => emptyPlayerDetails(player));
  const [photo, setPhoto] = useState(player?.avatar_url ?? '');
  const [email, setEmail] = useState('');
  const [clubId, setClubId] = useState('');
  const [shirt, setShirt] = useState('');
  const [role, setRole] = useState<ArenaSquadRole>('first_team');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: ArenaPlayerInput) => (player ? arenaApi.updatePlayer(player.id, body) : arenaApi.createPlayer(body)),
    onSuccess: (result) => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(editing ? `${result.gamertag} updated.` : `${result.gamertag} added.`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const sError = clubId ? shirtError(shirt) : '';
  const invalid = Object.values(playerDetailsErrors(details)).some(Boolean) || !!sError;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    const body: ArenaPlayerInput = {
      gamertag: details.gamertag.trim(),
      ea_id: details.eaId.trim(),
      platform: details.platform,
      primary_position: details.position,
      // The server replaces the picture with whatever is sent, so always send it.
      avatar_url: photo,
    };
    if (!editing) {
      if (email.trim()) body.user_email = email.trim();
      if (clubId) {
        body.club_id = clubId;
        body.squad_role = role;
        const n = shirtValue(shirt);
        if (n) body.shirt_number = n;
      }
    }
    mutation.mutate(body);
  };

  return (
    <Modal
      open
      onClose={mutation.isPending ? undefined : onClose}
      title={editing ? `Edit ${player.gamertag}` : 'Add a player'}
      subtitle={editing ? 'Change the player’s details. To move them between clubs, use Register or Release in the actions menu.' : 'Create a player. They can join a club now or stay a free agent until a manager signs them.'}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="arena-player-form" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Add player'}
          </Button>
        </>
      }
    >
      <form id="arena-player-form" onSubmit={submit} noValidate className="space-y-4">
        <PlayerDetailsFields value={details} onChange={setDetails} idPrefix="player" showErrors={submitted} />

        <ImageUploadField label="Photo (optional)" value={photo} onChange={setPhoto} folder="players" isCommitted={saved} />

        {!editing && (
          <>
            <Field label="Account email (optional)" htmlFor="player-email" hint="Links this player to their Arena login so they can sign contracts. They must already have an account.">
              <Input id="player-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="player@example.com" />
            </Field>
            <Field label="Club (optional)" htmlFor="player-club" hint="Leave empty to add them as a free agent.">
              <Select id="player-club" value={clubId} onChange={(e) => setClubId(e.target.value)}>
                <option value="">Free agent (no club)</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {clubId && <ShirtAndRoleFields idPrefix="player" shirt={shirt} onShirt={setShirt} role={role} onRole={setRole} error={submitted ? sError : ''} />}
          </>
        )}
      </form>
    </Modal>
  );
};

/** Put a free agent on a club's squad. Mount only while open. */
export const PlayerRegisterModal = ({ player, onClose }: { player: ArenaPlayer; onClose: () => void }) => {
  const qc = useQueryClient();
  const clubs = useClubOptions();
  const [clubId, setClubId] = useState('');
  const [shirt, setShirt] = useState('');
  const [role, setRole] = useState<ArenaSquadRole>('first_team');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => arenaApi.registerPlayer(player.id, { club_id: clubId, shirt_number: shirtValue(shirt), squad_role: role }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`${result.gamertag} registered to ${result.club_name ?? 'the club'}.`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const sError = shirtError(shirt);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!clubId || sError) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={mutation.isPending ? undefined : onClose}
      title={`Register ${player.gamertag}`}
      subtitle="Put this free agent on a club's squad without a contract."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="arena-register-form" loading={mutation.isPending}>
            Register to club
          </Button>
        </>
      }
    >
      <form id="arena-register-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Club" htmlFor="register-club" error={submitted && !clubId ? 'Choose a club.' : ''}>
          <Select id="register-club" value={clubId} onChange={(e) => setClubId(e.target.value)} invalid={submitted && !clubId}>
            <option value="">Choose a club</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <ShirtAndRoleFields idPrefix="register" shirt={shirt} onShirt={setShirt} role={role} onRole={setRole} error={submitted ? sError : ''} />
      </form>
    </Modal>
  );
};

/** Connect a player to an Arena account by email. Asks for confirmation before linking. Mount only while open. */
export const PlayerLinkModal = ({ player, onClose }: { player: ArenaPlayer; onClose: () => void }) => {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => arenaApi.linkPlayer(player.id, email.trim()),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`${result.gamertag} is now linked to ${email.trim()}.`);
      onClose();
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(errorMessage(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!email.trim()) return;
    setConfirming(true);
  };

  return (
    <>
      <Modal
        open
        onClose={mutation.isPending ? undefined : onClose}
        title={`Link ${player.gamertag} to an account`}
        subtitle="The person who owns the account will then see this player as theirs, and can sign contracts for them."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="arena-link-form" icon={LinkIcon}>
              Link account
            </Button>
          </>
        }
      >
        <form id="arena-link-form" onSubmit={submit} noValidate>
          <Field
            label="Account email"
            htmlFor="link-email"
            hint="They must already have signed up to Arena with this email."
            error={submitted && !email.trim() ? 'Enter the account email.' : ''}
          >
            <Input id="link-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" invalid={submitted && !email.trim()} placeholder="player@example.com" />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirming}
        title="Link this player to the account?"
        description="Make sure the email belongs to this player. Whoever owns it will control the player's contracts."
        confirmLabel="Link account"
        tone="warning"
        icon={LinkIcon}
        pending={mutation.isPending}
        body={<ConfirmSummary rows={[['Player', player.gamertag], ['Account email', email.trim()]]} />}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
