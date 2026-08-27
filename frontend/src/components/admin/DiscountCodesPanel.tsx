import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    discountsApi,
    type DiscountAudience,
    type DiscountCode,
    type DiscountTarget,
} from '../../services/api';

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
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data: codes = [], isLoading } = useQuery({
        queryKey: ['discountCodes'],
        queryFn: discountsApi.list,
    });

    const { data: targets = [] } = useQuery({
        queryKey: ['discountTargets'],
        queryFn: discountsApi.listTargets,
        enabled: showEditor,
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
            invalidate();
            closeEditor();
        },
        onError: (err: any) => {
            setFormError(err.response?.data?.error || 'Could not save this code');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: discountsApi.remove,
        onSuccess: () => {
            invalidate();
            setDeleteConfirm(null);
        },
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

    const availableTargets = useMemo(() => {
        const q = targetSearch.trim().toLowerCase();
        return targets.filter(t => {
            if (selectedKeys.has(`${t.entity_type}:${t.entity_id}`)) return false;
            return !q || t.name.toLowerCase().includes(q);
        });
    }, [targets, targetSearch, selectedKeys]);

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
        saveMutation.mutate();
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
                <button
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-2 bg-sffl-red hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                    <PlusIcon className="w-4 h-4" />
                    New Code
                </button>
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center">
                    <div className="w-8 h-8 border-4 border-sffl-red border-t-transparent rounded-full animate-spin" />
                </div>
            ) : codes.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700">
                    <TagIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
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
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
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
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => openEdit(c)}
                                            className="p-1.5 text-gray-400 hover:text-sffl-navy dark:hover:text-white rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <PencilSquareIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(c.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
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

                                {deleteConfirm === c.id && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2">
                                        <p className="text-xs font-bold text-red-700 dark:text-red-300">
                                            Delete {c.code}? Its redemption history goes too.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="flex-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 font-bold rounded-lg text-xs py-2"
                                            >
                                                Keep
                                            </button>
                                            <button
                                                onClick={() => deleteMutation.mutate(c.id)}
                                                disabled={deleteMutation.isPending}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs py-2 disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showEditor && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" onClick={closeEditor}>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                                {editing ? `Edit ${editing.code}` : 'New Discount Code'}
                            </h3>
                            <button
                                onClick={closeEditor}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">
                                        Code *
                                    </label>
                                    <input
                                        value={form.code}
                                        onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                        placeholder="SHOWTIME10"
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Customers can type it in any case.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5">
                                        Internal note
                                    </label>
                                    <input
                                        value={form.description}
                                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Launch week promo"
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                        <input
                                            type="checkbox"
                                            checked={form.limitUses}
                                            onChange={e => setForm(p => ({ ...p, limitUses: e.target.checked }))}
                                            className="w-4 h-4 accent-sffl-red"
                                        />
                                        Limit uses
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.maxUses}
                                        onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                                        disabled={!form.limitUses}
                                        placeholder="Unlimited"
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red disabled:opacity-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                        <input
                                            type="checkbox"
                                            checked={form.hasExpiry}
                                            onChange={e => setForm(p => ({ ...p, hasExpiry: e.target.checked }))}
                                            className="w-4 h-4 accent-sffl-red"
                                        />
                                        Set expiry
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={form.expiresAt}
                                        onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                                        disabled={!form.hasExpiry}
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red disabled:opacity-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                        Who can use it
                                    </label>
                                    <select
                                        value={form.audience}
                                        onChange={e => setForm(p => ({ ...p, audience: e.target.value as DiscountAudience }))}
                                        className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                    >
                                        <option value="all">Everyone (guests + signed in)</option>
                                        <option value="authenticated">Signed-in customers only</option>
                                        <option value="guest">Guest checkouts only</option>
                                    </select>
                                </div>
                            </div>

                            <label className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer">
                                <div>
                                    <span className="block text-sm font-bold text-gray-800 dark:text-white">Active</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Turn off to pause the code without deleting it.
                                    </span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                                    className="w-5 h-5 accent-sffl-red"
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
                                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                                            {i.name}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {i.entity_type === 'ticket_tier' ? 'Ticket tier' : 'Product'} ·
                                                            ₦{i.price.toLocaleString()}
                                                            {off > 0 && (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    {' '}→ ₦{after.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <span className="text-xs font-bold text-gray-400">₦</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={i.amount_off}
                                                            onChange={e => setItemAmount(key, e.target.value)}
                                                            placeholder="0"
                                                            className="w-24 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                                        />
                                                        <button
                                                            onClick={() => removeTarget(key)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                                                            title="Remove"
                                                        >
                                                            <XMarkIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                    <div className="relative border-b border-gray-100 dark:border-gray-700">
                                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={targetSearch}
                                            onChange={e => setTargetSearch(e.target.value)}
                                            placeholder="Search products and ticket tiers to add..."
                                            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                        {availableTargets.length === 0 ? (
                                            <p className="px-3 py-4 text-xs text-gray-400 text-center">
                                                {targets.length === 0 ? 'Loading items...' : 'Nothing left to add.'}
                                            </p>
                                        ) : (
                                            availableTargets.map(t => (
                                                <button
                                                    key={`${t.entity_type}:${t.entity_id}`}
                                                    onClick={() => addTarget(t)}
                                                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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

                        <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/90">
                            <button
                                onClick={closeEditor}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl text-sm transition-colors border border-gray-200 dark:border-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending}
                                className="flex-[2] bg-sffl-red hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
