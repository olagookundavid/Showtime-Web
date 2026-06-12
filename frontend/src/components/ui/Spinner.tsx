interface SpinnerProps {
    /** Optional label rendered beside the ring. */
    label?: string;
    /** Vertical padding so it sits comfortably inside a table/card body. */
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const SIZES: Record<NonNullable<SpinnerProps['size']>, string> = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
};

/**
 * Inline circular loader for in-place loading states (table bodies, sections,
 * cards) where a full-screen <Loader /> would be too heavy. Keeps surrounding
 * chrome (filters, headers) on screen while only the data area spins.
 */
export const Spinner = ({ label = 'Loading…', className = 'py-10', size = 'md' }: SpinnerProps) => {
    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <div className={`${SIZES[size]} border-sffl-red border-t-transparent rounded-full animate-spin`} />
            {label && <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</span>}
        </div>
    );
};
