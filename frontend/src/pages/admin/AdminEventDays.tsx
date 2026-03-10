import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllEventDays, createEventDay, createTier, deleteEventDay, updateEventDay, type EventDayResponse, type TicketTierResponse } from '../../services/api';
import { AllocationsManager } from '../../components/admin/AllocationsManager';

export const AdminEventDays = () => {
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useQuery({
        queryKey: ['adminEventDaysList'],
        queryFn: () => getAllEventDays(),
    });

    const eventDays: EventDayResponse[] = data || [];
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [addTierFor, setAddTierFor] = useState<string | null>(null);
    const [manageAllocationsFor, setManageAllocationsFor] = useState<string | null>(null);

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
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create event day');
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
                price: parseInt(tierPrice),
                capacity: tierCapacity ? parseInt(tierCapacity) : undefined,
                description: tierDesc || undefined,
                is_hidden: isHidden,
                access_code: isHidden ? accessCode : undefined,
            });
            setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); setIsHidden(false); setAccessCode('');
            setAddTierFor(null);
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create tier');
        } finally {
            setCreatingTier(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}" and all its tiers? This cannot be undone.`)) return;
        try {
            await deleteEventDay(id);
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete');
        }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            await updateEventDay(id, { is_active: !currentActive });
            queryClient.invalidateQueries({ queryKey: ['adminEventDaysList'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to update');
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
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Event Days</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="px-4 py-2 min-h-[44px] bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                >
                    {showCreateForm ? '✕ Cancel' : '+ New Event Day'}
                </button>
            </div>

            {/* Create Event Day Form */}
            {showCreateForm && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Create New Event Day</h2>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g. SFFL Game Day 5"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Date *</label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">Venue</label>
                            <input
                                type="text"
                                value={newVenue}
                                onChange={(e) => setNewVenue(e.target.value)}
                                placeholder="e.g. Showtime Arena"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCreateEventDay}
                        disabled={creating || !newTitle || !newDate}
                        className="mt-4 px-4 py-2 min-h-[44px] bg-sffl-navy text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        {creating ? 'Creating...' : '✅ Create Event Day'}
                    </button>
                </div>
            )}

            {/* Event Days List */}
            {loading ? (
                <Loader />
            ) : eventDays.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-lg">
                    <p className="text-6xl mb-4">📅</p>
                    <p className="text-gray-500 text-lg font-semibold">No event days yet</p>
                    <p className="text-gray-400 text-sm mt-2">Create your first event day to start selling tickets</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {eventDays.map((ed) => {
                        const isPast = new Date(ed.date + 'T23:59:59') < new Date();
                        return (
                            <div key={ed.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border ${isPast ? 'border-gray-300 dark:border-gray-600' : 'border-gray-100 dark:border-gray-700'}`}>
                                {/* Header - Mobile Optimized */}
                                <div className="bg-sffl-navy text-white p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg md:text-xl font-black truncate max-w-[200px]">{ed.title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ed.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {ed.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                            {isPast && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300">Past</span>}
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

                                    {/* Action Buttons Grid */}
                                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleToggleActive(ed.id, ed.is_active)}
                                            className="px-2 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-center"
                                        >
                                            {ed.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                            onClick={() => { setAddTierFor(addTierFor === ed.id ? null : ed.id); setManageAllocationsFor(null); }}
                                            className={`px-2 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center active:scale-95 ${addTierFor === ed.id ? 'bg-sffl-red text-white border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        >
                                            Tiers
                                        </button>
                                        <button
                                            onClick={() => { setManageAllocationsFor(manageAllocationsFor === ed.id ? null : ed.id); setAddTierFor(null); }}
                                            className={`px-2 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm border transition-all text-center active:scale-95 flex items-center justify-center gap-1 ${manageAllocationsFor === ed.id ? 'bg-purple-600 text-white border-transparent' : 'bg-purple-500/30 border-purple-500/30 hover:bg-purple-500/50'}`}
                                        >
                                            Allocations
                                        </button>
                                        {isPast && (
                                            <button
                                                onClick={() => handleDelete(ed.id, ed.title)}
                                                className="px-2 py-2 min-h-[36px] text-[10px] font-black uppercase tracking-tight rounded-lg shadow-sm bg-red-600/80 hover:bg-red-600 active:scale-95 transition-all text-center"
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
                                                <div key={tier.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="font-bold text-sffl-navy dark:text-white">{tier.name}</span>
                                                            <p className="text-xl font-black text-sffl-red mt-1">₦{tier.price.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right text-xs text-gray-500">
                                                            {tier.capacity > 0 ? (
                                                                <>
                                                                    <p>{tier.sold_count} / {tier.capacity} sold</p>
                                                                    <p className="font-bold">{tier.available} left</p>
                                                                </>
                                                            ) : (
                                                                <p>Unlimited</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {tier.description && <p className="text-xs text-gray-500 mt-2">{tier.description}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 text-sm text-center py-4">No tiers yet — add one to start selling tickets</p>
                                    )}

                                    {/* Add Tier Form (inline) */}
                                    {addTierFor === ed.id && (
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
                                            <h4 className="font-bold text-sffl-navy dark:text-white mb-3">Add Tier to {ed.title}</h4>

                                            {/* Quick presets */}
                                            <div className="flex gap-2 mb-3">
                                                {tierPresets.map(p => (
                                                    <button
                                                        key={p.name}
                                                        onClick={() => { setTierName(p.name); setTierPrice(String(p.price)); setTierDesc(p.desc); }}
                                                        className="px-4 py-2 min-h-[44px] text-xs font-bold bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-full shadow-sm hover:shadow-md hover:bg-gray-100 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="grid sm:grid-cols-4 gap-3">
                                                <input type="text" value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name *" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm" />
                                                <input type="number" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} placeholder="Price (₦) *" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm" />
                                                <input type="number" value={tierCapacity} onChange={(e) => setTierCapacity(e.target.value)} placeholder="Capacity (0=unlimited)" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm" />
                                                <input type="text" value={tierDesc} onChange={(e) => setTierDesc(e.target.value)} placeholder="Description" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm" />
                                            </div>

                                            <div className="flex items-center gap-4 mt-3">
                                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} className="rounded text-sffl-navy focus:ring-sffl-navy border-gray-300" />
                                                    Hidden Tier? (Requires Code)
                                                </label>
                                                {isHidden && (
                                                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Access Code (e.g. SFFLFREE)" className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm uppercase" />
                                                )}
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={handleCreateTier}
                                                    disabled={creatingTier || !tierName || !tierPrice}
                                                    className="px-4 py-2 min-h-[44px] bg-sffl-navy text-white rounded-lg shadow-sm hover:shadow-md text-sm font-bold hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                                >
                                                    {creatingTier ? 'Creating...' : '✅ Add Tier'}
                                                </button>
                                                <button
                                                    onClick={() => { setAddTierFor(null); setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); setIsHidden(false); setAccessCode(''); }}
                                                    className="px-4 py-2 min-h-[44px] text-sm font-bold text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                                                >Cancel</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Allocations Manager Form */}
                                    {manageAllocationsFor === ed.id && (
                                        <AllocationsManager eventDayId={ed.id} eventDayTitle={ed.title} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
