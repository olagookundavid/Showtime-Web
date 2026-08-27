import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
};

const widthClass: Record<NonNullable<Props['maxWidth']>, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
};

// Lightweight modal: dark backdrop, scrollable inner card, ESC + click-outside
// to close. Rendered through a portal so it escapes whatever stacking context
// the trigger lives in.
export const Modal = ({ open, onClose, title, subtitle, children, maxWidth = 'xl' }: Props) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        // Prevent background scroll while the modal is up.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    const node = (
        <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`bg-white dark:bg-gray-800 rounded-2xl ${widthClass[maxWidth]} w-full shadow-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-100 dark:border-gray-700`}
            >
                {(title || subtitle) && (
                    <div className="flex justify-between items-start gap-4 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                        <div>
                            {title && (
                                <h2 id="modal-title" className="text-xl font-black text-sffl-navy dark:text-white">{title}</h2>
                            )}
                            {subtitle && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-bold">{subtitle}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl leading-none -mt-1"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 flex-1 min-h-0">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(node, document.body);
};
