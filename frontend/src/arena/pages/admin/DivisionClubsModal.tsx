import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Button, ButtonLink, Checkbox, Input, Modal, Spinner } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaDivision } from '../../../types';
import { Crest, EmptyState } from '../../components';
import { errorMessage } from '../../utils';
import { invalidateArena, seasonKeys } from './seasonHelpers';

const NO_CLUBS: ArenaClub[] = [];

interface DivisionClubsModalProps {
  division: ArenaDivision;
  /** Every division of the season, to show where each club already plays. */
  divisions: ArenaDivision[];
  onClose: () => void;
}

/** Tick the clubs that play in a division. A club can only be in one division per season. */
export const DivisionClubsModal = ({ division, divisions, onClose }: DivisionClubsModalProps) => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(division.club_ids));
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({ queryKey: seasonKeys.clubs, queryFn: () => arenaApi.adminClubs() });
  const clubs = data ?? NO_CLUBS;

  // Where each club plays this season, from the season's own divisions.
  const otherDivision = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of divisions) {
      if (d.id === division.id) continue;
      for (const id of d.club_ids) map.set(id, d.name);
    }
    return map;
  }, [divisions, division.id]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clubs
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.short.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clubs, search]);

  const changed = selected.size !== division.club_ids.length || division.club_ids.some((id) => !selected.has(id));

  const save = useMutation({
    mutationFn: () => arenaApi.setDivisionClubs(division.id, [...selected]),
    onSuccess: () => {
      toast.success(`Clubs in ${division.name} updated.`);
      invalidateArena(qc);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage clubs"
      subtitle={division.name}
      maxWidth="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!changed}>
            Save clubs
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Tick the clubs that play in {division.name}. A club that is already in another division moves here when you save.
      </p>

      {isLoading ? (
        <Spinner label="Loading clubs" />
      ) : error ? (
        <EmptyState icon={ShieldCheckIcon} title="Clubs could not be loaded" description={errorMessage(error, 'You may not have access to the Clubs section.')} />
      ) : clubs.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="No clubs registered yet"
          description="Register your clubs first, then come back to put them in this division."
          action={<ButtonLink to="/admin/clubs">Register clubs</ButtonLink>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              icon={MagnifyingGlassIcon}
              type="search"
              aria-label="Search clubs"
              placeholder="Search clubs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <p className="text-sm font-bold text-sffl-navy dark:text-white" aria-live="polite">
              {selected.size} {selected.size === 1 ? 'club' : 'clubs'} selected
            </p>
          </div>

          <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
            {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No club matches that search.</li>}
            {visible.map((c) => {
              const elsewhere = otherDivision.get(c.id);
              const on = selected.has(c.id);
              return (
                <li key={c.id} className="px-3 sm:px-4">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                    <Checkbox checked={on} onChange={(e) => toggle(c.id, e.target.checked)} aria-label={`Include ${c.name}`} />
                    <Crest club={c} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-sffl-navy dark:text-white">{c.name}</span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {elsewhere ? (on ? `Moves here from ${elsewhere}` : `Plays in ${elsewhere}`) : on ? c.short : `${c.short}, not in a division yet`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
};
