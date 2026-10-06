import { type ButtonHTMLAttributes } from 'react';
import { type HeroIcon, type Tone } from './Button';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    icon: HeroIcon;
    /** Accessible name, also shown as the tooltip. Required, since there is no visible text. */
    label: string;
    variant?: 'ghost' | 'secondary' | 'danger';
    /** `dark` for a button on a dark surface. */
    tone?: Tone;
}

const variantStyles = {
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
    danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
};

const darkVariantStyles = {
    ghost: 'text-white/70 hover:text-white hover:bg-white/10',
    secondary: 'bg-white/10 hover:bg-white/20 text-white',
    danger: 'text-red-300 hover:bg-red-500/20',
};

/** Square 44px icon-only button (close buttons, row icons, toolbars). */
export const IconButton = ({
    icon: Icon,
    label,
    variant = 'ghost',
    tone = 'light',
    type = 'button',
    className = '',
    ...props
}: IconButtonProps) => (
    <button
        type={type}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center shrink-0 min-h-11 min-w-11 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sffl-red disabled:cursor-not-allowed disabled:opacity-50 ${tone === 'dark' ? darkVariantStyles[variant] : variantStyles[variant]} ${className}`}
        {...props}
    >
        <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
);
