import { type ReactNode } from 'react';
import { type Tone } from './Button';

interface FieldProps {
    label: ReactNode;
    /** id of the control passed as `children`. Leave it out for a group of controls (e.g. two toggle buttons). */
    htmlFor?: string;
    hint?: string;
    /** Replaces `hint` when set. Pair with the control's `invalid` prop. */
    error?: string;
    /** Layout of the whole field (width, grid placement). */
    className?: string;
    /** `dark` for a field on a dark surface. */
    tone?: Tone;
    children: ReactNode;
}

/** A label, a control and its hint or error message. */
export const Field = ({ label, htmlFor, hint, error, className = '', tone = 'light', children }: FieldProps) => {
    const dark = tone === 'dark';
    const labelClass = `block text-sm font-bold mb-1.5 ${dark ? 'text-white/85' : 'text-gray-700 dark:text-gray-200'}`;

    return (
        <div className={`min-w-0 ${className}`}>
            {htmlFor ? (
                <label htmlFor={htmlFor} className={labelClass}>
                    {label}
                </label>
            ) : (
                <span className={labelClass}>{label}</span>
            )}
            {children}
            {error ? (
                <p className={`mt-1 text-xs font-semibold ${dark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>{error}</p>
            ) : hint ? (
                <p className={`mt-1 text-xs ${dark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>{hint}</p>
            ) : null}
        </div>
    );
};
