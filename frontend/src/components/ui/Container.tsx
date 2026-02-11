import { type ReactNode } from 'react';

interface ContainerProps {
    children: ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
}

export const Container = ({ children, className = '', size = 'lg' }: ContainerProps) => {
    const sizeStyles = {
        sm: 'max-w-3xl',
        md: 'max-w-5xl',
        lg: 'max-w-7xl',
        full: 'max-w-full'
    };

    return (
        <div className={`container mx-auto px-4 ${sizeStyles[size]} ${className}`}>
            {children}
        </div>
    );
};
