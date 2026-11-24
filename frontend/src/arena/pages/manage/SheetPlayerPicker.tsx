import { useMemo } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { Button, Modal } from '../../../components';
import type { ArenaPlayer } from '../../../types';
import { PlayerFace } from '../../components';
import { fitsSlot, type SheetDraft } from './SheetLogic';

interface SheetPlayerPickerProps {
  slot: number;
  /** Every slot's position in the chosen formation, e.g. ["ST", "LW", ...]. */
  slotPositions: string[];
  draft: SheetDraft;
  roster: ArenaPlayer[];
  onPick: (playerId: string) => void;
  onClose: () => void;
}

/** Who can fill one slot: goalkeepers for GK, outfielders for everywhere else. Picking a player who already starts swaps them. */
export const SheetPlayerPicker = ({ slot, slotPositions, draft, roster, onPick, onClose }: SheetPlayerPickerProps) => {
  const position = slotPositions[slot];
  const current = draft.starters[slot];

  const options = useMemo(
    () =>
      roster
        .filter((p) => fitsSlot(position, p))
        .sort((a, b) => Number(b.primary_position === position) - Number(a.primary_position === position) || (a.shirt_number ?? 99) - (b.shirt_number ?? 99)),
    [roster, position],
  );

  const where = (p: ArenaPlayer): string => {
    if (p.id === current) return 'Picked for this slot';
    const at = draft.starters.indexOf(p.id);
    if (at >= 0) return `Starting at ${slotPositions[at]}, will swap places`;
    if (draft.bench.includes(p.id)) return 'On the bench';
    return '';
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Choose your ${position}`}
      subtitle={position === 'GK' ? 'Only goalkeepers can play in goal.' : 'Goalkeepers can only play in goal, so they are not listed.'}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {current && (
            <Button variant="outline" onClick={() => onPick('')}>
              Leave this slot empty
            </Button>
          )}
        </>
      }
    >
      {options.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {position === 'GK' ? 'You have no goalkeeper in your squad. Sign one in Transfers to fill this slot.' : 'You have no outfield players in your squad.'}
        </p>
      ) : (
        <ul className="-mx-1 divide-y divide-gray-100 dark:divide-white/10">
          {options.map((p) => {
            const note = where(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  aria-pressed={p.id === current}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-sffl-red dark:hover:bg-white/5 ${
                    p.id === current ? 'bg-gray-50 dark:bg-white/10' : ''
                  }`}
                >
                  <PlayerFace name={p.gamertag} src={p.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{p.gamertag}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {p.primary_position}
                      {p.shirt_number !== null && <> &middot; #{p.shirt_number}</>}
                      {note && <> &middot; {note}</>}
                    </span>
                  </span>
                  {p.id === current && <CheckIcon className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};
