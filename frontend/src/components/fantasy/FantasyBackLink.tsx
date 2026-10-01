import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface FantasyBackLinkProps {
    to: string;
    label: string;
    className?: string;
}

/** A minimal in-page back link for fantasy screens, so a manager can retreat
 *  a level without reaching for the browser's back button. */
export function FantasyBackLink({ to, label, className }: FantasyBackLinkProps) {
    return (
        <Link
            to={to}
            className={
                className ??
                'inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-gray-500 hover:text-sffl-navy dark:text-gray-400 dark:hover:text-white transition mb-1'
            }
        >
            <ArrowLeftIcon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
        </Link>
    );
}
