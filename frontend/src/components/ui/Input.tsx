import { type ComponentProps, type ReactNode } from 'react';
import { type HeroIcon, type Shape, type Tone } from './Button';
import { fieldControlClass, fieldControlDarkClass, fieldInvalidClass, fieldShapeClass } from './formStyles';

type InputProps = ComponentProps<'input'> & {
    /** Red border for a failed validation. Pair with Field's `error`. */
    invalid?: boolean;
    /** Decorative heroicon drawn inside the field on the left (e.g. a search glass). */
    icon?: HeroIcon;
    /** Control drawn inside the field on the right (e.g. a clear button). */
    action?: ReactNode;
    /** `dark` for a field on a dark surface. */
    tone?: Tone;
    /** `square` for sharp corners (store pages). */
    shape?: Shape;
};

/** Text-like input. `className` sets the width of the field box, not the input. */
export const Input = ({ invalid = false, icon: Icon, action, tone = 'light', shape = 'round', className = '', ...props }: InputProps) => {
    const padding = `${Icon ? 'pl-9' : 'pl-3'} ${action ? 'pr-11' : 'pr-3'}`;
    const dark = tone === 'dark';

    return (
        <div className={`relative min-w-0 ${className}`}>
            <input
                aria-invalid={invalid || undefined}
                className={`${dark ? fieldControlDarkClass : fieldControlClass} ${fieldShapeClass(shape)} min-h-11 ${padding} ${invalid ? fieldInvalidClass : ''}`}
                {...props}
            />
            {Icon && (
                <Icon
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${dark ? 'text-white/60' : 'text-gray-400'}`}
                    aria-hidden="true"
                />
            )}
            {action && <div className="absolute right-0 top-0 h-full flex items-center">{action}</div>}
        </div>
    );
};
