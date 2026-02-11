import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
}

export const Button = ({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
    ...props
}: ButtonProps) => {
    const baseStyles = 'font-bold rounded transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2';

    const variantStyles = {
        primary: 'bg-sffl-red hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500',
        secondary: 'bg-white hover:bg-gray-100 text-sffl-navy dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white focus:ring-gray-400',
        outline: 'border-2 border-sffl-navy hover:bg-sffl-navy hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-sffl-navy focus:ring-sffl-navy',
        danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500'
    };

    const sizeStyles = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
