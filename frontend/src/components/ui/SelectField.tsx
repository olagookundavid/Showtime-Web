import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectFieldProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    /** Dark-on-light variant (default) or light-on-dark for navbar headers */
    variant?: 'default' | 'hero';
    disabled?: boolean;
    id?: string;
}

/**
 * A custom select component that renders its dropdown via a React Portal,
 * preventing the native dropdown positioning bug on mobile iOS/Android
 * caused by parent CSS transforms (translate, animate-in, etc.).
 */
export const SelectField: React.FC<SelectFieldProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    variant = 'default',
    disabled = false,
    id,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

    const calculatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = Math.min(options.length * 48 + 16, 280);

        const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        setDropdownStyle({
            position: 'fixed',
            left: rect.left,
            width: Math.max(rect.width, 200),
            zIndex: 9999,
            ...(openUpward
                ? { bottom: viewportHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
        });
    }, [options.length]);

    const openDropdown = () => {
        if (disabled) return;
        calculatePosition();
        setIsOpen(true);
    };

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (
                !triggerRef.current?.contains(e.target as Node) &&
                !dropdownRef.current?.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        // Recalculate on scroll/resize
        const handleReposition = () => calculatePosition();
        document.addEventListener('mousedown', handleClick);
        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [isOpen, calculatePosition]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    const isHero = variant === 'hero';

    const triggerClasses = isHero
        ? `appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-base cursor-pointer hover:bg-white/20 transition-colors w-full flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`
        : `w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-3 min-h-[44px] flex items-center justify-between text-base font-semibold focus:outline-none focus:ring-2 focus:ring-sffl-red transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-400'} ${className}`;

    return (
        <>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                disabled={disabled}
                onClick={openDropdown}
                className={triggerClasses}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="truncate flex-1 text-left">{selectedLabel}</span>
                <svg
                    className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    role="listbox"
                >
                    <div className="overflow-y-auto max-h-[280px] py-1">
                        {options.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-base font-medium transition-colors ${
                                    option.value === value
                                        ? 'bg-sffl-red/10 text-sffl-red font-bold'
                                        : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <p className="px-4 py-3 text-sm text-gray-400 italic">No options</p>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
