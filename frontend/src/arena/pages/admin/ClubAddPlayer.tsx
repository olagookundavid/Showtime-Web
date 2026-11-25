import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button, Field, Input, Modal, Spinner, Tabs } from '../../../components';
import { useDebounced } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaPlayer, ArenaPlayerInput, ArenaSquadRole } from '../../../types';
import { PLATFORMS, errorMessage } from '../../utils';
import { PlayerDetailsFields, ShirtAndRoleFields } from './PlayerForm';
import { emptyPlayerDetails, playerDetailsErrors, shirtError, shirtValue } from './PlayerFormHelpers';

const NO_PLAYERS: ArenaPlayer[] = [];
type Mode = 'existing' | 'new';

const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

/** Add someone to a club's squad: pick a free agent, or create a brand new player. Mount only while open. */
export const ClubAddPlayerModal = ({ club, onClose }: { club: ArenaClub; onClose: () => void }) => {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('existing');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [picked, setPicked] = useState<ArenaPlayer | null>(null);
  const [details, setDetails] = useState(() => emptyPlayerDetails());
  const [shirt, setShirt] = useState('');
  const [role, setRole] = useState<ArenaSquadRole>('first_team');
  const [submitted, setSubmitted] = useState(false);

  const free = useQuery({
    queryKey: ['arena', 'admin', 'free-agents', q],
    queryFn: () => arenaApi.adminPlayers({ free: true, q, limit: 30 }),
    enabled: mode === 'existing',
  });
  const candidates = free.data ?? NO_PLAYERS;

  const done = (gamertag: string) => {
    qc.invalidateQueries({ queryKey: ['arena'] });
    toast.success(`${gamertag} added to ${club.name}.`);
    onClose();
  };

  const register = useMutation({
    mutationFn: (p: ArenaPlayer) => arenaApi.registerPlayer(p.id, { club_id: club.id, shirt_number: shirtValue(shirt), squad_role: role }),
    onSuccess: (p) => done(p.gamertag),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const create = useMutation({
    mutationFn: (body: ArenaPlayerInput) => arenaApi.createPlayer(body),
    onSuccess: (p) => done(p.gamertag),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const busy = register.isPending || create.isPending;

  const sError = shirtError(shirt);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (sError) return;
    if (mode === 'existing') {
      if (picked) register.mutate(picked);
      return;
    }
    if (Object.values(playerDetailsErrors(details)).some(Boolean)) return;
    const body: ArenaPlayerInput = {
      gamertag: details.gamertag.trim(),
      ea_id: details.eaId.trim(),
      platform: details.platform,
      primary_position: details.position,
      club_id: club.id,
      squad_role: role,
    };
    const n = shirtValue(shirt);
    if (n) body.shirt_number = n;
    create.mutate(body);
  };

  return (
    <Modal shape="square"
      open
      onClose={busy ? undefined : onClose}
      title={`Add a player to ${club.name}`}
      subtitle="Pick a free agent who is not on any squad, or create a new player."
      maxWidth="lg"
      footer={
        <>
          <Button shape="square" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button shape="square" type="submit" form="arena-club-add-player" loading={busy} disabled={mode === 'existing' && !picked}>
            {mode === 'existing' ? 'Add to squad' : 'Create and add'}
          </Button>
        </>
      }
    >
      <Tabs
        aria-label="How to add a player"
        value={mode}
        onChange={setMode}
        className="mb-4"
        items={[
          { value: 'existing', label: 'Free agent' },
          { value: 'new', label: 'New player' },
        ]}
      />
      <form id="arena-club-add-player" onSubmit={submit} noValidate className="space-y-4">
        {mode === 'existing' ? (
          <>
            <Field label="Find a free agent" htmlFor="add-search" hint="Search by gamertag or EA ID.">
              <Input shape="square" id="add-search" icon={MagnifyingGlassIcon} value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" placeholder="Start typing a gamertag" />
            </Field>

            <div role="group" aria-label="Free agents" className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {free.isLoading ? (
                <div className="flex justify-center p-6">
                  <Spinner />
                </div>
              ) : candidates.length === 0 ? (
                <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
                  {q ? 'No free agent matches that search.' : 'There are no free agents right now.'} Use the New player tab to create one.
                </p>
              ) : (
                candidates.map((p) => {
                  const on = picked?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(on ? null : p)}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 dark:border-gray-700 ${
                        on ? 'bg-sffl-red/10 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{p.gamertag}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {p.primary_position} &middot; {platformLabel(p.platform)}
                        </span>
                      </span>
                      {on && <CheckCircleIcon className="h-5 w-5 shrink-0 text-sffl-red" aria-label="Selected" />}
                    </button>
                  );
                })
              )}
            </div>
            {submitted && !picked && <p className="text-xs font-semibold text-red-600 dark:text-red-400">Choose a player from the list.</p>}
          </>
        ) : (
          <PlayerDetailsFields value={details} onChange={setDetails} idPrefix="new" showErrors={submitted} />
        )}

        <ShirtAndRoleFields idPrefix="club-add" shirt={shirt} onShirt={setShirt} role={role} onRole={setRole} error={submitted ? sError : ''} />
      </form>
    </Modal>
  );
};
