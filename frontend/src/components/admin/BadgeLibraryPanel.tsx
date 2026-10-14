import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowPathIcon, PencilSquareIcon, PhotoIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { createBadgeIcon, deleteBadgeIcon, getBadgeIcons, updateBadgeIcon } from '../../services/api';
import type { BadgeIcon } from '../../types';
import { getApiErrorMessage } from '../../utils';
import { Button, ConfirmDialog, ConfirmSummary, Field, IconButton, ImageUploadField, Input, Modal, Spinner } from '../ui';
import { BADGE_ICONS_KEY } from './badgeLibrary';

const NO_ICONS: BadgeIcon[] = [];

/** "Used by Team of the Week" / "Used by 3 badges" / "Not used by any badge". */
const usageLabel = (ic: BadgeIcon) =>
    ic.used_by.length === 0
        ? 'Not used by any badge'
        : ic.used_by.length === 1
          ? `Used by ${ic.used_by[0]}`
          : `Used by ${ic.used_by.length} badges`;

type Draft = { icon: BadgeIcon | null; name: string; imageUrl: string };

type PendingAction = { kind: 'replace' } | { kind: 'delete'; icon: BadgeIcon };

/**
 * The Badge Library: the artwork badges pick their image from. Admins add
 * artwork, rename it, replace its image (every badge using it switches to the
 * new image) and remove artwork no badge uses.
 */
export const BadgeLibraryPanel = ({ canManage }: { canManage: boolean }) => {
    const queryClient = useQueryClient();
    const { data: icons = NO_ICONS, isLoading } = useQuery<BadgeIcon[]>({ queryKey: BADGE_ICONS_KEY, queryFn: getBadgeIcons });

    const [draft, setDraft] = useState<Draft | null>(null);
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const editing = draft?.icon ?? null;
    const imageChanged = Boolean(editing && draft && draft.imageUrl !== editing.image_url);
    const viewOnly = 'View-only access to Badges';

    const openAdd = () => setDraft({ icon: null, name: '', imageUrl: '' });
    const openEdit = (icon: BadgeIcon) => setDraft({ icon, name: icon.name, imageUrl: icon.image_url });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: BADGE_ICONS_KEY });
        void queryClient.invalidateQueries({ queryKey: ['adminBadges'] });
    };

    // Plain saves go straight through; swapping the image on artwork badges use
    // asks first, because it changes those badges everywhere.
    const requestSave = () => {
        if (!draft) return;
        if (!draft.name.trim()) return toast.error('Give the artwork a name.');
        if (!draft.imageUrl.trim()) return toast.error('Upload an image.');
        if (editing && imageChanged && editing.used_by.length > 0) {
            setPending({ kind: 'replace' });
            return;
        }
        void save();
    };

    const save = async () => {
        if (!draft) return;
        setBusy(true);
        try {
            const payload = { name: draft.name.trim(), image_url: draft.imageUrl.trim() };
            if (editing) {
                const res = await updateBadgeIcon(editing.id, payload);
                toast.success(
                    res.badges_updated > 0
                        ? `Artwork saved. ${res.badges_updated} badge${res.badges_updated === 1 ? ' now shows' : 's now show'} the new image.`
                        : 'Artwork saved.',
                );
            } else {
                await createBadgeIcon(payload);
                toast.success('Artwork added to the library.');
            }
            // Close while `busy` still marks the upload as kept (see ImageUploadField).
            setDraft(null);
            setPending(null);
            refresh();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'The artwork could not be saved.'));
            setPending(null);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (icon: BadgeIcon) => {
        setBusy(true);
        try {
            await deleteBadgeIcon(icon.id);
            toast.success(`${icon.name} removed from the library.`);
            refresh();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'The artwork could not be removed.'));
        } finally {
            setBusy(false);
            setPending(null);
        }
    };

    return (
        <section aria-labelledby="badge-library-title" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="badge-library-title" className="text-lg font-black text-sffl-navy dark:text-white">
                        Badge Library
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        The artwork badges can use. Replace an image here and every badge using it switches to the new one.
                    </p>
                </div>
                <Button
                    icon={PlusIcon}
                    onClick={openAdd}
                    disabled={!canManage}
                    title={canManage ? undefined : viewOnly}
                    className="w-full sm:w-auto shrink-0"
                >
                    Add Artwork
                </Button>
            </div>

            {isLoading ? (
                <Spinner className="py-10" />
            ) : icons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center">
                    <PhotoIcon className="w-10 h-10 mx-auto text-gray-400" aria-hidden="true" />
                    <p className="mt-2 font-bold text-gray-900 dark:text-white">No artwork yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Badges pick their image from this library. Add the first piece of artwork.</p>
                </div>
            ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {icons.map((ic) => {
                        const inUse = ic.used_by.length > 0;
                        return (
                            <li
                                key={ic.id}
                                className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
                            >
                                <div className="aspect-square bg-gray-50 dark:bg-gray-900/40 p-4 sm:p-6 flex items-center justify-center">
                                    <img src={ic.image_url} alt="" loading="lazy" className="max-w-full max-h-full object-contain drop-shadow-sm" />
                                </div>
                                <div className="flex flex-1 flex-col gap-1 p-3">
                                    <h3 className="font-black text-sm text-sffl-navy dark:text-white wrap-break-word">{ic.name}</h3>
                                    <p
                                        className={`text-[11px] font-semibold wrap-break-word ${inUse ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`}
                                        title={inUse ? ic.used_by.join(', ') : undefined}
                                    >
                                        {usageLabel(ic)}
                                    </p>
                                    <div className="mt-auto flex items-center gap-1 pt-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={PencilSquareIcon}
                                            onClick={() => openEdit(ic)}
                                            disabled={!canManage}
                                            title={canManage ? undefined : viewOnly}
                                            className="flex-1"
                                        >
                                            Edit
                                        </Button>
                                        <IconButton
                                            icon={TrashIcon}
                                            variant="danger"
                                            label={`Remove ${ic.name}`}
                                            disabled={!canManage || inUse}
                                            title={
                                                !canManage
                                                    ? viewOnly
                                                    : inUse
                                                      ? `In use by ${ic.used_by.join(', ')}. Pick different artwork for those badges first.`
                                                      : undefined
                                            }
                                            onClick={() => setPending({ kind: 'delete', icon: ic })}
                                        />
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {draft && (
                <Modal
                    open
                    onClose={() => setDraft(null)}
                    title={editing ? 'Edit Artwork' : 'Add Artwork'}
                    subtitle={editing ? 'Rename it, or upload a new image to replace it everywhere.' : 'Upload a badge image for the library.'}
                    maxWidth="lg"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setDraft(null)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={requestSave}
                                loading={busy && !pending}
                                disabled={busy || !draft.name.trim() || !draft.imageUrl.trim()}
                            >
                                {editing ? 'Save Artwork' : 'Add to Library'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <Field label="Name *" htmlFor="badge-artwork-name" hint="Shown to admins when picking a badge's artwork.">
                            <Input
                                id="badge-artwork-name"
                                value={draft.name}
                                maxLength={100}
                                placeholder="e.g. Team of the Week"
                                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                            />
                        </Field>
                        <ImageUploadField
                            label={editing ? 'Image (upload to replace)' : 'Image *'}
                            value={draft.imageUrl}
                            onChange={(url) => setDraft((d) => (d ? { ...d, imageUrl: url } : d))}
                            folder="badges"
                            isCommitted={busy}
                            helperText="A crisp square emblem works best: PNG, WebP or SVG with a transparent background."
                        />
                        {editing && imageChanged && editing.used_by.length > 0 && (
                            <p className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
                                <ArrowPathIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                Saving swaps the image on {editing.used_by.join(', ')}.
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            <ConfirmDialog
                open={pending !== null}
                title={pending?.kind === 'delete' ? 'Remove this artwork?' : 'Replace this artwork?'}
                description={
                    pending?.kind === 'delete'
                        ? 'It is removed from the library. No badge is using it.'
                        : 'Every badge using this artwork switches to the new image, on the site and in players’ badge lists.'
                }
                body={
                    pending?.kind === 'delete' ? (
                        <ConfirmSummary rows={[['Artwork', pending.icon.name]]} />
                    ) : editing ? (
                        <ConfirmSummary
                            rows={[
                                ['Artwork', draft?.name || editing.name],
                                ['Badges updated', editing.used_by.join(', ')],
                            ]}
                        />
                    ) : undefined
                }
                confirmLabel={pending?.kind === 'delete' ? 'Remove Artwork' : 'Replace Artwork'}
                tone={pending?.kind === 'delete' ? 'danger' : 'warning'}
                icon={pending?.kind === 'delete' ? TrashIcon : ArrowPathIcon}
                pending={busy}
                onConfirm={() => (pending?.kind === 'delete' ? void remove(pending.icon) : void save())}
                onCancel={() => setPending(null)}
            />
        </section>
    );
};
