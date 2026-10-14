import { Outlet } from 'react-router-dom';
import { TicketModeTabs } from './TicketModeTabs';

/** Wraps /tickets and /tickets/game-pass with the Season Pass / Game Pass / Gameday Tickets picker. */
export const TicketsLayout = () => (
    <div className="space-y-6 md:space-y-8">
        <TicketModeTabs />
        <Outlet />
    </div>
);
