import { type ComponentProps } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { type Tone } from './Button';
import { fieldControlClass, fieldControlDarkClass, fieldInvalidClass } from './formStyles';

type SelectProps = ComponentProps<'select'> & {
    /** Red border for a failed validation. Pair with Field's `error`. */
    invalid?: boolean;
    /** `dark` for a dropdown on a dark surface. */
    tone?: Tone;
};

/** Native dropdown with the shared look. `className` sets the width of the field box. */
export const Select = ({ invalid = false, tone = 'light', className = '', children, ...props }: SelectProps) => {
    const dark = tone === 'dark';

    return (
        <div className={`relative min-w-0 ${className}`}>
            <select
                aria-invalid={invalid || undefined}
                className={`${dark ? fieldControlDarkClass : fieldControlClass} min-h-11 appearance-none pl-3 pr-10 cursor-pointer ${dark ? '[&_option]:text-gray-900 [&_option]:bg-white' : ''} ${invalid ? fieldInvalidClass : ''}`}
                {...props}
            >
                {children}
            </select>
            <ChevronDownIcon
                className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
                aria-hidden="true"
            />
        </div>
    );
};
