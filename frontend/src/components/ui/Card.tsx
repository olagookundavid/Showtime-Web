import { type ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    /** 'round' (default, unchanged) or 'square' — flat catalogue style: no radius, border instead of shadow. */
    shape?: 'round' | 'square';
}

const shapeStyles: Record<'round' | 'square', string> = {
    round: 'rounded-xl shadow-md',
    square: 'rounded-none border border-gray-200 dark:border-gray-700',
};

export const Card = ({ children, className = '', hover = false, shape = 'round' }: CardProps) => {
    const hoverStyles = hover
        ? shape === 'square'
            ? 'hover:border-sffl-red cursor-pointer transition-colors duration-300'
            : 'hover:shadow-xl hover:scale-105 cursor-pointer transition-all duration-300'
        : '';

    return (
        <div className={`bg-white dark:bg-gray-800 ${shapeStyles[shape]} ${hoverStyles} ${className}`}>
            {children}
        </div>
    );
};
