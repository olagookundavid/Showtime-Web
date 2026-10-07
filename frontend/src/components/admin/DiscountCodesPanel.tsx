import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useDebounced } from '../../hooks/useDebounced';
import {
    ArrowRightIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { discountsApi } from '../../services/api';
import type { DiscountAudience, DiscountCode, DiscountTarget } from '../../types/discounts';
import { Button, Checkbox, Field, IconButton, Input, Modal, Select } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfirmSummary } from '../ui/ConfirmSummary';
import { Spinner } from '../ui/Spinner';
import { getApiErrorMessage } from '../../utils/apiError';

type ItemDraft = {
    entity_type: 'product' | 'ticket_tier';
    entity_id: string;
    name: string;
    price: number;
    amount_off: string;
};

type FormState = {
    code: string;
    description: string;
    limitUses: boolean;
    maxUses: string;
    hasExpiry: boolean;
    expiresAt: string;
    audience: DiscountAudience;
    isActive: boolean;
    items: ItemDraft[];
};

const emptyForm: FormState = {
    code: '',
    description: '',
    limitUses: false,
    maxUses: '',
    hasExpiry: false,
    expiresAt: '',
    audience: 'all',
    isActive: true,
    items: [],
};

type PendingAction = { kind: 'save' } | { kind: 'delete'; code: DiscountCode };


const AUDIENCE_LABEL: Record<DiscountAudience, string> = {
    all: 'Everyone',
    authenticated: 'Signed-in only',
    guest: 'Guests only',
};

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time; the API speaks ISO. */
const toLocalInput = (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const DiscountCodesPanel = () => {
    const queryClient = useQueryClient();

    const [editing, setEditing] = useState<DiscountCode | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formError, setFormError] = useState('');
    const [targetSearch, setTargetSearch] = useState('');
    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

    const { data: codes = [], isLoading } = useQuery({
        queryKey: ['discountCodes'],
        queryFn: discountsApi.list,
    });

    // The search runs on the server, so the picker is never limited to whatever
    // happened to be in the first page.
    const debouncedTargetSearch = useDebounced(targetSearch);
    const { data: targets = [], isFetching: targetsLoading } = useQuery({
        queryKey: ['discountTargets', debouncedTargetSearch],
        queryFn: () => discountsApi.listTargets(debouncedTargetSearch),
        enabled: showEditor,
        placeholderData: (prev) => prev,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['discountCodes'] });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                code: form.code.trim(),
                description: form.description.trim(),
                max_uses: form.limitUses && form.maxUses ? parseInt(form.maxUses, 10) : null,
                expires_at: form.hasExpiry && form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                audience: form.audience,
                is_active: form.isActive,
                items: form.items.map(i => ({
                    entity_type: i.entity_type,
                    entity_id: i.entity_id,
                    amount_off: parseFloat(i.amount_off) || 0,
                })),
            };
            return editing ? discountsApi.update(editing.id, payload) : discountsApi.create(payload);
        },
        onSuccess: () => {
            toast.success(editing ? 'Discount code updated.' : 'Discount code created.');
            invalidate();
            closeEditor();
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err, 'Could not save this code'));
        },
        onSettled: () => setPendingAction(null),
    });

    const deleteMutation = useMutation({
        mutationFn: discountsApi.remove,
        onSuccess: () => {
            toast.success('Discount code deleted.');
            invalidate();
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err, 'Could not delete this code'));
        },
        onSettled: () => setPendingAction(null),
    });

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormError('');
        setTargetSearch('');
        setShowEditor(true);
    };

    const openEdit = (code: DiscountCode) => {
        setEditing(code);
        setForm({
            code: code.code,
            description: code.description || '',
            limitUses: code.max_uses != null,
            maxUses: code.max_uses != null ? String(code.max_uses) : '',
            hasExpiry: !!code.expires_at,
            expiresAt: toLocalInput(code.expires_at),
            audience: code.audience,
            isActive: code.is_active,
            items: code.items.map(i => ({
                entity_type: i.entity_type,
                entity_id: i.entity_id,
                name: i.entity_name || '(deleted item)',
                price: i.entity_price || 0,
                amount_off: String(i.amount_off),
            })),
        });
        setFormError('');
        setTargetSearch('');
        setShowEditor(true);
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditing(null);
        setForm(emptyForm);
        setFormError('');
    };

    const selectedKeys = useMemo(
        () => new Set(form.items.map(i => `${i.entity_type}:${i.entity_id}`)),
        [form.items],
    );

    // Only the already-picked ones are filtered here: that is form state, not
    // data volume. The name match is the server's job.
    const availableTargets = useMemo(
        () => targets.filter(t => !selectedKeys.has(`${t.entity_type}:${t.entity_id}`)),
        [targets, selectedKeys],
    );

    const addTarget = (t: DiscountTarget) => {
        setForm(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    entity_type: t.entity_type,
                    entity_id: t.entity_id,
                    name: t.name,
                    price: t.price,
                    amount_off: '',
                },
            ],
        }));
    };

    const removeTarget = (key: string) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter(i => `${i.entity_type}:${i.entity_id}` !== key),
        }));
    };

    const setItemAmount = (key: string, value: string) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.map(i =>
                `${i.entity_type}:${i.entity_id}` === key ? { ...i, amount_off: value } : i,
            ),
        }));
    };

    const handleSave = () => {
        setFormError('');
        if (!form.code.trim()) {
            setFormError('Give the code a name customers will type.');
            return;
        }
        if (form.items.length === 0) {
            setFormError('Add at least one product or ticket tier this code applies to.');
            return;
        }
        const bad = form.items.find(i => !(parseFloat(i.amount_off) > 0));
        if (bad) {
            setFormError(`Enter how much comes off "${bad.name}".`);
            return;
        }
        if (form.limitUses && !(parseInt(form.maxUses, 10) > 0)) {
            setFormError('Enter how many times the code can be used, or turn the limit off.');
            return;
        }
        if (form.hasExpiry && !form.expiresAt) {
            setFormError('Pick an expiry date, or turn the expiry off.');
            return;
        }
        setPendingAction({ kind: 'save' });
    };

    const confirmPendingAction = () => {
        if (!pendingAction) return;
        if (pendingAction.kind === 'save') saveMutation.mutate();
        else deleteMutation.mutate(pendingAction.code.id);
    };

    const statusOf = (c: DiscountCode): { label: string; tone: string } => {
        if (!c.is_active) return { label: 'Paused', tone: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
        if (c.is_expired) return { label: 'Expired', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        if (c.is_exhausted) return { label: 'Used up', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
        return { label: 'Live', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-sffl-navy dark:text-white">Discount Codes</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        One code can cover several products and ticket tiers, each with its own amount off.
                    </p>
                </div>
                <Button icon={PlusIcon} onClick={openCreate}>
                    New Code
                </Button>
            </div>

            {isLoading ? (
                <Spinner label="Loading discount codes" className="py-16" />
            ) : codes.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 sm:p-12 text-center border border-gray-200 dark:border-gray-700">
                    <TagIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
                    <p className="font-bold text-gray-700 dark:text-gray-300">No discount codes yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                        Create one to give money off specific products or ticket tiers.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {codes.map(c => {
                        const status = statusOf(c);
                        return (
                            <div
                                key={c.id}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-black text-base text-sffl-navy dark:text-white tracking-wider">
                                                {c.code}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${status.tone}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        {c.description && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 -my-2 -mr-2">
                                        <IconButton
                                            variant="ghost"
                                            icon={PencilSquareIcon}
                                            label={`Edit ${c.code}`}
                                            onClick={() => openEdit(c)}
                                        />
                                        <IconButton
                                            variant="danger"
                                            icon={TrashIcon}
                                            label={`Delete ${c.code}`}
                                            onClick={() => setPendingAction({ kind: 'delete', code: c })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg py-2">
                                        <p className="text-[10px] uppercase font-bold text-gray-400">Used</p>
                                        <p className="text-sm font-black text-sffl-navy dark:text-white tabular-nums">
                                            {c.used_count}
                                            {c.max_uses != null ? ` / ${c.max_uses}` : ''}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg py-2">
                                        <p className="text-[10px] uppercase font-bold text-gray-400">Expires</p>
                                        <p className="text-sm font-black text-sffl-navy dark:text-white">
                                            {c.expires_at
                                                ? new Date(c.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                                : 'Never'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg py-2">
                                        <p className="text-[10px] uppercase font-bold text-gray-400">For</p>
                                        <p className="text-sm font-black text-sffl-navy dark:text-white">
                                            {AUDIENCE_LABEL[c.audience]}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-gray-400">
                                        Applies to {c.items.length} item{c.items.length === 1 ? '' : 's'}
                                    </p>
                                    <ul className="space-y-1">
                                        {c.items.slice(0, 4).map(i => (
                                            <li
                                                key={`${i.entity_type}:${i.entity_id}`}
                                                className="flex justify-between items-baseline gap-3 text-xs"
                                            >
                                                <span className="text-gray-600 dark:text-gray-300 truncate">
                                                    {i.entity_name || '(deleted item)'}
                                                    {i.entity_type === 'ticket_tier' && (
                                                        <span className="ml-1.5 text-[9px] uppercase font-bold text-gray-400">ticket</span>
                                                    )}
                                                </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                    −₦{i.amount_off.toLocaleString()}
                                                </span>
                                            </li>
                                        ))}
                                        {c.items.length > 4 && (
                                            <li className="text-[11px] text-gray-400">+{c.items.length - 4} more</li>
                                        )}
                                    </ul>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            <Modal
                open={showEditor}
                onClose={closeEditor}
                title={editing ? `Edit ${editing.code}` : 'New Discount Code'}
                maxWidth="2xl"
                footer={
                    <>
                        <Button variant="secondary" size="lg" className="flex-1" onClick={closeEditor}>
                            Cancel
                        </Button>
                        <Button size="lg" className="flex-2" loading={saveMutation.isPending} onClick={handleSave}>
                            {editing ? 'Save Changes' : 'Create Code'}
                        </Button>
                    </>
                }
            >
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Code *" htmlFor="discount-code" hint="Customers can type it in any case.">
                                    <Input
                                        id="discount-code"
                                        value={form.code}
                                        onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                        placeholder="SHOWTIME10"
                                    />
                                </Field>
                                <Field label="Internal note" htmlFor="discount-note">
                                    <Input
                                        id="discount-note"
                                        value={form.description}
                                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Launch week promo"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Checkbox
                                        label="Limit uses"
                                        checked={form.limitUses}
                                        onChange={e => setForm(p => ({ ...p, limitUses: e.target.checked }))}
                                    />
                                    <Input
                                        type="number"
                                        min={1}
                                        aria-label="Maximum uses"
                                        value={form.maxUses}
                                        onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                                        disabled={!form.limitUses}
                                        placeholder="Unlimited"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Checkbox
                                        label="Set expiry"
                                        checked={form.hasExpiry}
                                        onChange={e => setForm(p => ({ ...p, hasExpiry: e.target.checked }))}
                                    />
                                    <Input
                                        type="datetime-local"
                                        aria-label="Expiry date and time"
                                        value={form.expiresAt}
                                        onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                                        disabled={!form.hasExpiry}
                                    />
                                </div>

                                <Field label="Who can use it" htmlFor="discount-audience">
                                    <Select
                                        id="discount-audience"
                                        value={form.audience}
                                        onChange={e => setForm(p => ({ ...p, audience: e.target.value as DiscountAudience }))}
                                    >
                                        <option value="all">Everyone (guests + signed in)</option>
                                        <option value="authenticated">Signed-in customers only</option>
                                        <option value="guest">Guest checkouts only</option>
                                    </Select>
                                </Field>
                            </div>

                            <label className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer">
                                <div className="min-w-0">
                                    <span className="block text-sm font-bold text-gray-800 dark:text-white">Active</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Turn off to pause the code without deleting it.
                                    </span>
                                </div>
                                <Checkbox
                                    checked={form.isActive}
                                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                                />
                            </label>

                            {/* Covered items */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-sm font-black text-sffl-navy dark:text-white">
                                        What it applies to
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Set a different amount off per item. The code takes money off one unit of each
                                        item in the order.
                                    </p>
                                </div>

                                {form.items.length > 0 && (
                                    <div className="space-y-2">
                                        {form.items.map(i => {
                                            const key = `${i.entity_type}:${i.entity_id}`;
                                            const off = parseFloat(i.amount_off) || 0;
                                            const after = Math.max(0, i.price - off);
                                            return (
                                                <div
                                                    key={key}
                                                    className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600"
                                                >
                                                    <div className="min-w-40 flex-1">
                                                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                                            {i.name}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {i.entity_type === 'ticket_tier' ? 'Ticket tier' : 'Product'} ·
                                                            ₦{i.price.toLocaleString()}
                                                            {off > 0 && (
                                                                <span className="inline-flex items-center gap-1 ml-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    <ArrowRightIcon className="w-3 h-3" aria-hidden="true" />
                                                                    <span className="sr-only">after discount</span>
                                                                    ₦{after.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="text-xs font-bold text-gray-400">₦</span>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={i.amount_off}
                                                            onChange={e => setItemAmount(key, e.target.value)}
                                                            placeholder="0"
                                                            aria-label={`Amount off ${i.name}`}
                                                            className="w-24"
                                                        />
                                                        <IconButton
                                                            variant="danger"
                                                            icon={XMarkIcon}
                                                            label={`Remove ${i.name}`}
                                                            onClick={() => removeTarget(key)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                                        <Input
                                            value={targetSearch}
                                            icon={MagnifyingGlassIcon}
                                            onChange={e => setTargetSearch(e.target.value)}
                                            placeholder="Search products and ticket tiers to add"
                                            aria-label="Search products and ticket tiers"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                        {availableTargets.length === 0 ? (
                                            targetsLoading ? (
                                                <Spinner label="Searching" size="sm" className="py-4" />
                                            ) : (
                                                <p className="px-3 py-4 text-xs text-gray-400 text-center">
                                                    {debouncedTargetSearch
                                                        ? `Nothing matches "${debouncedTargetSearch}".`
                                                        : 'Nothing left to add.'}
                                                </p>
                                            )
                                        ) : (
                                            availableTargets.map(t => (
                                                <button
                                                    key={`${t.entity_type}:${t.entity_id}`}
                                                    type="button"
                                                    onClick={() => addTarget(t)}
                                                    className="w-full min-h-11 flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                >
                                                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                                        {t.name}
                                                        {t.entity_type === 'ticket_tier' && (
                                                            <span className="ml-1.5 text-[9px] uppercase font-bold text-gray-400">
                                                                ticket
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                                                        ₦{t.price.toLocaleString()}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {formError && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold px-4 py-3 rounded-xl">
                                    {formError}
                                </div>
                            )}
                        </div>

            </Modal>

            <ConfirmDialog
                open={pendingAction !== null}
                title={pendingAction?.kind === 'delete'
                    ? `Delete ${pendingAction.code.code}?`
                    : editing ? `Save changes to ${editing.code}?` : 'Create this discount code?'}
                description={pendingAction?.kind === 'delete' ? 'Its redemption history goes too. This cannot be undone.' : undefined}
                confirmLabel={pendingAction?.kind === 'delete' ? 'Delete Code' : editing ? 'Save Changes' : 'Create Code'}
                tone={pendingAction?.kind === 'delete' ? 'warning' : 'info'}
                icon={pendingAction?.kind === 'delete' ? TrashIcon : TagIcon}
                pending={saveMutation.isPending || deleteMutation.isPending}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
                body={pendingAction?.kind === 'delete' ? (
                    <ConfirmSummary rows={[
                        ['Code', pendingAction.code.code],
                        ['Used', `${pendingAction.code.used_count}${pendingAction.code.max_uses != null ? ` / ${pendingAction.code.max_uses}` : ''}`],
                        ['Applies to', `${pendingAction.code.items.length} item${pendingAction.code.items.length === 1 ? '' : 's'}`],
                    ]} />
                ) : (
                    <ConfirmSummary rows={[
                        ['Code', form.code.trim()],
                        ['Who can use it', AUDIENCE_LABEL[form.audience]],
                        ['Uses', form.limitUses && form.maxUses ? form.maxUses : 'Unlimited'],
                        ['Expires', form.hasExpiry && form.expiresAt ? new Date(form.expiresAt).toLocaleString() : 'Never'],
                        ['Applies to', `${form.items.length} item${form.items.length === 1 ? '' : 's'}`],
                        ['Status', form.isActive ? 'Active' : 'Paused'],
                    ]} />
                )}
            />
        </div>
    );
};
