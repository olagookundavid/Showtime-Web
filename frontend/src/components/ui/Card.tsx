import { type ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
}

export const Card = ({ children, className = '', hover = false }: CardProps) => {
    const hoverStyles = hover
        ? 'hover:shadow-xl hover:scale-105 cursor-pointer transition-all duration-300'
        : '';

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md ${hoverStyles} ${className}`}>
            {children}
        </div>
    );
};
