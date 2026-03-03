import { Loader } from '../../components/ui/Loader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllEventDays, createEventDay, createTier, deleteEventDay, updateEventDay, type EventDayResponse, type TicketTierResponse } from '../../services/api';

export const AdminEventDays = () => {
    const queryClient = useQueryClient();

    const { data, isLoading: loading } = useQuery({
        queryKey: ['adminEventDaysList'],
        queryFn: getAllEventDays,
    });

    const eventDays: EventDayResponse[] = data || [];
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [addTierFor, setAddTierFor] = useState<string | null>(null);

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
            });
            setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc('');
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
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Event Days</h1>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-sffl-red text-white px-4 py-2 rounded-xl shadow-md hover:shadow-lg font-bold hover:bg-red-700 transition-all"
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
                        className="mt-4 bg-sffl-navy text-white px-5 py-2 rounded-xl shadow-md hover:shadow-lg font-bold hover:bg-blue-900 transition-all disabled:opacity-50"
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
                                {/* Header */}
                                <div className="bg-sffl-navy text-white p-5 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-black">{ed.title}</h3>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${ed.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {ed.is_active ? '● Active' : '○ Inactive'}
                                            </span>
                                            {isPast && <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-500/20 text-gray-300">Past</span>}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-1">
                                            📅 {new Date(ed.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                            {ed.venue && ` • 📍 ${ed.venue}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleToggleActive(ed.id, ed.is_active)}
                                            className="px-3 py-2 text-xs font-bold rounded-xl shadow-sm hover:shadow-md bg-white/10 hover:bg-white/20 transition-all"
                                        >
                                            {ed.is_active ? '🔴 Deactivate' : '🟢 Activate'}
                                        </button>
                                        <button
                                            onClick={() => setAddTierFor(addTierFor === ed.id ? null : ed.id)}
                                            className="px-3 py-2 text-xs font-bold rounded-xl shadow-sm hover:shadow-md bg-white/10 hover:bg-white/20 transition-all"
                                        >
                                            + Add Tier
                                        </button>
                                        {isPast && (
                                            <button
                                                onClick={() => handleDelete(ed.id, ed.title)}
                                                className="px-3 py-2 text-xs font-bold rounded-xl shadow-sm hover:shadow-md bg-red-600 hover:bg-red-700 transition-all"
                                            >
                                                🗑️ Delete
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
                                                        className="px-3 py-1 text-xs font-bold bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-full shadow-sm hover:shadow-md hover:bg-gray-100 transition-all"
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
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={handleCreateTier}
                                                    disabled={creatingTier || !tierName || !tierPrice}
                                                    className="bg-sffl-navy text-white px-4 py-1.5 rounded-xl shadow-md hover:shadow-lg text-sm font-bold hover:bg-blue-900 transition-all disabled:opacity-50"
                                                >
                                                    {creatingTier ? 'Creating...' : '✅ Add Tier'}
                                                </button>
                                                <button
                                                    onClick={() => { setAddTierFor(null); setTierName(''); setTierPrice(''); setTierCapacity(''); setTierDesc(''); }}
                                                    className="px-4 py-1.5 text-sm font-bold text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                                                >Cancel</button>
                                            </div>
                                        </div>
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
