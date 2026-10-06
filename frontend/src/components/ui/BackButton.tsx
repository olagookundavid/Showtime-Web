import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

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
    className = '',
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
        <Button
            variant="link"
            size="sm"
            icon={ArrowLeftIcon}
            className={className}
            aria-label={typeof children === 'string' ? children : label}
            onClick={handleBack}
        >
            {children || label}
        </Button>
    );
}
