import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';
import { Modal } from './Modal';

type Tone = 'success' | 'info' | 'warning' | 'danger';

type Props = {
    open: boolean;
    title: string;
    description?: string;
    body?: React.ReactNode;
    confirmLabel: string;
    tone?: Tone;
    icon?: React.ComponentType<{ className?: string }>;
    /** Width of the dialog. Leave it at 'md' unless the body needs room, e.g. a table. */
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
    pending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

// The confirm button's variant matches its tone name, so `variant={tone}` is enough.
const badgeClass: Record<Tone, string> = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    warning: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
    maxWidth = 'md',
    pending = false,
    onConfirm,
    onCancel,
}: Props) => {
    const dismiss = () => {
        if (!pending) onCancel();
    };

    return (
        <Modal open={open} onClose={dismiss} maxWidth={maxWidth}>
            <div className="flex items-start gap-3">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${badgeClass[tone]}`}>
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
                <Button variant="secondary" onClick={dismiss} disabled={pending} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button
                    variant={tone}
                    onClick={onConfirm}
                    loading={pending}
                    autoFocus
                    className="w-full sm:w-auto"
                >
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    );
};
