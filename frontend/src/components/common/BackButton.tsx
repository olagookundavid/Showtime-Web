import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export interface BackButtonProps {
    /** Fallback URL if opened directly or without in-app navigation history */
    fallback?: string;
    /** Button label, defaults to "Back" */
    label?: string;
    className?: string;
    children?: React.ReactNode;
}

/**
 * Smart Back Button for resource drill-downs.
 * Navigates back in browser history if the user arrived from another page within the app,
 * preserving filters, tabs, and scroll position. Falls back to a safe route if opened directly.
 */
export function BackButton({
    fallback = '/',
    label = 'Back',
    className = 'inline-flex items-center gap-1.5 text-sffl-red hover:underline font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer py-1',
    children,
}: BackButtonProps) {
    const navigate = useNavigate();

    const handleBack = () => {
        const hasHistory =
            typeof window !== 'undefined' &&
            window.history.state &&
            typeof window.history.state.idx === 'number' &&
            window.history.state.idx > 0;

        if (hasHistory) {
            navigate(-1);
        } else {
            navigate(fallback);
        }
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            className={className}
            aria-label={typeof children === 'string' ? children : label}
        >
            <ArrowLeftIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{children || label}</span>
        </button>
    );
}
