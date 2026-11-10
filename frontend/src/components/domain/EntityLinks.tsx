import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EntityLinkProps {
    /** The player's or team's id. Without one the name renders as plain text. */
    id?: string | null;
    children: ReactNode;
    className?: string;
    title?: string;
}

// Names keep their own look (size, weight, colour) and gain an underline on
// hover, so a linked name reads the same as before until you point at it.
// stopPropagation: a name inside a clickable row or card opens the profile
// instead of also firing the row's own action.
const LINK_CLASS = 'underline-offset-2 hover:underline focus-visible:underline focus:outline-none';

const EntityLink = ({ to, id, children, className = '', title }: EntityLinkProps & { to: string }) =>
    id ? (
        <Link to={`${to}/${id}`} title={title} className={`${LINK_CLASS} ${className}`} onClick={(e) => e.stopPropagation()}>
            {children}
        </Link>
    ) : (
        <span className={className} title={title}>
            {children}
        </span>
    );

/** A player's name that opens their profile (/players/:id). */
export const PlayerLink = (props: EntityLinkProps) => <EntityLink to="/players" {...props} />;

/**
 * A player's name that opens their fantasy page (/fantasy/players/:id): their
 * fantasy season, with a link on to the real player profile. Use it wherever a
 * name appears inside fantasy, so people stay in fantasy as they click around.
 */
export const FantasyPlayerLink = (props: EntityLinkProps) => <EntityLink to="/fantasy/players" {...props} />;

/**
 * A team's name that opens its page: the public team page (/teams/:id), or with
 * `admin` the admin team page (/admin/teams/:id) so admins stay in the dashboard.
 */
export const TeamLink = ({ admin = false, ...props }: EntityLinkProps & { admin?: boolean }) => (
    <EntityLink to={admin ? '/admin/teams' : '/teams'} {...props} />
);
