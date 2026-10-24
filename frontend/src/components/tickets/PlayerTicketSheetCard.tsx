import { useMemo } from 'react';
import {
    ArrowDownTrayIcon,
    CheckCircleIcon,
    EnvelopeIcon,
    ExclamationTriangleIcon,
    PrinterIcon,
    TicketIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Button, DataTable, type Column } from '../ui';
import type { PlayerTicketRow, PlayerTicketSheet } from '../../types';
import {
    downloadPlayerTicketCsv,
    playerTicketFileName,
    playerTicketFixture,
    playerTicketHolders,
    playerTicketRoleLabel,
    playerTicketWhen,
    printPlayerTicketSheets,
} from '../../utils';

interface PlayerTicketSheetCardProps {
    sheet: PlayerTicketSheet;
    /** Asks to issue codes to players still without one. Left out, the button is not shown. */
    onIssue?: (sheet: PlayerTicketSheet) => void;
    issuing?: boolean;
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

/**
 * One team's sheet for one match with every player's ticket code, and the
 * buttons to print it, export it, or issue any codes still missing.
 */
export const PlayerTicketSheetCard = ({ sheet, onIssue, issuing }: PlayerTicketSheetCardProps) => {
    const rows = playerTicketHolders(sheet);
    const missing = sheet.missing;
    const title = `${sheet.team_name}: ${playerTicketFixture(sheet)}`;
    const fileName = playerTicketFileName(sheet.match.date, sheet.team_name, 'player tickets');

    const columns = useMemo<Column<PlayerTicketRow>[]>(
        () => [
            {
                header: 'Player',
                accessor: 'name',
                sortable: true,
                cell: (p) => (
                    <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {p.jersey_number ? <span className="text-gray-500 dark:text-gray-400 mr-1.5">#{p.jersey_number}</span> : null}
                            {p.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {[p.role === 'PLAYER' && p.position && p.position !== '-' ? p.position : null, playerTicketRoleLabel(p)]
                                .filter(Boolean)
                                .join(' · ')}
                        </div>
                    </div>
                ),
            },
            {
                header: 'Ticket code',
                accessor: 'ticket_code',
                cell: (p) =>
                    p.ticket_code ? (
                        <span className="font-mono font-bold tracking-wider text-sffl-navy dark:text-white whitespace-nowrap">
                            {p.ticket_code}
                        </span>
                    ) : (
                        <span className="text-gray-400">—</span>
                    ),
            },
            {
                header: 'Email',
                accessor: 'has_email',
                cell: (p) =>
                    p.revoked ? (
                        <span className="text-gray-400">—</span>
                    ) : p.has_email ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                            <EnvelopeIcon className="w-4 h-4" aria-hidden="true" />
                            {p.ticket_code ? 'Emailed' : 'Will be emailed'}
                        </span>
                    ) : (
                        <span className="text-sm text-amber-700 dark:text-amber-400">No email, give them the code</span>
                    ),
            },
            {
                header: 'Gate',
                accessor: 'checked_in_at',
                sortable: true,
                sortValue: (p) => p.checked_in_at ?? '',
                cell: (p) =>
                    p.checked_in_at ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                            <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                            In at {formatTime(p.checked_in_at)}
                        </span>
                    ) : p.revoked ? (
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Ticket revoked</span>
                    ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">{p.ticket_code ? 'Not yet in' : 'No code yet'}</span>
                    ),
            },
        ],
        [],
    );

    const print = () => {
        if (!printPlayerTicketSheets([sheet], title)) {
            toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
        }
    };

    return (
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-gray-100 dark:border-gray-700">
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white wrap-break-word">
                        {sheet.team_name} <span className="font-normal text-gray-500 dark:text-gray-400">vs {sheet.opponent || 'TBD'}</span>
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 wrap-break-word">
                        {[sheet.match.competition, playerTicketWhen(sheet)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {sheet.slots_used} of {sheet.slots_total} tickets used · {sheet.checked_in} checked in
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    {onIssue && sheet.can_issue && missing > 0 && (
                        <Button icon={TicketIcon} loading={issuing} onClick={() => onIssue(sheet)}>
                            Issue {missing} missing {missing === 1 ? 'code' : 'codes'}
                        </Button>
                    )}
                    <Button variant="secondary" icon={PrinterIcon} onClick={print} disabled={rows.length === 0}>
                        Print
                    </Button>
                    <Button
                        variant="secondary"
                        icon={ArrowDownTrayIcon}
                        onClick={() => downloadPlayerTicketCsv([sheet], fileName)}
                        disabled={rows.length === 0}
                    >
                        Export CSV
                    </Button>
                </div>
            </div>

            {missing > 0 && !sheet.can_issue && (
                <p className="mx-4 sm:mx-5 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                    This match day has passed, so no new codes are issued for it.
                </p>
            )}

            <div className="p-2 sm:p-3">
                <DataTable
                    data={rows}
                    columns={columns}
                    getRowId={(p) => p.ticket_id ?? p.player_id ?? p.user_id ?? p.name}
                    paginated={false}
                    searchable={false}
                    compact
                    emptyMessage="No tickets for this match yet."
                />
            </div>
        </section>
    );
};
