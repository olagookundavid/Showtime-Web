import { type ReactNode } from 'react';

interface SectionProps {
    children: ReactNode;
    className?: string;
    background?: 'light' | 'dark' | 'transparent';
}

export const Section = ({ children, className = '', background = 'light' }: SectionProps) => {
    const backgroundStyles = {
        light: 'bg-gray-50 dark:bg-gray-900',
        dark: 'bg-gray-100 dark:bg-gray-800',
        transparent: 'bg-transparent'
    };

    return (
        <section className={`py-12 ${backgroundStyles[background]} ${className}`}>
            {children}
        </section>
    );
};
