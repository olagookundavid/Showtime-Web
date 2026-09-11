import { Loader } from '../../components/ui/Loader';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    PencilSquareIcon,
    XMarkIcon,
    TrashIcon,
    LockClosedIcon,
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
import { useDebounced } from '../../hooks/useDebounced';

// ─── Edit Event Day Modal ───────────────────────────────────────────────────

interface EditEventDayModalProps {
    eventDay: EventDayResponse | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EditEventDayModal = ({ eventDay, isOpen, onClose, onSuccess }: EditEventDayModalProps) => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [venue, setVenue] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (eventDay) {
            setTitle(eventDay.title || '');
            setDate(eventDay.date || '');
            setVenue(eventDay.venue || '');
            setIsActive(Boolean(eventDay.is_active));
        }
    }, [eventDay]);

    if (!isOpen || !eventDay) return null;

    const handleSubmit = async (e: React.FormEvent) => {
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

        setSaving(true);
        try {
            await updateEventDay(eventDay.id, {
                title: trimmedTitle,
                date: trimmedDate,
                venue: venue.trim() || undefined,
                is_active: isActive,
            });
            toast.success('Event day updated successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.message || 'Failed to update event day');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-sffl-navy dark:text-white">Edit Event Day</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Update title, date, venue, or public visibility</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit}>
                    <div className="p-5 md:p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                Title <span className="text-sffl-red">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. SFFL Game Day 5"
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                Date <span className="text-sffl-red">*</span>
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                Venue
                            </label>
                            <input
                                type="text"
                                value={venue}
                                onChange={(e) => setVenue(e.target.value)}
                                placeholder="e.g. Showtime Arena"
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="w-4 h-4 rounded text-sffl-red focus:ring-sffl-red border-gray-300 dark:border-gray-600"
                                />
                                <div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white block">
                                        Publicly Visible
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        When checked, this event day and its tickets appear on the public ticketing page
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !title.trim() || !date.trim()}
                            className="px-5 py-2.5 text-sm font-bold bg-sffl-red hover:bg-[#A52323] text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Edit Ticket Tier Modal ─────────────────────────────────────────────────

interface EditTierModalProps {
    eventDayId: string | null;
    tier: TicketTierResponse | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EditTierModal = ({ eventDayId, tier, isOpen, onClose, onSuccess }: EditTierModalProps) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [capacity, setCapacity] = useState('');
    const [description, setDescription] = useState('');
    const [isHidden, setIsHidden] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (tier) {
            setName(tier.name || '');
            setPrice(String(tier.price ?? ''));
            setCapacity(String(tier.capacity ?? '0'));
            setDescription(tier.description || '');
            setIsHidden(Boolean(tier.is_hidden));
            setAccessCode(tier.access_code || '');
        }
    }, [tier]);

    if (!isOpen || !tier || !eventDayId) return null;

    const handleSubmit = async (e: React.FormEvent) => {
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

        setSaving(true);
        try {
            await updateTicketTier(eventDayId, tier.id, {
                name: trimmedName,
                price: numPrice,
                capacity: numCapacity,
                description: description.trim() || undefined,
                is_hidden: isHidden,
                access_code: isHidden ? accessCode.trim().toUpperCase() : '',
            });
            toast.success('Ticket tier updated successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.message || 'Failed to update ticket tier');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-sffl-navy dark:text-white">Edit Ticket Tier</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tier.name} · {tier.sold_count} sold</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit}>
                    <div className="p-5 md:p-6 space-y-4">
                        {tier.sold_count > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs flex items-center gap-2">
                                <span>ℹ️</span>
                                <span><strong>{tier.sold_count}</strong> ticket(s) already sold. Price modifications will apply to future sales only.</span>
                            </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                    Tier Name <span className="text-sffl-red">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. VIP"
                                    required
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                    Price (₦) <span className="text-sffl-red">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="5000"
                                    required
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
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
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. VIP seating + refreshments"
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div className="pt-2 space-y-3">
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                <input
                                    type="checkbox"
                                    checked={isHidden}
                                    onChange={(e) => setIsHidden(e.target.checked)}
                                    className="w-4 h-4 rounded text-sffl-red focus:ring-sffl-red border-gray-300 dark:border-gray-600"
                                />
                                <div>
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
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                                        Access Code <span className="text-sffl-red">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. SFFLVIP"
                                        required={isHidden}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-mono uppercase text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim() || !price}
                            className="px-5 py-2.5 text-sm font-bold bg-sffl-red hover:bg-[#A52323] text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

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

    // Create Event Day form
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newVenue, setNewVenue] = useState('');
    const [creating, setCreating] = useState(false);

    // Create Tier form
    const [tierName, setTierName] = useState('');
    const [tierPrice, setTierPrice] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierDesc, setTierDesc] = useState('');
    const [isHidden, setIsHidden] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [creatingTier, setCreatingTier] = useState(false);

    const handleCreateEventDay = async () => {
        if (!newTitle || !newDate) return;
        setCreating(true);
        try {
            await createEventDay({ title: newTitle, date: newDate, venue: newVenue || undefined });
            setNewTitle(''); setNewDate(''); setNewVenue('');
            setShowCreateForm(false);
            toast.success('Event day created successfully');
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create event day');
        } finally {
            setCreating(false);
        }
    };

    const handleCreateTier = async () => {
        if (!addTierFor || !tierName || !tierPrice) return;
        setCreatingTier(true);
        try {
            await createTier(addTierFor, {
                name: tierName,
                price: parseInt(tierPrice, 10),
                capacity: tierCapacity ? parseInt(tierCapacity, 10) : undefined,
                description: tierDesc || undefined,
                is_hidden: isHidden,
                access_code: isHidden ? accessCode.trim().toUpperCase() : undefined,
            });
            setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); setIsHidden(false); setAccessCode('');
            setAddTierFor(null);
            toast.success('Tier created successfully');
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create tier');
        } finally {
            setCreatingTier(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}" and all its tiers? This cannot be undone.`)) return;
        try {
            await deleteEventDay(id);
            toast.success('Event day deleted');
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete');
        }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            await updateEventDay(id, { is_active: !currentActive });
            toast.success(currentActive ? 'Event day hidden from public site' : 'Event day visible on public site');
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update');
        }
    };

    const handleDeleteTier = async (eventDayId: string, tierId: string, tierName: string) => {
        if (!confirm(`Delete ticket tier "${tierName}"? This only works if zero tickets have been sold.`)) return;
        try {
            await deleteTicketTier(eventDayId, tierId);
            toast.success('Tier deleted');
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete tier. Ensure no tickets have been sold for this tier.');
        }
    };

    const tierPresets = [
        { name: 'Regular', price: 5000, desc: 'General admission' },
        { name: 'VIP', price: 15000, desc: 'VIP seating + refreshments' },
        { name: 'VVIP', price: 30000, desc: 'Premium lounge + meet the players' },
        { name: 'Free', price: 0, desc: 'Complimentary Access' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Event Days & Ticketing</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage event dates, venues, ticket tiers, and allocations</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                    {showCreateForm ? '✕ Cancel' : '+ New Event Day'}
                </button>
            </div>

            {/* Create Event Day Form */}
            {showCreateForm && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in duration-200">
                    <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Create New Event Day</h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g. SFFL Game Day 5"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Date *</label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Venue</label>
                            <input
                                type="text"
                                value={newVenue}
                                onChange={(e) => setNewVenue(e.target.value)}
                                placeholder="e.g. Showtime Arena"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCreateEventDay}
                        disabled={creating || !newTitle || !newDate}
                        className="mt-4 px-4 py-2 min-h-[44px] bg-sffl-navy text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        {creating ? 'Creating...' : '✅ Create Event Day'}
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search event days by title or date..."
                    className="w-full sm:max-w-md px-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-sffl-red"
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
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-6xl mb-4">📅</p>
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
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg md:text-xl font-black truncate max-w-[240px]">{ed.title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ed.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                                                {ed.is_active ? 'Visible' : 'Hidden'}
                                            </span>
                                            {isPast && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/30 text-gray-300 border border-gray-500/30">Past</span>}
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1.5">
                                            <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                                                <span className="opacity-70">📅</span> {new Date(ed.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            {ed.venue && (
                                                <p className="text-[11px] md:text-sm text-gray-300 font-medium flex items-center gap-1.5">
                                                    <span className="opacity-70">📍</span> {ed.venue}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => setEditingEventDay(ed)}
                                            className="px-3 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                                            title="Edit Event Day"
                                        >
                                            <PencilSquareIcon className="w-3.5 h-3.5" />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            onClick={() => handleToggleActive(ed.id, ed.is_active)}
                                            className={`px-3 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${ed.is_active ? 'bg-emerald-600 text-white border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'}`}
                                            title={ed.is_active ? 'Visible on Public Site' : 'Hidden from Public Site'}
                                        >
                                            {ed.is_active ? (
                                                <><span className="text-xs">👁️</span> Visible</>
                                            ) : (
                                                <><span className="text-xs">👁️‍🗨️</span> Hidden</>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => { setAddTierFor(addTierFor === ed.id ? null : ed.id); setManageAllocationsFor(null); }}
                                            className={`px-3 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center active:scale-95 cursor-pointer ${addTierFor === ed.id ? 'bg-sffl-red text-white border-transparent' : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'}`}
                                        >
                                            {addTierFor === ed.id ? '✕ Tiers' : '+ Tier'}
                                        </button>

                                        <button
                                            onClick={() => { setManageAllocationsFor(manageAllocationsFor === ed.id ? null : ed.id); setAddTierFor(null); }}
                                            className={`px-3 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${manageAllocationsFor === ed.id ? 'bg-sffl-red text-white border-transparent' : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'}`}
                                        >
                                            Allocations
                                        </button>

                                        {isPast && (
                                            <button
                                                onClick={() => handleDelete(ed.id, ed.title)}
                                                className="px-3 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm bg-red-600/80 hover:bg-red-600 text-white active:scale-95 transition-all text-center cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Tiers */}
                                <div className="p-5">
                                    {ed.tiers && ed.tiers.length > 0 ? (
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                                                        className="p-1.5 text-gray-500 hover:text-sffl-navy dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer"
                                                                        title="Edit Tier"
                                                                    >
                                                                        <PencilSquareIcon className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteTier(ed.id, tier.id, tier.name)}
                                                                        className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors cursor-pointer"
                                                                        title="Delete Tier"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
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
                                                                <LockClosedIcon className="w-3 h-3" />
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
                                        <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-600 animate-in fade-in duration-200">
                                            <h4 className="font-bold text-sffl-navy dark:text-white mb-3">Add Ticket Tier to {ed.title}</h4>

                                            {/* Quick presets */}
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {tierPresets.map(p => (
                                                    <button
                                                        key={p.name}
                                                        type="button"
                                                        onClick={() => { setTierName(p.name); setTierPrice(String(p.price)); setTierDesc(p.desc); }}
                                                        className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-full shadow-sm hover:shadow-md hover:bg-gray-100 dark:hover:bg-gray-500 transition-all cursor-pointer"
                                                    >
                                                        {p.name} (₦{p.price.toLocaleString()})
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="grid sm:grid-cols-4 gap-3">
                                                <input type="text" value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name *" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-sffl-red" />
                                                <input type="number" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} placeholder="Price (₦) *" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-sffl-red" />
                                                <input type="number" value={tierCapacity} onChange={(e) => setTierCapacity(e.target.value)} placeholder="Capacity (0=unlimited)" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-sffl-red" />
                                                <input type="text" value={tierDesc} onChange={(e) => setTierDesc(e.target.value)} placeholder="Description" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-sffl-red" />
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                    <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} className="rounded text-sffl-red focus:ring-sffl-red border-gray-300" />
                                                    Hidden Tier? (Requires Code)
                                                </label>
                                                {isHidden && (
                                                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} placeholder="Access Code (e.g. SFFLFREE)" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm uppercase font-mono" />
                                                )}
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={handleCreateTier}
                                                    disabled={creatingTier || !tierName || !tierPrice}
                                                    className="px-4 py-2 min-h-[44px] bg-sffl-navy text-white rounded-lg shadow-sm hover:shadow-md text-sm font-bold hover:bg-blue-900 transition-all cursor-pointer disabled:opacity-50"
                                                >
                                                    {creatingTier ? 'Creating...' : '✅ Add Tier'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setAddTierFor(null); setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); setIsHidden(false); setAccessCode(''); }}
                                                    className="px-4 py-2 min-h-[44px] text-sm font-bold text-gray-500 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
                                                >
                                                    Cancel
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
                <div className="mt-6 flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Page {data.page || page} of {data.total_pages} · {data.total} total
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                            disabled={page >= data.total_pages}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Event Day Modal */}
            <EditEventDayModal
                eventDay={editingEventDay}
                isOpen={Boolean(editingEventDay)}
                onClose={() => setEditingEventDay(null)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] })}
            />

            {/* Edit Ticket Tier Modal */}
            <EditTierModal
                eventDayId={editingTier?.eventDayId ?? null}
                tier={editingTier?.tier ?? null}
                isOpen={Boolean(editingTier)}
                onClose={() => setEditingTier(null)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] })}
            />
        </div>
    );
};
