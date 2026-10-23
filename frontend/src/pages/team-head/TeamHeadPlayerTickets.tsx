import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardDocumentListIcon, TicketIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getMyPlayerTicketSheet, getMyPlayerTicketSheets, issueMyPlayerTickets } from '../../services/api';
import type { PlayerTicketSheet } from '../../types';
import {
    ButtonLink,
    ConfirmDialog,
    ConfirmSummary,
    DashboardPageHeader,
    Field,
    PlayerTicketSheetCard,
    Select,
    Spinner,
    useTeamHeadTeam,
} from '../../components';
import { getApiErrorMessage, playerTicketFixture } from '../../utils';

const NO_SHEETS: PlayerTicketSheet[] = [];

// Game days are dated in Lagos time, so "today" is too.
const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

const optionLabel = (s: PlayerTicketSheet) => {
    const date = new Date(`${s.match.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${date} · vs ${s.opponent || 'TBD'} · ${s.issued}/${s.named} codes`;
};

const TeamHeadPlayerTickets = () => {
    const team = useTeamHeadTeam();
    const teamId = team?.id;
    const queryClient = useQueryClient();
    const [picked, setPicked] = useState<string | null>(null);
    const [pendingIssue, setPendingIssue] = useState<PlayerTicketSheet | null>(null);
    const [issuing, setIssuing] = useState(false);

    const { data: sheets = NO_SHEETS, isLoading } = useQuery({
        queryKey: ['myPlayerTicketSheets', teamId],
        queryFn: () => getMyPlayerTicketSheets(teamId),
        enabled: !!teamId,
    });

    // The next match still to play by default, else the most recent one.
    const { upcoming, past } = useMemo(() => {
        const today = lagosToday();
        return {
            upcoming: sheets.filter((s) => s.match.date >= today).sort((a, b) => a.match.date.localeCompare(b.match.date)),
            past: sheets.filter((s) => s.match.date < today),
        };
    }, [sheets]);
    const matchId = picked ?? upcoming[0]?.match.id ?? past[0]?.match.id ?? '';

    const { data: sheet, isLoading: loadingSheet } = useQuery({
        queryKey: ['myPlayerTicketSheet', teamId, matchId],
        queryFn: () => getMyPlayerTicketSheet(matchId, teamId),
        enabled: !!teamId && !!matchId,
    });

    const confirmIssue = async () => {
        if (!pendingIssue) return;
        setIssuing(true);
        try {
            const res = await issueMyPlayerTickets(pendingIssue.match.id, teamId);
            queryClient.setQueryData(['myPlayerTicketSheet', teamId, pendingIssue.match.id], res.sheet);
            queryClient.invalidateQueries({ queryKey: ['myPlayerTicketSheets'] });
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
                title="Game Day Tickets"
                subtitle="Every player on your team sheet gets their own ticket code. Print the sheet or export it for the gate, and tell any player without an email their code."
            />

            {!teamId || isLoading ? (
                <Spinner label="Loading your team sheets" />
            ) : sheets.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow border border-gray-100 dark:border-gray-700">
                    <TicketIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <h2 className="text-xl font-bold dark:text-white">No team sheets yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                        Player tickets are made when you save a team sheet. Save one for your next match and every player on it gets a code.
                    </p>
                    <ButtonLink to="/team-head/team-sheets" icon={ClipboardDocumentListIcon} className="mt-6">
                        Go to Team Sheets
                    </ButtonLink>
                </div>
            ) : (
                <>
                    <Field label="Match" htmlFor="player-ticket-match" hint="Only matches you have saved a team sheet for are listed.">
                        <Select
                            id="player-ticket-match"
                            value={matchId}
                            onChange={(e) => setPicked(e.target.value)}
                            className="w-full sm:max-w-md"
                        >
                            {upcoming.length > 0 && (
                                <optgroup label="Upcoming">
                                    {upcoming.map((s) => (
                                        <option key={s.match.id} value={s.match.id}>
                                            {optionLabel(s)}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {past.length > 0 && (
                                <optgroup label="Played">
                                    {past.map((s) => (
                                        <option key={s.match.id} value={s.match.id}>
                                            {optionLabel(s)}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </Select>
                    </Field>

                    {loadingSheet || !sheet ? (
                        <Spinner label="Loading the team sheet" />
                    ) : (
                        <PlayerTicketSheetCard sheet={sheet} onIssue={setPendingIssue} issuing={issuing} />
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

export default TeamHeadPlayerTickets;
