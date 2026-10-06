import { type ComponentProps } from 'react';
import { type Tone } from './Button';
import { fieldControlClass, fieldControlDarkClass, fieldInvalidClass } from './formStyles';

type TextareaProps = ComponentProps<'textarea'> & {
    /** Red border for a failed validation. Pair with Field's `error`. */
    invalid?: boolean;
    /** `dark` for a text box on a dark surface. */
    tone?: Tone;
};

/** Multi-line text. `className` sets the width of the field box, not the textarea. */
export const Textarea = ({ invalid = false, tone = 'light', className = '', ...props }: TextareaProps) => (
    <div className={`min-w-0 ${className}`}>
        <textarea
            aria-invalid={invalid || undefined}
            className={`${tone === 'dark' ? fieldControlDarkClass : fieldControlClass} px-3 min-h-24 resize-y ${invalid ? fieldInvalidClass : ''}`}
            {...props}
        />
    </div>
);
