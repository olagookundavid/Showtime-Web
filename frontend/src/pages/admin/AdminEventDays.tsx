import { Loader } from '../../components/ui/Loader';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    CalendarDaysIcon,
    CheckIcon,
    EyeIcon,
    EyeSlashIcon,
    InformationCircleIcon,
    LockClosedIcon,
    MapPinIcon,
    PencilSquareIcon,
    PlusIcon,
    TicketIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    listEventDays,
    createEventDay,
    updateEventDay,
    deleteEventDay,
    createTier,
    updateTicketTier,
    deleteTicketTier,
    type EventDayResponse,
    type TicketTierResponse,
} from '../../services/api';
import { AllocationsManager } from '../../components/admin/AllocationsManager';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { useDebounced } from '../../hooks/useDebounced';
import { getApiErrorMessage } from '../../utils/apiError';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

type EventDayPayload = Parameters<typeof updateEventDay>[1];
type TierPayload = Parameters<typeof updateTicketTier>[2];

type PendingAction =
    | { kind: 'createEventDay' }
    | { kind: 'createTier'; eventDay: EventDayResponse }
    | { kind: 'toggle'; eventDay: EventDayResponse }
    | { kind: 'delete'; eventDay: EventDayResponse }
    | { kind: 'deleteTier'; eventDay: EventDayResponse; tier: TicketTierResponse }
    | { kind: 'updateEventDay'; eventDay: EventDayResponse; payload: EventDayPayload }
    | { kind: 'updateTier'; eventDayId: string; tier: TicketTierResponse; payload: TierPayload };

const FAILURE: Record<PendingAction['kind'], string> = {
    createEventDay: 'Failed to create event day',
    createTier: 'Failed to create tier',
    toggle: 'Failed to update',
    delete: 'Failed to delete',
    deleteTier: 'Failed to delete tier. Ensure no tickets have been sold for this tier.',
    updateEventDay: 'Failed to update event day',
    updateTier: 'Failed to update ticket tier',
};

const formatDay = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatCapacity = (capacity?: number) => (capacity ? String(capacity) : 'Unlimited');

const visibilityLabel = (hidden?: boolean, code?: string) => (hidden ? `Hidden (code ${code || 'none'})` : 'Public');

const modalInputClass = 'w-full min-h-11 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red';
const modalLabelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5';

// ─── Shared modal frame ─────────────────────────────────────────────────────

interface ModalFrameProps {
    title: string;
    subtitle: string;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    submitDisabled: boolean;
    children: React.ReactNode;
}

const ModalFrame = ({ title, subtitle, onClose, onSubmit, submitDisabled, children }: ModalFrameProps) => (
    <div className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden" data-dialog>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                    <h2 className="text-xl font-black text-sffl-navy dark:text-white">{title}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 wrap-break-word">{subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                >
                    <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                    {children}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 min-h-11 text-sm font-bold bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitDisabled}
                        className="px-5 py-2.5 min-h-11 text-sm font-bold bg-sffl-red hover:bg-[#A52323] text-white rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    </div>
);

// ─── Edit Event Day Modal ───────────────────────────────────────────────────

interface EditEventDayModalProps {
    eventDay: EventDayResponse;
    pending: boolean;
    onClose: () => void;
    onSubmit: (payload: EventDayPayload) => void;
}

// Mounted per event day (keyed by id), so the form starts from that record.
const EditEventDayModal = ({ eventDay, pending, onClose, onSubmit }: EditEventDayModalProps) => {
    const [title, setTitle] = useState(eventDay.title || '');
    const [date, setDate] = useState(eventDay.date || '');
    const [venue, setVenue] = useState(eventDay.venue || '');
    const [isActive, setIsActive] = useState(Boolean(eventDay.is_active));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        const trimmedDate = date.trim();
        if (!trimmedTitle) {
            toast.error('Event title is required');
            return;
        }
        if (!trimmedDate) {
            toast.error('Event date is required');
            return;
        }
        onSubmit({
            title: trimmedTitle,
            date: trimmedDate,
            venue: venue.trim() || undefined,
            is_active: isActive,
        });
    };

    return (
        <ModalFrame
            title="Edit Event Day"
            subtitle="Update title, date, venue, or public visibility"
            onClose={onClose}
            onSubmit={handleSubmit}
            submitDisabled={pending || !title.trim() || !date.trim()}
        >
            <div>
                <label className={modalLabelClass}>
                    Title <span className="text-sffl-red">*</span>
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. SFFL Game Day 5"
                    required
                    className={modalInputClass}
                />
            </div>

            <div>
                <label className={modalLabelClass}>
                    Date <span className="text-sffl-red">*</span>
                </label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className={modalInputClass}
                />
            </div>

            <div>
                <label className={modalLabelClass}>Venue</label>
                <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Showtime Arena"
                    className={modalInputClass}
                />
            </div>

            <div className="pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 shrink-0 rounded text-sffl-red focus:ring-sffl-red border-gray-300 dark:border-gray-600"
                    />
                    <div className="min-w-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-white block">
                            Publicly Visible
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            When checked, this event day and its tickets appear on the public ticketing page
                        </span>
                    </div>
                </label>
            </div>
        </ModalFrame>
    );
};

// ─── Edit Ticket Tier Modal ─────────────────────────────────────────────────

interface EditTierModalProps {
    tier: TicketTierResponse;
    pending: boolean;
    onClose: () => void;
    onSubmit: (payload: TierPayload) => void;
}

// Mounted per tier (keyed by id), so the form starts from that record.
const EditTierModal = ({ tier, pending, onClose, onSubmit }: EditTierModalProps) => {
    const [name, setName] = useState(tier.name || '');
    const [price, setPrice] = useState(String(tier.price ?? ''));
    const [capacity, setCapacity] = useState(String(tier.capacity ?? '0'));
    const [description, setDescription] = useState(tier.description || '');
    const [isHidden, setIsHidden] = useState(Boolean(tier.is_hidden));
    const [accessCode, setAccessCode] = useState(tier.access_code || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('Tier name is required');
            return;
        }

        const numPrice = parseInt(price, 10);
        if (isNaN(numPrice) || numPrice < 0) {
            toast.error('Valid price (0 or greater) is required');
            return;
        }

        const numCapacity = capacity ? parseInt(capacity, 10) : 0;
        if (isNaN(numCapacity) || numCapacity < 0) {
            toast.error('Capacity must be 0 (unlimited) or greater');
            return;
        }

        if (numCapacity > 0 && numCapacity < tier.sold_count) {
            toast.error(`Capacity cannot be less than tickets already sold (${tier.sold_count})`);
            return;
        }

        if (isHidden && !accessCode.trim()) {
            toast.error('Access code is required for hidden tiers');
            return;
        }

        onSubmit({
            name: trimmedName,
            price: numPrice,
            capacity: numCapacity,
            description: description.trim() || undefined,
            is_hidden: isHidden,
            access_code: isHidden ? accessCode.trim().toUpperCase() : '',
        });
    };

    return (
        <ModalFrame
            title="Edit Ticket Tier"
            subtitle={`${tier.name} · ${tier.sold_count} sold`}
            onClose={onClose}
            onSubmit={handleSubmit}
            submitDisabled={pending || !name.trim() || !price}
        >
            {tier.sold_count > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span><strong>{tier.sold_count}</strong> ticket(s) already sold. Price modifications will apply to future sales only.</span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={modalLabelClass}>
                        Tier Name <span className="text-sffl-red">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. VIP"
                        required
                        className={modalInputClass}
                    />
                </div>

                <div>
                    <label className={modalLabelClass}>
                        Price (₦) <span className="text-sffl-red">*</span>
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="5000"
                        required
                        className={modalInputClass}
                    />
                </div>
            </div>

            <div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                        Capacity (0 = Unlimited)
                    </label>
                    {tier.sold_count > 0 && (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            Min allowed: {tier.sold_count}
                        </span>
                    )}
                </div>
                <input
                    type="number"
                    min={tier.sold_count > 0 ? tier.sold_count : 0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="0 for unlimited"
                    className={modalInputClass}
                />
            </div>

            <div>
                <label className={modalLabelClass}>Description</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. VIP seating + refreshments"
                    className={modalInputClass}
                />
            </div>

            <div className="pt-2 space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <input
                        type="checkbox"
                        checked={isHidden}
                        onChange={(e) => setIsHidden(e.target.checked)}
                        className="w-4 h-4 shrink-0 rounded text-sffl-red focus:ring-sffl-red border-gray-300 dark:border-gray-600"
                    />
                    <div className="min-w-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-white block">
                            Hidden Tier (Requires Access Code)
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Tier is only visible on public site when visitors provide the access code
                        </span>
                    </div>
                </label>

                {isHidden && (
                    <div className="animate-in fade-in duration-150">
                        <label className={modalLabelClass}>
                            Access Code <span className="text-sffl-red">*</span>
                        </label>
                        <input
                            type="text"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                            placeholder="e.g. SFFLVIP"
                            required={isHidden}
                            className={`${modalInputClass} font-mono uppercase`}
                        />
                    </div>
                )}
            </div>
        </ModalFrame>
    );
};

const inlineInputClass = 'w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-sffl-red';

export const AdminEventDays = () => {
    const queryClient = useQueryClient();

    // This list grows by a match day forever, so it is paged and searched on
    // the server rather than fetched whole and filtered here.
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounced(searchInput);
    const [page, setPage] = useState(1);
    useEffect(() => { setPage(1); }, [search]);

    const { data, isLoading: loading } = useQuery({
        queryKey: ['adminEventDaysList', search, page],
        queryFn: () => listEventDays({ search, page, limit: 20 }),
        placeholderData: (prev) => prev,
    });

    const eventDays: EventDayResponse[] = data?.data ?? [];
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [addTierFor, setAddTierFor] = useState<string | null>(null);
    const [manageAllocationsFor, setManageAllocationsFor] = useState<string | null>(null);

    // Edit modal states
    const [editingEventDay, setEditingEventDay] = useState<EventDayResponse | null>(null);
    const [editingTier, setEditingTier] = useState<{ eventDayId: string; tier: TicketTierResponse } | null>(null);

    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    // Create Event Day form
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newVenue, setNewVenue] = useState('');

    // Create Tier form
    const [tierName, setTierName] = useState('');
    const [tierPrice, setTierPrice] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierDesc, setTierDesc] = useState('');
    const [isHidden, setIsHidden] = useState(false);
    const [accessCode, setAccessCode] = useState('');

    const resetTierForm = () => {
        setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); setIsHidden(false); setAccessCode('');
    };

    const requestCreateEventDay = () => {
        if (!newTitle.trim() || !newDate) return;
        setPendingAction({ kind: 'createEventDay' });
    };

    const requestCreateTier = (eventDay: EventDayResponse) => {
        if (!tierName.trim() || !tierPrice) return;
        const price = parseInt(tierPrice, 10);
        if (isNaN(price) || price < 0) {
            toast.error('Valid price (0 or greater) is required');
            return;
        }
        if (tierCapacity && (isNaN(parseInt(tierCapacity, 10)) || parseInt(tierCapacity, 10) < 0)) {
            toast.error('Capacity must be 0 (unlimited) or greater');
            return;
        }
        if (isHidden && !accessCode.trim()) {
            toast.error('Access code is required for hidden tiers');
            return;
        }
        setPendingAction({ kind: 'createTier', eventDay });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            switch (action.kind) {
                case 'createEventDay':
                    await createEventDay({ title: newTitle.trim(), date: newDate, venue: newVenue.trim() || undefined });
                    setNewTitle(''); setNewDate(''); setNewVenue('');
                    setShowCreateForm(false);
                    toast.success('Event day created successfully');
                    break;
                case 'createTier':
                    await createTier(action.eventDay.id, {
                        name: tierName.trim(),
                        price: parseInt(tierPrice, 10),
                        capacity: tierCapacity ? parseInt(tierCapacity, 10) : undefined,
                        description: tierDesc || undefined,
                        is_hidden: isHidden,
                        access_code: isHidden ? accessCode.trim().toUpperCase() : undefined,
                    });
                    resetTierForm();
                    setAddTierFor(null);
                    toast.success('Tier created successfully');
                    break;
                case 'toggle':
                    await updateEventDay(action.eventDay.id, { is_active: !action.eventDay.is_active });
                    toast.success(action.eventDay.is_active ? 'Event day hidden from public site' : 'Event day visible on public site');
                    break;
                case 'delete':
                    await deleteEventDay(action.eventDay.id);
                    toast.success('Event day deleted');
                    break;
                case 'deleteTier':
                    await deleteTicketTier(action.eventDay.id, action.tier.id);
                    toast.success('Tier deleted');
                    break;
                case 'updateEventDay':
                    await updateEventDay(action.eventDay.id, action.payload);
                    setEditingEventDay(null);
                    toast.success('Event day updated successfully');
                    break;
                case 'updateTier':
                    await updateTicketTier(action.eventDayId, action.tier.id, action.payload);
                    setEditingTier(null);
                    toast.success('Ticket tier updated successfully');
                    break;
            }
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err) {
            toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'createTier': {
                const { eventDay } = pendingAction;
                return {
                    title: 'Add this ticket tier?',
                    description: undefined,
                    confirmLabel: 'Add Tier',
                    tone: 'info' as const,
                    icon: TicketIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Event', eventDay.title],
                            ['Tier', tierName.trim()],
                            ['Price', `₦${(parseInt(tierPrice, 10) || 0).toLocaleString()}`],
                            ['Capacity', formatCapacity(parseInt(tierCapacity, 10) || 0)],
                            ['Visibility', visibilityLabel(isHidden, accessCode.trim().toUpperCase())],
                        ]} />
                    ),
                };
            }
            case 'toggle': {
                const { eventDay } = pendingAction;
                return {
                    title: eventDay.is_active ? 'Hide this event day?' : 'Make this event day visible?',
                    description: eventDay.is_active
                        ? 'It and its tickets disappear from the public ticketing page.'
                        : 'It and its tickets appear on the public ticketing page.',
                    confirmLabel: eventDay.is_active ? 'Hide Event Day' : 'Make Visible',
                    tone: 'info' as const,
                    icon: eventDay.is_active ? EyeSlashIcon : EyeIcon,
                    body: <ConfirmSummary rows={[['Event', eventDay.title], ['Date', formatDay(eventDay.date)]]} />,
                };
            }
            case 'delete': {
                const { eventDay } = pendingAction;
                return {
                    title: 'Delete this event day?',
                    description: 'This deletes the event day and all its tiers. It cannot be undone.',
                    confirmLabel: 'Delete Event Day',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Event', eventDay.title],
                            ['Date', formatDay(eventDay.date)],
                            ['Tiers', String(eventDay.tiers?.length ?? 0)],
                        ]} />
                    ),
                };
            }
            case 'deleteTier': {
                const { eventDay, tier } = pendingAction;
                return {
                    title: 'Delete this ticket tier?',
                    description: 'This only works if no tickets have been sold for it.',
                    confirmLabel: 'Delete Tier',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Event', eventDay.title],
                            ['Tier', tier.name],
                            ['Sold', String(tier.sold_count)],
                        ]} />
                    ),
                };
            }
            case 'updateEventDay': {
                const { payload } = pendingAction;
                return {
                    title: 'Save changes to this event day?',
                    description: undefined,
                    confirmLabel: 'Save Changes',
                    tone: 'info' as const,
                    icon: PencilSquareIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Title', payload.title],
                            ['Date', payload.date ? formatDay(payload.date) : undefined],
                            ['Venue', payload.venue],
                            ['Visibility', payload.is_active ? 'Public' : 'Hidden'],
                        ]} />
                    ),
                };
            }
            case 'updateTier': {
                const { payload } = pendingAction;
                return {
                    title: 'Save changes to this tier?',
                    description: undefined,
                    confirmLabel: 'Save Changes',
                    tone: 'info' as const,
                    icon: PencilSquareIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Tier', payload.name],
                            ['Price', `₦${(payload.price ?? 0).toLocaleString()}`],
                            ['Capacity', formatCapacity(payload.capacity)],
                            ['Visibility', visibilityLabel(payload.is_hidden, payload.access_code)],
                        ]} />
                    ),
                };
            }
            default:
                return {
                    title: 'Create this event day?',
                    description: undefined,
                    confirmLabel: 'Create Event Day',
                    tone: 'info' as const,
                    icon: CalendarDaysIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Title', newTitle.trim()],
                            ['Date', newDate ? formatDay(newDate) : undefined],
                            ['Venue', newVenue.trim()],
                        ]} />
                    ),
                };
        }
    })();

    const tierPresets = [
        { name: 'Regular', price: 5000, desc: 'General admission' },
        { name: 'VIP', price: 15000, desc: 'VIP seating + refreshments' },
        { name: 'VVIP', price: 30000, desc: 'Premium lounge + meet the players' },
        { name: 'Free', price: 0, desc: 'Complimentary Access' },
    ];

    const headerButtonClass = 'px-3 py-2 min-h-11 text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer';

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Event Days"
                subtitle="Manage event dates, venues, ticket tiers, and allocations."
                actions={
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                        {showCreateForm ? (
                            <><XMarkIcon className="w-4 h-4" aria-hidden="true" /> Cancel</>
                        ) : (
                            <><PlusIcon className="w-4 h-4" aria-hidden="true" /> New Event Day</>
                        )}
                    </button>
                }
            />

            {/* Create Event Day Form */}
            {showCreateForm && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in duration-200">
                    <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Create New Event Day</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g. SFFL Game Day 5"
                                className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Date *</label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Venue</label>
                            <input
                                type="text"
                                value={newVenue}
                                onChange={(e) => setNewVenue(e.target.value)}
                                placeholder="e.g. Showtime Arena"
                                className="w-full min-h-11 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                    </div>
                    <button
                        onClick={requestCreateEventDay}
                        disabled={busy || !newTitle.trim() || !newDate}
                        className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 w-full sm:w-auto bg-sffl-navy text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <CheckIcon className="w-4 h-4" aria-hidden="true" />
                        Create Event Day
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search event days by title or date"
                    aria-label="Search event days"
                    className="w-full sm:max-w-md min-h-11 px-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-sffl-red"
                />
                {data && (
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {data.total} event day{data.total === 1 ? '' : 's'}
                        {search ? ` matching "${search}"` : ''}
                    </p>
                )}
            </div>

            {/* Event Days List */}
            {loading ? (
                <Loader />
            ) : eventDays.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700">
                    <CalendarDaysIcon className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
                        {search ? 'No event days match that search' : 'No event days yet'}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                        {search
                            ? 'Try a different title or date.'
                            : 'Create your first event day to start selling tickets'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {eventDays.map((ed) => {
                        const isPast = new Date(ed.date + 'T23:59:59') < new Date();
                        return (
                            <div key={ed.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border ${isPast ? 'border-gray-300 dark:border-gray-600' : 'border-gray-100 dark:border-gray-700'}`}>
                                {/* Header */}
                                <div className="bg-sffl-navy text-white p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <h3 className="text-lg md:text-xl font-black truncate min-w-0 max-w-full">{ed.title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ed.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                                                {ed.is_active ? 'Visible' : 'Hidden'}
                                            </span>
                                            {isPast && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/30 text-gray-300 border border-gray-500/30">Past</span>}
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1.5">
                                            <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                                                <CalendarDaysIcon className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
                                                {formatDay(ed.date)}
                                            </p>
                                            {ed.venue && (
                                                <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5 min-w-0">
                                                    <MapPinIcon className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
                                                    <span className="truncate">{ed.venue}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => setEditingEventDay(ed)}
                                            className={`${headerButtonClass} border-white/20 bg-white/10 hover:bg-white/20 text-white`}
                                        >
                                            <PencilSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            onClick={() => setPendingAction({ kind: 'toggle', eventDay: ed })}
                                            className={`${headerButtonClass} ${ed.is_active ? 'bg-emerald-600 text-white border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'}`}
                                            title={ed.is_active ? 'Visible on Public Site' : 'Hidden from Public Site'}
                                        >
                                            {ed.is_active ? (
                                                <><EyeIcon className="w-3.5 h-3.5" aria-hidden="true" /> Visible</>
                                            ) : (
                                                <><EyeSlashIcon className="w-3.5 h-3.5" aria-hidden="true" /> Hidden</>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => { setAddTierFor(addTierFor === ed.id ? null : ed.id); setManageAllocationsFor(null); }}
                                            className={`${headerButtonClass} ${addTierFor === ed.id ? 'bg-sffl-red text-white border-transparent' : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'}`}
                                        >
                                            {addTierFor === ed.id ? (
                                                <><XMarkIcon className="w-3.5 h-3.5" aria-hidden="true" /> Cancel Tier</>
                                            ) : (
                                                <><PlusIcon className="w-3.5 h-3.5" aria-hidden="true" /> Add Tier</>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => { setManageAllocationsFor(manageAllocationsFor === ed.id ? null : ed.id); setAddTierFor(null); }}
                                            className={`${headerButtonClass} ${manageAllocationsFor === ed.id ? 'bg-sffl-red text-white border-transparent' : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'}`}
                                        >
                                            Allocations
                                        </button>

                                        {isPast && (
                                            <button
                                                onClick={() => setPendingAction({ kind: 'delete', eventDay: ed })}
                                                className={`${headerButtonClass} border-transparent bg-red-600/80 hover:bg-red-600 text-white`}
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Tiers */}
                                <div className="p-4 sm:p-5">
                                    {ed.tiers && ed.tiers.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {ed.tiers.map((tier: TicketTierResponse) => (
                                                <div key={tier.id} className="bg-gray-50 dark:bg-gray-700/80 rounded-xl p-4 border border-gray-200 dark:border-gray-600 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="min-w-0">
                                                                <span className="font-bold text-sffl-navy dark:text-white block truncate">{tier.name}</span>
                                                                <p className="text-xl font-black text-sffl-red mt-1">₦{tier.price.toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                                                                    {tier.capacity > 0 ? (
                                                                        <>
                                                                            <p>{tier.sold_count} / {tier.capacity} sold</p>
                                                                            <p className="font-bold text-gray-700 dark:text-gray-200">{tier.available} left</p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <p>{tier.sold_count} sold</p>
                                                                            <p className="font-bold text-gray-700 dark:text-gray-200">Unlimited</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingTier({ eventDayId: ed.id, tier })}
                                                                        className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
                                                                        aria-label={`Edit tier ${tier.name}`}
                                                                    >
                                                                        <PencilSquareIcon className="w-5 h-5" aria-hidden="true" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPendingAction({ kind: 'deleteTier', eventDay: ed, tier })}
                                                                        className="min-h-11 min-w-11 flex items-center justify-center text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors cursor-pointer"
                                                                        aria-label={`Delete tier ${tier.name}`}
                                                                    >
                                                                        <TrashIcon className="w-5 h-5" aria-hidden="true" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {tier.description && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{tier.description}</p>
                                                        )}
                                                    </div>

                                                    {tier.is_hidden && (
                                                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600/60">
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                                                <LockClosedIcon className="w-3 h-3" aria-hidden="true" />
                                                                Code: {tier.access_code || 'None'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No tiers yet — add one to start selling tickets</p>
                                    )}

                                    {/* Add Tier Form (inline) */}
                                    {addTierFor === ed.id && (
                                        <div className="mt-4 p-4 sm:p-5 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 animate-in fade-in duration-200">
                                            <h4 className="font-bold text-sffl-navy dark:text-white mb-3 wrap-break-word">Add Ticket Tier to {ed.title}</h4>

                                            {/* Quick presets */}
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {tierPresets.map(p => (
                                                    <button
                                                        key={p.name}
                                                        type="button"
                                                        onClick={() => { setTierName(p.name); setTierPrice(String(p.price)); setTierDesc(p.desc); }}
                                                        className="px-3.5 min-h-11 text-xs font-bold bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-full shadow-sm hover:shadow-md hover:bg-gray-100 dark:hover:bg-gray-500 transition-all cursor-pointer"
                                                    >
                                                        {p.name} (₦{p.price.toLocaleString()})
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <input type="text" value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name *" aria-label="Tier name" className={inlineInputClass} />
                                                <input type="number" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} placeholder="Price (₦) *" aria-label="Price" className={inlineInputClass} />
                                                <input type="number" value={tierCapacity} onChange={(e) => setTierCapacity(e.target.value)} placeholder="Capacity (0=unlimited)" aria-label="Capacity" className={inlineInputClass} />
                                                <input type="text" value={tierDesc} onChange={(e) => setTierDesc(e.target.value)} placeholder="Description" aria-label="Description" className={inlineInputClass} />
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-3">
                                                <label className="flex items-center gap-2 min-h-11 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                    <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} className="rounded text-sffl-red focus:ring-sffl-red border-gray-300" />
                                                    Hidden Tier? (Requires Code)
                                                </label>
                                                {isHidden && (
                                                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} placeholder="Access Code (e.g. SFFLFREE)" aria-label="Access code" className={`${inlineInputClass} sm:w-auto uppercase font-mono`} />
                                                )}
                                            </div>
                                            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => { setAddTierFor(null); resetTierForm(); }}
                                                    className="px-4 py-2 min-h-11 text-sm font-bold text-gray-500 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => requestCreateTier(ed)}
                                                    disabled={busy || !tierName.trim() || !tierPrice}
                                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 bg-sffl-navy text-white rounded-lg shadow-sm hover:shadow-md text-sm font-bold hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                                                >
                                                    <CheckIcon className="w-4 h-4" aria-hidden="true" />
                                                    Add Tier
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Allocations Manager */}
                                    {manageAllocationsFor === ed.id && (
                                        <div className="mt-4 animate-in fade-in duration-200">
                                            <AllocationsManager eventDayId={ed.id} eventDayTitle={ed.title} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {data && data.total_pages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Page {data.page || page} of {data.total_pages} · {data.total} total
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 min-h-11 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                            disabled={page >= data.total_pages}
                            className="px-4 min-h-11 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Event Day Modal */}
            {editingEventDay && (
                <EditEventDayModal
                    key={editingEventDay.id}
                    eventDay={editingEventDay}
                    pending={busy}
                    onClose={() => setEditingEventDay(null)}
                    onSubmit={(payload) => setPendingAction({ kind: 'updateEventDay', eventDay: editingEventDay, payload })}
                />
            )}

            {/* Edit Ticket Tier Modal */}
            {editingTier && (
                <EditTierModal
                    key={editingTier.tier.id}
                    tier={editingTier.tier}
                    pending={busy}
                    onClose={() => setEditingTier(null)}
                    onSubmit={(payload) => setPendingAction({ kind: 'updateTier', eventDayId: editingTier.eventDayId, tier: editingTier.tier, payload })}
                />
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
