import { type ComponentProps, type ReactNode } from 'react';
import { type Tone } from './Button';

type CheckboxProps = Omit<ComponentProps<'input'>, 'type'> & {
    /** Text beside the box, and part of the click target. Leave it out for the bare box inside a row or tile you draw yourself. */
    label?: ReactNode;
    /** Smaller grey line under the label. Only used with `label`. */
    hint?: ReactNode;
    /** `dark` for a checkbox on a dark surface. */
    tone?: Tone;
};

const boxClass = 'h-5 w-5 shrink-0 rounded border-gray-300 dark:border-gray-600 accent-sffl-red focus:ring-2 focus:ring-sffl-red cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

/**
 * A checkbox. With `label`, the whole row (box and text) is one 44px tap target.
 * Without it, `className` sets the box itself, so the box can sit inside a row you draw.
 */
export const Checkbox = ({ label, hint, tone = 'light', className = '', ...props }: CheckboxProps) => {
    const dark = tone === 'dark';

    if (label === undefined) {
        return <input type="checkbox" className={`${boxClass} ${className}`} {...props} />;
    }

    return (
        <label className={`flex items-center gap-3 min-h-11 cursor-pointer select-none ${className}`}>
            <input type="checkbox" className={boxClass} {...props} />
            <span className="min-w-0">
                <span className={`block text-sm font-bold ${dark ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{label}</span>
                {hint && <span className={`block text-xs ${dark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>{hint}</span>}
            </span>
        </label>
    );
};
