import { useEffect, useRef, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Modal } from './Modal';
import { isConfirmSkipped, setConfirmSkipped } from '../../utils';

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
    /** A stable, page+operation-scoped id (e.g. "admin-tickets:checkin") that offers a "don't ask me again" checkbox. Never offered when `tone` is `'danger'`, even if set. */
    dontAskAgainKey?: string;
    dontAskAgainLabel?: string;
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
 * "Are you sure?" gate for key actions. Built on Modal for the portal, header,
 * ESC and backdrop handling, with the tone icon folded into Modal's own title.
 * While `pending`, it can't be dismissed, so the result of the action always
 * lands on screen. The confirm button takes focus, so Enter confirms.
 *
 * With `dontAskAgainKey` (and a non-'danger' tone), a checkbox offers to skip
 * this exact confirmation next time; once checked and confirmed, later opens
 * for that key resolve straight to `onConfirm` without ever showing.
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
    dontAskAgainKey,
    dontAskAgainLabel = "Don't ask me again",
    onConfirm,
    onCancel,
}: Props) => {
    // Deletes and other irreversible actions always ask, regardless of what a caller passes.
    const effectiveKey = tone === 'danger' ? undefined : dontAskAgainKey;
    const skipped = effectiveKey ? isConfirmSkipped(effectiveKey) : false;

    const [dontAskChecked, setDontAskChecked] = useState(false);

    const dismiss = () => {
        if (!pending) {
            setDontAskChecked(false);
            onCancel();
        }
    };

    const hasAutoConfirmedRef = useRef(false);
    // Kept fresh in its own effect (never written during render) so the
    // auto-confirm effect below can call the latest onConfirm without
    // needing it in its own dependency array.
    const onConfirmRef = useRef(onConfirm);
    useEffect(() => {
        onConfirmRef.current = onConfirm;
    });

    useEffect(() => {
        if (!open) {
            hasAutoConfirmedRef.current = false;
            return;
        }
        if (skipped && !hasAutoConfirmedRef.current) {
            hasAutoConfirmedRef.current = true;
            onConfirmRef.current();
        }
    }, [open, skipped]);

    const handleConfirmClick = () => {
        if (effectiveKey && dontAskChecked) setConfirmSkipped(effectiveKey);
        setDontAskChecked(false);
        onConfirm();
    };

    const titleNode = (
        <span className="inline-flex items-center gap-3">
            <span className={`shrink-0 inline-flex w-10 h-10 rounded-full items-center justify-center ${badgeClass[tone]}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>{title}</span>
        </span>
    );

    return (
        <Modal open={open && !skipped} onClose={dismiss} maxWidth={maxWidth} shape="square" title={titleNode}>
            <div className="space-y-4">
                {description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
                )}
                {body && <div className="text-sm text-gray-700 dark:text-gray-300">{body}</div>}
                {effectiveKey && (
                    <Checkbox
                        label={dontAskAgainLabel}
                        checked={dontAskChecked}
                        onChange={(e) => setDontAskChecked(e.target.checked)}
                        disabled={pending}
                    />
                )}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="secondary" onClick={dismiss} disabled={pending} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button
                    variant={tone}
                    onClick={handleConfirmClick}
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
