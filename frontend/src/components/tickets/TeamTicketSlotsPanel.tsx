import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUturnLeftIcon, NoSymbolIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
    Button,
    ConfirmDialog,
    ConfirmSummary,
    DataTable,
    Field,
    Input,
    RowActions,
    Select,
    Spinner,
    type Column,
    type RowAction,
} from '../ui';
import { addMyExtraTicket, getPlayers, restoreMyTicket, revokeMyTicket } from '../../services/api';
import type { PlayerTicketRow, PlayerTicketSheet, TeamTicketRole } from '../../types';
import { getApiErrorMessage, playerTicketFixture, playerTicketHolders, playerTicketRoleLabel } from '../../utils';

interface TeamTicketSlotsPanelProps {
    sheet: PlayerTicketSheet;
    teamId?: string;
    /** Called with the sheet as it is after a change. */
    onChange: (sheet: PlayerTicketSheet) => void;
}

const OTHER = '__other';

type Pending =
    | { kind: 'extra'; who: string; email: string; playerId?: string }
    | { kind: 'revoke'; row: PlayerTicketRow }
    | { kind: 'restore'; row: PlayerTicketRow };

const ROLE_STYLE: Record<TeamTicketRole, string> = {
    PLAYER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    EXTRA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

/**
 * The "Extra Tickets" tab: how many of the team's tickets for a match are used,
 * who holds them, and a way to give the spare ones to reserves or anyone else.
 * Taking a ticket back frees its slot.
 */
export const TeamTicketSlotsPanel = ({ sheet, teamId, onChange }: TeamTicketSlotsPanelProps) => {
    const matchId = sheet.match.id;
    const [choice, setChoice] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pending, setPending] = useState<Pending | null>(null);
    const [busy, setBusy] = useState(false);

    const { data: roster, isLoading: loadingRoster } = useQuery({
        queryKey: ['teamRoster', teamId, 'all'],
        queryFn: () => getPlayers(teamId, 1, 100, undefined, 'all'),
        enabled: !!teamId,
    });

    const holders = useMemo(() => playerTicketHolders(sheet), [sheet]);

    // Reserves are the roster players without a slot: not on the sheet and not holding an extra.
    const reserves = useMemo(() => {
        const taken = new Set(holders.map((h) => h.player_id).filter(Boolean));
        return (roster?.data ?? []).filter((p) => !taken.has(p.id) && (p.status ?? 'active') === 'active');
    }, [roster, holders]);

    const canGive = sheet.can_issue && sheet.slots_left > 0;
    const ready = choice === OTHER ? name.trim().length > 0 : choice !== '';

    const askToGive = () => {
        if (choice === OTHER) {
            setPending({ kind: 'extra', who: name.trim(), email: email.trim() });
            return;
        }
        const p = reserves.find((r) => r.id === choice);
        if (!p) return;
        setPending({ kind: 'extra', who: p.name, email: p.email || '', playerId: p.id });
    };

    const run = async () => {
        if (!pending) return;
        setBusy(true);
        try {
            let next: PlayerTicketSheet;
            if (pending.kind === 'extra') {
                next = await addMyExtraTicket(
                    matchId,
                    pending.playerId ? { player_id: pending.playerId } : { name: pending.who, email: pending.email || undefined },
                    teamId,
                );
                setChoice('');
                setName('');
                setEmail('');
                toast.success(`Ticket given to ${pending.who}.`);
            } else if (pending.kind === 'revoke') {
                next = await revokeMyTicket(matchId, pending.row.ticket_id as string, teamId);
                toast.success(`${pending.row.name}'s ticket was taken back. That slot is free.`);
            } else {
                next = await restoreMyTicket(
                    matchId,
                    pending.row.role === 'MANAGER' ? { user_id: pending.row.user_id } : { player_id: pending.row.player_id },
                    teamId,
                );
                toast.success(`${pending.row.name} has a ticket again.`);
            }
            onChange(next);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'That did not work.'));
        } finally {
            setBusy(false);
            setPending(null);
        }
    };

    const columns = useMemo<Column<PlayerTicketRow>[]>(
        () => [
            {
                header: 'Name',
                accessor: 'name',
                sortable: true,
                cell: (p) => (
                    <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {p.jersey_number ? <span className="text-gray-500 dark:text-gray-400 mr-1.5">#{p.jersey_number}</span> : null}
                            {p.name}
                        </div>
                        <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${ROLE_STYLE[p.role]}`}>
                            {playerTicketRoleLabel(p)}
                        </span>
                    </div>
                ),
            },
            {
                header: 'Ticket code',
                accessor: 'ticket_code',
                cell: (p) =>
                    p.revoked ? (
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Revoked</span>
                    ) : p.ticket_code ? (
                        <span className="font-mono font-bold tracking-wider text-sffl-navy dark:text-white whitespace-nowrap">{p.ticket_code}</span>
                    ) : (
                        <span className="text-gray-400">—</span>
                    ),
            },
            {
                header: 'Actions',
                align: 'right',
                cell: (p) => {
                    const actions: RowAction[] = p.revoked
                        ? [
                              {
                                  label: 'Give ticket back',
                                  icon: ArrowUturnLeftIcon,
                                  disabled: !sheet.can_issue,
                                  hint: sheet.can_issue ? undefined : 'This match day has passed.',
                                  onSelect: () => setPending({ kind: 'restore', row: p }),
                              },
                          ]
                        : p.ticket_id
                          ? [
                                {
                                    label: 'Take ticket back',
                                    icon: NoSymbolIcon,
                                    danger: true,
                                    disabled: !!p.checked_in_at,
                                    hint: p.checked_in_at ? 'Already used at the gate.' : 'Frees the slot for someone else.',
                                    onSelect: () => setPending({ kind: 'revoke', row: p }),
                                },
                            ]
                          : [{ label: 'No ticket', icon: NoSymbolIcon, disabled: true, hint: 'Save the team sheet or use Issue missing codes.' }];
                    return <RowActions label={`Actions for ${p.name}`} actions={actions} />;
                },
            },
        ],
        [sheet.can_issue],
    );

    const usedPct = Math.min(100, Math.round((sheet.slots_used / sheet.slots_total) * 100));

    return (
        <div className="space-y-6">
            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your tickets for this match</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {sheet.team_name} have {sheet.slots_total} tickets. Players on the team sheet and managers get one automatically. Give the rest to
                            reserves or anyone else, or leave them. You do not have to use them all.
                        </p>
                    </div>
                    <p className="text-right">
                        <span className={`text-3xl font-black ${sheet.slots_left === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {sheet.slots_left}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400"> left of {sheet.slots_total}</span>
                    </p>
                </div>
                <div
                    className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={sheet.slots_used}
                    aria-valuemin={0}
                    aria-valuemax={sheet.slots_total}
                    aria-label="Tickets used"
                >
                    <div className="h-full bg-sffl-red" style={{ width: `${usedPct}%` }} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {sheet.slots_used} used: {sheet.players?.filter((p) => p.ticket_code).length ?? 0} on the sheet,{' '}
                    {sheet.others?.filter((p) => p.role === 'MANAGER' && p.ticket_code).length ?? 0} managers,{' '}
                    {sheet.others?.filter((p) => p.role === 'EXTRA').length ?? 0} extra.
                </p>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4 sm:p-5 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Give an extra ticket</h2>
                {!sheet.can_issue ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400">This match day has passed, so no more tickets can be given.</p>
                ) : sheet.slots_left === 0 ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400">All {sheet.slots_total} tickets are used. Take one back below to free a slot.</p>
                ) : (
                    <>
                        <Field label="Who is it for?" htmlFor="extra-ticket-who">
                            {loadingRoster ? (
                                <Spinner label="Loading your players" className="py-2" />
                            ) : (
                                <Select id="extra-ticket-who" value={choice} onChange={(e) => setChoice(e.target.value)} className="w-full sm:max-w-md">
                                    <option value="">Choose a reserve player or someone else</option>
                                    {reserves.length > 0 && (
                                        <optgroup label="Players without a ticket">
                                            {reserves.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                    {p.position && p.position !== '-' ? ` (${p.position})` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <option value={OTHER}>Someone else (another manager, a guest)</option>
                                </Select>
                            )}
                        </Field>
                        {choice === OTHER && (
                            <div className="grid sm:grid-cols-2 gap-4 sm:max-w-2xl">
                                <Field label="Name" htmlFor="extra-ticket-name" hint="The gate sees this name when the code is scanned.">
                                    <Input id="extra-ticket-name" value={name} onChange={(e) => setName(e.target.value)} />
                                </Field>
                                <Field label="Email (optional)" htmlFor="extra-ticket-email" hint="Leave it blank and give them the code yourself.">
                                    <Input id="extra-ticket-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                </Field>
                            </div>
                        )}
                        <Button icon={PaperAirplaneIcon} disabled={!ready || !canGive} onClick={askToGive}>
                            Give Ticket
                        </Button>
                    </>
                )}
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Everyone with a ticket</h2>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-2 sm:p-3">
                    <DataTable
                        data={holders}
                        columns={columns}
                        getRowId={(p) => p.ticket_id ?? p.player_id ?? p.user_id ?? p.name}
                        paginated={false}
                        searchable={false}
                        compact
                        emptyMessage="Nobody has a ticket for this match yet."
                    />
                </div>
            </section>

            <ConfirmDialog
                open={pending !== null}
                title={
                    pending?.kind === 'revoke'
                        ? `Take ${pending.row.name}'s ticket back?`
                        : pending?.kind === 'restore'
                          ? `Give ${pending.row.name} a ticket again?`
                          : `Give ${pending?.who ?? 'them'} a ticket?`
                }
                description={
                    pending?.kind === 'revoke'
                        ? 'Their code stops working and the slot is free for someone else. A ticket already used at the gate cannot be taken back.'
                        : (pending?.kind === 'extra' && pending.email) || (pending?.kind === 'restore' && pending.row.has_email)
                          ? 'It is emailed to them straight away and uses one of your tickets.'
                          : 'They have no email, so give them the code yourself. It uses one of your tickets.'
                }
                body={
                    pending && (
                        <ConfirmSummary
                            rows={[
                                ['Match', playerTicketFixture(sheet)],
                                ['Who', pending.kind === 'extra' ? pending.who : pending.row.name],
                                ...(pending.kind === 'extra' && pending.email ? ([['Email', pending.email]] as [string, string][]) : []),
                            ]}
                        />
                    )
                }
                confirmLabel={pending?.kind === 'revoke' ? 'Take Back' : pending?.kind === 'restore' ? 'Give Ticket Back' : 'Give Ticket'}
                tone={pending?.kind === 'revoke' ? 'warning' : 'info'}
                icon={pending?.kind === 'revoke' ? NoSymbolIcon : PaperAirplaneIcon}
                pending={busy}
                onConfirm={run}
                onCancel={() => setPending(null)}
            />
        </div>
    );
};
