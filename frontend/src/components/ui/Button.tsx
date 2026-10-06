import { type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { buttonClass, iconSize, type Size, type Tone, type Variant } from './buttonStyles';

export type { Tone } from './buttonStyles';

export type HeroIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

interface SharedProps {
    variant?: Variant;
    size?: Size;
    /** `dark` for buttons on a dark surface (hero bars, dark headers). */
    tone?: Tone;
    /** Heroicon shown beside the label. Use IconButton when there is no label. */
    icon?: HeroIcon;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    children?: ReactNode;
    className?: string;
}

interface ButtonProps extends SharedProps, ButtonHTMLAttributes<HTMLButtonElement> {
    /** Swaps the icon for a spinner and disables the button while work is in flight. */
    loading?: boolean;
}

export const Button = ({
    variant = 'primary',
    size = 'md',
    tone = 'light',
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    fullWidth = false,
    type = 'button',
    disabled = false,
    children,
    className = '',
    ...props
}: ButtonProps) => {
    const iconClass = `${iconSize[size]} shrink-0`;
    const iconNode = loading ? (
        <ArrowPathIcon className={`${iconClass} animate-spin`} aria-hidden="true" />
    ) : Icon ? (
        <Icon className={iconClass} aria-hidden="true" />
    ) : null;

    return (
        <button
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={buttonClass(variant, size, fullWidth, className, tone)}
            {...props}
        >
            {iconPosition === 'left' && iconNode}
            {children}
            {iconPosition === 'right' && iconNode}
        </button>
    );
};

/** A router link that looks like a Button. Use it for navigation, not for writes. */
export const ButtonLink = ({
    to,
    variant = 'primary',
    size = 'md',
    tone = 'light',
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    children,
    className = '',
    ...props
}: SharedProps & Omit<LinkProps, 'to' | 'className' | 'children'> & { to: string }) => {
    const iconClass = `${iconSize[size]} shrink-0`;
    const iconNode = Icon ? <Icon className={iconClass} aria-hidden="true" /> : null;

    return (
        <Link to={to} className={buttonClass(variant, size, fullWidth, className, tone)} {...props}>
            {iconPosition === 'left' && iconNode}
            {children}
            {iconPosition === 'right' && iconNode}
        </Link>
    );
};
