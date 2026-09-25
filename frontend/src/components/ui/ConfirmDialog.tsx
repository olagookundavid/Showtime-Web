import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Modal } from './Modal';

type Tone = 'success' | 'info' | 'warning';

type Props = {
    open: boolean;
    title: string;
    description?: string;
    body?: React.ReactNode;
    confirmLabel: string;
    tone?: Tone;
    icon?: React.ComponentType<{ className?: string }>;
    pending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

const toneClass: Record<Tone, { badge: string; button: string }> = {
    success: {
        badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        button: 'bg-green-600 hover:bg-green-700',
    },
    info: {
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-700',
    },
    warning: {
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        button: 'bg-orange-600 hover:bg-orange-700',
    },
};

/**
 * "Are you sure?" gate for key actions. Built on Modal for the portal, ESC and
 * backdrop handling, but draws its own header so the icon matches the action.
 * While `pending`, it can't be dismissed, so the result of the action always
 * lands on screen. The confirm button takes focus, so Enter confirms.
 */
export const ConfirmDialog = ({
    open,
    title,
    description,
    body,
    confirmLabel,
    tone = 'warning',
    icon: Icon = ExclamationTriangleIcon,
    pending = false,
    onConfirm,
    onCancel,
}: Props) => {
    const styles = toneClass[tone];
    const dismiss = () => {
        if (!pending) onCancel();
    };

    return (
        <Modal open={open} onClose={dismiss} maxWidth="md">
            <div className="flex items-start gap-3">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.badge}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-black text-sffl-navy dark:text-white">
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{description}</p>
                    )}
                </div>
            </div>

            {body && <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">{body}</div>}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                    type="button"
                    onClick={dismiss}
                    disabled={pending}
                    className="px-4 py-2 min-h-11 rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300 active:scale-95 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={pending}
                    autoFocus
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 rounded-lg text-sm font-bold text-white shadow-sm hover:shadow-md transition-all duration-300 active:scale-95 disabled:opacity-60 ${styles.button}`}
                >
                    {pending && <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
};
