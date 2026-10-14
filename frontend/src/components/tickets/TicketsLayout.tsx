import { Outlet } from 'react-router-dom';
import { TicketModeTabs } from './TicketModeTabs';

/** Wraps /tickets/game-pass with the Season Pass / Game Pass picker. */
export const TicketsLayout = () => (
    <div className="space-y-6 md:space-y-8">
        <TicketModeTabs />
        <Outlet />
    </div>
);
