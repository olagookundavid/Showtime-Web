import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownTrayIcon, PrinterIcon, TicketIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { adminGetPlayerTicketDays, adminGetPlayerTicketDaySheets, adminIssuePlayerTickets } from '../../services/api';
import type { PlayerTicketDay, PlayerTicketSheet } from '../../types';
import {
    Button,
    ConfirmDialog,
    ConfirmSummary,
    DashboardPageHeader,
    Field,
    PlayerTicketSheetCard,
    Select,
    Spinner,
} from '../../components';
import {
    downloadPlayerTicketCsv,
    getApiErrorMessage,
    playerTicketFileName,
    playerTicketFixture,
    printPlayerTicketSheets,
} from '../../utils';

const NO_DAYS: PlayerTicketDay[] = [];

// Game days are dated in Lagos time, so "today" is too.
const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

const dayLabel = (d: PlayerTicketDay) =>
    `${d.title} · ${new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;

export const AdminPlayerTickets = () => {
    const queryClient = useQueryClient();
    const [picked, setPicked] = useState<string | null>(null);
    const [pendingIssue, setPendingIssue] = useState<PlayerTicketSheet | null>(null);
    const [issuing, setIssuing] = useState(false);

    const { data: days = NO_DAYS, isLoading: loadingDays } = useQuery({
        queryKey: ['adminPlayerTicketDays'],
        queryFn: adminGetPlayerTicketDays,
    });

    // The next game day by default, else the most recent one.
    const { upcoming, past } = useMemo(() => {
        const today = lagosToday();
        return {
            upcoming: days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
            past: days.filter((d) => d.date < today),
        };
    }, [days]);
    const dayId = picked ?? upcoming[0]?.id ?? past[0]?.id ?? '';

    const { data: daySheets, isLoading: loadingSheets } = useQuery({
        queryKey: ['adminPlayerTicketDaySheets', dayId],
        queryFn: () => adminGetPlayerTicketDaySheets(dayId),
        enabled: !!dayId,
    });
    const sheets = daySheets?.sheets ?? [];
    const title = daySheets ? `Player tickets · ${dayLabel(daySheets.day)}` : 'Player tickets';
    const fileName = daySheets ? playerTicketFileName(daySheets.day.date, 'player tickets') : 'player-tickets';

    const printAll = () => {
        if (!printPlayerTicketSheets(sheets, title)) {
            toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
        }
    };

    const confirmIssue = async () => {
        if (!pendingIssue) return;
        setIssuing(true);
        try {
            const res = await adminIssuePlayerTickets(pendingIssue.match.id, pendingIssue.team_id);
            queryClient.invalidateQueries({ queryKey: ['adminPlayerTicketDaySheets', dayId] });
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(`${res.result.issued} ${res.result.issued === 1 ? 'code' : 'codes'} issued, ${res.result.emailed} emailed.`);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to issue the codes.'));
        } finally {
            setIssuing(false);
            setPendingIssue(null);
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Player Tickets"
                subtitle="Every team sheet for a game day, with each player's ticket code. Print or export them for the gate, or look up a player's code for them."
                actions={
                    sheets.length > 0 && (
                        <>
                            <Button variant="secondary" icon={PrinterIcon} onClick={printAll}>
                                Print All
                            </Button>
                            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => downloadPlayerTicketCsv(sheets, fileName)}>
                                Export All
                            </Button>
                        </>
                    )
                }
            />

            {loadingDays ? (
                <Spinner label="Loading game days" />
            ) : days.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow border border-gray-100 dark:border-gray-700">
                    <TicketIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <h2 className="text-xl font-bold dark:text-white">No team sheets yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                        Player tickets appear here once a team manager, or an admin on Matches, saves a team sheet. Every player on it gets a code.
                    </p>
                </div>
            ) : (
                <>
                    <Field label="Game day" htmlFor="player-ticket-day" hint="Only game days with at least one saved team sheet are listed.">
                        <Select id="player-ticket-day" value={dayId} onChange={(e) => setPicked(e.target.value)} className="w-full sm:max-w-md">
                            {upcoming.length > 0 && (
                                <optgroup label="Upcoming">
                                    {upcoming.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {dayLabel(d)}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {past.length > 0 && (
                                <optgroup label="Played">
                                    {past.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {dayLabel(d)}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </Select>
                    </Field>

                    {loadingSheets ? (
                        <Spinner label="Loading team sheets" />
                    ) : sheets.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">No team sheets have been saved for this game day.</p>
                    ) : (
                        <div className="space-y-6">
                            {sheets.map((s) => (
                                <PlayerTicketSheetCard
                                    key={`${s.match.id}:${s.team_id}`}
                                    sheet={s}
                                    onIssue={setPendingIssue}
                                    issuing={issuing && pendingIssue?.match.id === s.match.id && pendingIssue?.team_id === s.team_id}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                open={pendingIssue !== null}
                title="Issue the missing codes?"
                description="Each player on the sheet without a code gets one. Players with an email are sent theirs straight away."
                body={
                    pendingIssue && (
                        <ConfirmSummary
                            rows={[
                                ['Team', pendingIssue.team_name],
                                ['Match', playerTicketFixture(pendingIssue)],
                                ['Players without a code', String(pendingIssue.named - pendingIssue.issued)],
                            ]}
                        />
                    )
                }
                confirmLabel="Issue Codes"
                tone="info"
                icon={TicketIcon}
                pending={issuing}
                onConfirm={confirmIssue}
                onCancel={() => setPendingIssue(null)}
            />
        </div>
    );
};
