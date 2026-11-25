import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon, InformationCircleIcon, MagnifyingGlassIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Button, ConfirmDialog, ConfirmSummary, Field, Input, Modal, Select, Spinner, Textarea } from '../../../components';
import { useDebounced } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaPlayer, ArenaSquadRole } from '../../../types';
import { PlayerFace } from '../../components';
import { arenaKeys } from '../../hooks';
import { PLATFORMS, SQUAD_ROLES, errorMessage, formatDateOnly, formatNaira, squadRoleLabel } from '../../utils';
import { MANAGE_KEY, lagosToday, manageKeys } from './ContractShared';

const MAX_TERMS = 1500;
const MAX_FEE = 100_000_000;
const FORM_ID = 'offer-make-form';

interface OfferMakeModalProps {
  /** A player already chosen (from the free agents list). The manager can still change them. */
  preselected: ArenaPlayer | null;
  myClubId: string;
  /** Players this club already has an open offer to; a second offer would be refused. */
  blockedPlayerIds: ReadonlySet<string>;
  /** The last day a contract may run to, when the season has an end date. */
  seasonEnd: string | null;
  onClose: () => void;
}

const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

/** Why this player can't be offered a contract, or an empty string when they can. */
const playerProblem = (p: ArenaPlayer | null, myClubId: string, blocked: ReadonlySet<string>): string => {
  if (!p) return '';
  if (p.club_id === myClubId) return `${p.gamertag} is already in your squad.`;
  if (blocked.has(p.id)) return `You already have an open offer to ${p.gamertag}. Withdraw it first if you want to send a new one.`;
  return '';
};

/** The form for offering a contract: pick a player, set the terms, then confirm before it is sent. */
export const OfferMakeModal = ({ preselected, myClubId, blockedPlayerIds, seasonEnd, onClose }: OfferMakeModalProps) => {
  const qc = useQueryClient();
  const today = lagosToday();

  const [player, setPlayer] = useState<ArenaPlayer | null>(preselected);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ArenaSquadRole>('first_team');
  const [endDate, setEndDate] = useState(seasonEnd && seasonEnd >= today ? seasonEnd : '');
  const [fee, setFee] = useState('0');
  const [terms, setTerms] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const term = useDebounced(search.trim(), 300);
  const results = useQuery({
    queryKey: manageKeys.playerSearch(term),
    queryFn: () => arenaApi.searchPlayers(term),
    enabled: !player && term.length >= 2,
  });

  const send = useMutation({
    mutationFn: () =>
      arenaApi.makeOffer({
        player_id: player!.id,
        squad_role: role,
        end_date: endDate,
        fee_ngn: Number(fee),
        terms: terms.trim(),
      }),
    onSuccess: () => {
      toast.success(`Offer sent to ${player?.gamertag}.`);
      qc.invalidateQueries({ queryKey: MANAGE_KEY });
      qc.invalidateQueries({ queryKey: arenaKeys.me });
      onClose();
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(errorMessage(err));
    },
  });

  const feeNumber = Number(fee);
  const errors = {
    player: !player ? 'Choose the player you want to sign.' : playerProblem(player, myClubId, blockedPlayerIds),
    endDate: !endDate
      ? 'Choose when the contract ends.'
      : endDate < today
        ? 'The end date can\'t be in the past.'
        : seasonEnd && endDate > seasonEnd
          ? `The contract can't run past the end of the season (${formatDateOnly(seasonEnd)}).`
          : '',
    fee:
      fee.trim() === '' || !Number.isInteger(feeNumber) || feeNumber < 0 || feeNumber > MAX_FEE
        ? `Enter a whole number from 0 to ${formatNaira(MAX_FEE)}.`
        : '',
    terms: terms.trim() === '' ? 'Write the terms of the contract.' : terms.length > MAX_TERMS ? `Keep the terms under ${MAX_TERMS} characters.` : '',
  };
  const valid = !errors.player && !errors.endDate && !errors.fee && !errors.terms;
  const shown = (key: keyof typeof errors) => (tried ? errors[key] : '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (valid) setConfirming(true);
  };

  const atOtherClub = !!player && !!player.club_id && player.club_id !== myClubId;

  return (
    <>
      <Modal shape="square"
        open
        onClose={send.isPending ? undefined : onClose}
        title="Make an offer"
        subtitle="Offer a player a contract with your club."
        maxWidth="xl"
        footer={
          <>
            <Button shape="square" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button shape="square" type="submit" form={FORM_ID} icon={PaperAirplaneIcon}>
              Review offer
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={submit} className="space-y-5" noValidate>
          {player ? (
            <Field label="Player" error={shown('player')}>
              <div className="flex flex-wrap items-center gap-3 border border-gray-200 p-3 dark:border-gray-600">
                <PlayerFace name={player.gamertag} src={player.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-900 dark:text-white">{player.gamertag}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {player.primary_position} &middot; {platformLabel(player.platform)} &middot; {player.club_name || 'Free agent'}
                  </p>
                </div>
                <Button shape="square" variant="outline" size="sm" onClick={() => setPlayer(null)}>
                  Change player
                </Button>
              </div>
            </Field>
          ) : (
            <Field label="Player" htmlFor="offer-player-search" hint="Type at least 2 letters of their gamertag. You can search every registered player." error={shown('player')}>
              <Input shape="square"
                id="offer-player-search"
                icon={MagnifyingGlassIcon}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by gamertag"
                autoComplete="off"
                invalid={!!shown('player')}
              />
              {term.length >= 2 && (
                <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600" aria-label="Matching players">
                  {results.isFetching ? (
                    <Spinner size="sm" className="py-4" label="Searching" />
                  ) : results.isError ? (
                    <p className="p-3 text-sm text-red-600 dark:text-red-400">{errorMessage(results.error)}</p>
                  ) : (results.data ?? []).length === 0 ? (
                    <p className="p-3 text-sm text-gray-600 dark:text-gray-400">No player found with "{term}". Check the spelling of the gamertag.</p>
                  ) : (
                    (results.data ?? []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlayer(p)}
                        className="flex min-h-11 w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left outline-none last:border-b-0 hover:bg-gray-50 focus-visible:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 dark:focus-visible:bg-gray-700"
                      >
                        <PlayerFace name={p.gamertag} src={p.avatar_url} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{p.gamertag}</span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {p.primary_position} &middot; {p.club_name || 'Free agent'}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </Field>
          )}

          {player && !errors.player && (
            <p
              className={`flex items-start gap-2 p-3 text-sm ${
                atOtherClub ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200'
              }`}
            >
              {atOtherClub ? (
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {atOtherClub
                ? `${player.gamertag} is registered at ${player.club_name}. Their manager has to approve the release first. After that, ${player.gamertag} decides whether to sign.`
                : `${player.gamertag} is a free agent, so your offer goes straight to them to sign or turn down.`}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Squad role" htmlFor="offer-role" hint="Where they would sit in your squad.">
              <Select shape="square" id="offer-role" value={role} onChange={(e) => setRole(e.target.value as ArenaSquadRole)}>
                {SQUAD_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Contract ends"
              htmlFor="offer-end"
              hint={seasonEnd ? `Latest allowed: ${formatDateOnly(seasonEnd)} (end of the season).` : undefined}
              error={shown('endDate')}
            >
              <Input shape="square"
                id="offer-end"
                type="date"
                value={endDate}
                min={today}
                max={seasonEnd ?? undefined}
                onChange={(e) => setEndDate(e.target.value)}
                invalid={!!shown('endDate')}
              />
            </Field>
          </div>

          <Field label="Fee (₦)" htmlFor="offer-fee" hint="Recorded only, nothing is charged in this version." error={shown('fee')}>
            <Input shape="square"
              id="offer-fee"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_FEE}
              step={1}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              invalid={!!shown('fee')}
            />
          </Field>

          <Field
            label="Terms"
            htmlFor="offer-terms"
            hint={`${terms.length} / ${MAX_TERMS}. The player reads this before signing.`}
            error={shown('terms')}
          >
            <Textarea shape="square"
              id="offer-terms"
              value={terms}
              maxLength={MAX_TERMS}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="For example: starting midfielder, must attend every match day."
              invalid={!!shown('terms')}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title="Send this offer?"
        description={
          atOtherClub
            ? `${player?.club_name} has to release ${player?.gamertag} before they see it.`
            : `${player?.gamertag} will be emailed the offer and can sign or turn it down.`
        }
        body={
          <ConfirmSummary
            rows={[
              ['Player', player?.gamertag],
              ['Squad role', squadRoleLabel(role)],
              ['Contract ends', formatDateOnly(endDate)],
              ['Fee', `${formatNaira(feeNumber || 0)} (recorded only)`],
            ]}
          />
        }
        confirmLabel="Send offer"
        tone="info"
        icon={PaperAirplaneIcon}
        pending={send.isPending}
        onConfirm={() => send.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
