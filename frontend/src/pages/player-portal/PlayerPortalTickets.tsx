import React, { useEffect, useState } from 'react';
import { TicketIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getMyTickets } from '../../services';
import type { MyPlayerTicket } from '../../types';
import { DashboardPageHeader, NotLinkedNotice, PlayerGameDayTicket, Spinner, apiError } from '../../components';

const NO_TICKETS: MyPlayerTicket[] = [];

export const PlayerPortalTickets: React.FC = () => {
    const [tickets, setTickets] = useState<MyPlayerTicket[]>(NO_TICKETS);
    const [loading, setLoading] = useState<boolean>(true);
    const [notLinked, setNotLinked] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;
        getMyTickets()
            .then((res) => {
                if (!cancelled) setTickets(res);
            })
            .catch((err) => {
                if (cancelled) return;
                if (apiError(err).code === 'PLAYER_NOT_LINKED') setNotLinked(true);
                else toast.error('Failed to load your tickets');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Game Day Tickets"
                subtitle="Your entry code for each match you are named for. Show it at the gate on match day."
            />

            {loading ? (
                <Spinner label="Loading your tickets" />
            ) : notLinked ? (
                <NotLinkedNotice />
            ) : tickets.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow border border-gray-100 dark:border-gray-700">
                    <TicketIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <h2 className="text-xl font-bold dark:text-white">No tickets yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                        Your ticket appears here as soon as your team manager puts you on a team sheet. You will also get it by email.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tickets.map((t) => (
                        <PlayerGameDayTicket key={t.ticket_id} ticket={t} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlayerPortalTickets;
