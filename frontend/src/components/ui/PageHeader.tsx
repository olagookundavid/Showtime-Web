import { type ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: ReactNode;
    className?: string;
}

export const PageHeader = ({ title, subtitle, children, className = '' }: PageHeaderProps) => {
    return (
        <div className={`text-center mb-6 md:mb-8 ${className}`}>
            <h1 className="text-2xl md:text-5xl font-black text-sffl-navy dark:text-white mb-2 md:mb-4">
                {title}
            </h1>
            {subtitle && (
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-300">
                    {subtitle}
                </p>
            )}
            {children}
        </div>
    );
};
