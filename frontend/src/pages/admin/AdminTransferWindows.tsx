import React, { useState, useEffect } from 'react';
import { adminTransfersApi, contractsApi, type TransferWindowData, type Player } from '../../services/api';
import toast from 'react-hot-toast';

const FREE_AGENTS_PER_PAGE = 24;

export const AdminTransferWindows: React.FC = () => {
    const [windows, setWindows] = useState<TransferWindowData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showModal, setShowModal] = useState<boolean>(false);

    // Free agents listed underneath the schedule.
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [freeAgentSearch, setFreeAgentSearch] = useState<string>('');
    const [freeAgentPage, setFreeAgentPage] = useState<number>(1);
    const [freeAgentTotal, setFreeAgentTotal] = useState<number>(0);
    const [freeAgentTotalPages, setFreeAgentTotalPages] = useState<number>(1);
    const [freeAgentsLoading, setFreeAgentsLoading] = useState<boolean>(true);

    // Form state
    const [name, setName] = useState<string>('');
    const [opensAt, setOpensAt] = useState<string>('');
    const [closesAt, setClosesAt] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Edit state
    const [editingWindow, setEditingWindow] = useState<TransferWindowData | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editOpensAt, setEditOpensAt] = useState<string>('');
    const [editClosesAt, setEditClosesAt] = useState<string>('');
    const [editIsActive, setEditIsActive] = useState<boolean>(true);

    const openEditModal = (w: TransferWindowData) => {
        setEditingWindow(w);
        setEditName(w.name);
        const formatLocal = (iso: string) => {
            const d = new Date(iso);
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setEditOpensAt(formatLocal(w.opens_at));
        setEditClosesAt(formatLocal(w.closes_at));
        setEditIsActive(w.is_active);
    };

    const handleUpdateWindow = async () => {
        if (!editingWindow) return;
        if (!editName || !editOpensAt || !editClosesAt) {
            toast.error('Please fill in all fields');
            return;
        }

        setSubmitting(true);
        try {
            await adminTransfersApi.updateWindow(editingWindow.id, {
                name: editName,
                opens_at: new Date(editOpensAt).toISOString(),
                closes_at: new Date(editClosesAt).toISOString(),
                is_active: editIsActive,
            });
            toast.success('Transfer window updated successfully');
            setEditingWindow(null);
            fetchWindows();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update transfer window');
        } finally {
            setSubmitting(false);
        }
    };

    const fetchWindows = async () => {
        setLoading(true);
        try {
            const res = await adminTransfersApi.getWindows();
            setWindows(res || []);
        } catch {
            toast.error('Failed to load transfer windows');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWindows();
    }, []);

    // Debounced so typing in the search box does not fire a request per keystroke.
    // Inlined rather than lifted out so the effect owns every value it reads.
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setFreeAgentsLoading(true);
            try {
                const res = await contractsApi.getFreeAgents({
                    search: freeAgentSearch,
                    page: freeAgentPage,
                    limit: FREE_AGENTS_PER_PAGE,
                });
                // A newer search may have superseded this one mid-flight.
                if (cancelled) return;
                setFreeAgents(res.data || []);
                setFreeAgentTotal(res.total || 0);
                setFreeAgentTotalPages(res.total_pages || 1);
            } catch {
                if (!cancelled) toast.error('Failed to load free agents');
            } finally {
                if (!cancelled) setFreeAgentsLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [freeAgentSearch, freeAgentPage]);

    // A new search term invalidates whatever page the admin was on.
    useEffect(() => {
        setFreeAgentPage(1);
    }, [freeAgentSearch]);

    const handleCreateWindow = async () => {
        if (!name || !opensAt || !closesAt) {
            toast.error('Please fill in all fields');
            return;
        }

        setSubmitting(true);
        try {
            await adminTransfersApi.createWindow({
                name,
                opens_at: new Date(opensAt).toISOString(),
                closes_at: new Date(closesAt).toISOString(),
                is_active: true,
            });
            toast.success('Transfer window created successfully');
            setShowModal(false);
            setName('');
            setOpensAt('');
            setClosesAt('');
            fetchWindows();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create transfer window');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (w: TransferWindowData) => {
        try {
            await adminTransfersApi.updateWindow(w.id, { is_active: !w.is_active });
            toast.success(`Window ${!w.is_active ? 'activated' : 'deactivated'}`);
            fetchWindows();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update window');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this transfer window record?')) return;
        try {
            await adminTransfersApi.deleteWindow(id);
            toast.success('Window deleted');
            fetchWindows();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to delete window');
        }
    };

    // Spent windows are hidden: once a window has closed it is a historical record,
    // not a schedule an admin acts on, and leaving them in buried the live one.
    const now = Date.now();
    const scheduledWindows = windows.filter(w => new Date(w.closes_at).getTime() >= now);
    const spentWindowCount = windows.length - scheduledWindows.length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Transfer Window Schedules</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure open/close date windows for league-wide buying and trading.</p>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                >
                    + Create Transfer Window
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading windows...</div>
                ) : scheduledWindows.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        {windows.length === 0
                            ? 'No transfer windows configured yet.'
                            : 'No current or upcoming transfer windows. Create one to reopen the market.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Window Name</th>
                                    <th className="p-4">Opens At</th>
                                    <th className="p-4">Closes At</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {scheduledWindows.map(w => (
                                    <tr key={w.id}>
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">{w.name}</td>
                                        <td className="p-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{new Date(w.opens_at).toLocaleString()}</td>
                                        <td className="p-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{new Date(w.closes_at).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                w.is_open
                                                    ? 'bg-green-100 text-green-700 animate-pulse'
                                                    : w.is_active
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {w.is_open ? 'OPEN NOW' : w.is_active ? 'ACTIVE SCHEDULE' : 'INACTIVE'}
                                            </span>
                                        </td>
                                         <td className="p-4 text-right space-x-2">
                                            <button
                                                onClick={() => openEditModal(w)}
                                                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-xs rounded-lg transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(w)}
                                                className="px-3 py-1 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 font-bold text-xs rounded-lg transition-colors"
                                            >
                                                {w.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(w.id)}
                                                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold text-xs rounded-lg transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {spentWindowCount > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                    {spentWindowCount} closed {spentWindowCount === 1 ? 'window is' : 'windows are'} hidden from this schedule.
                </p>
            )}

            {/* Free agents — players with no active contract, available to any club. */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-black text-sffl-navy dark:text-white uppercase tracking-wider">
                            Free Agents {!freeAgentsLoading && <span className="text-gray-400">({freeAgentTotal})</span>}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Players with no active contract. Any club can sign them while a window is open.
                        </p>
                    </div>
                    <input
                        type="text"
                        value={freeAgentSearch}
                        onChange={e => setFreeAgentSearch(e.target.value)}
                        placeholder="Search by name or position…"
                        className="w-full sm:w-64 min-h-[40px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
                    />
                </div>

                {freeAgentsLoading ? (
                    <div className="p-12 text-center text-gray-400">Loading free agents...</div>
                ) : freeAgents.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        {freeAgentSearch ? 'No free agents match that search.' : 'No free agents — every player holds an active contract.'}
                    </div>
                ) : (
                    <>
                        <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {freeAgents.map(p => (
                                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                    {p.image ? (
                                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-sffl-navy/10 text-sffl-navy dark:text-blue-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                                            {p.jersey_number || '?'}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{p.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.position || 'Unassigned'} • Free Agent</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {freeAgentTotalPages > 1 && (
                            <div className="px-4 md:px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Showing {(freeAgentPage - 1) * FREE_AGENTS_PER_PAGE + 1}–{Math.min(freeAgentPage * FREE_AGENTS_PER_PAGE, freeAgentTotal)} of {freeAgentTotal}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFreeAgentPage(p => Math.max(1, p - 1))}
                                        disabled={freeAgentPage <= 1}
                                        className="px-3 py-1.5 min-h-[36px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                        Page {freeAgentPage} of {freeAgentTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setFreeAgentPage(p => Math.min(freeAgentTotalPages, p + 1))}
                                        disabled={freeAgentPage >= freeAgentTotalPages}
                                        className="px-3 py-1.5 min-h-[36px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal for creating window */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 p-4 sm:p-6 pb-4 flex-shrink-0">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Create Transfer Window</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg p-1">✕</button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Window Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Mid-Season Transfer Window"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Opens At</label>
                                <input
                                    type="datetime-local"
                                    value={opensAt}
                                    onChange={e => setOpensAt(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Closes At</label>
                                <input
                                    type="datetime-local"
                                    value={closesAt}
                                    onChange={e => setClosesAt(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 p-4 sm:p-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWindow}
                                disabled={submitting}
                                className="flex-1 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Creating...' : 'Create Window'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for editing window */}
            {editingWindow && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6" onClick={() => setEditingWindow(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 p-4 sm:p-6 pb-4 flex-shrink-0">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Edit Transfer Window</h3>
                            <button onClick={() => setEditingWindow(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg p-1">✕</button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Window Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Opens At</label>
                                <input
                                    type="datetime-local"
                                    value={editOpensAt}
                                    onChange={e => setEditOpensAt(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Closes At</label>
                                <input
                                    type="datetime-local"
                                    value={editClosesAt}
                                    onChange={e => setEditClosesAt(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="editIsActiveCheckbox"
                                    checked={editIsActive}
                                    onChange={e => setEditIsActive(e.target.checked)}
                                    className="w-4 h-4 text-sffl-red rounded border-gray-300 focus:ring-sffl-red"
                                />
                                <label htmlFor="editIsActiveCheckbox" className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Window Active Schedule
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 p-4 sm:p-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setEditingWindow(null)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateWindow}
                                disabled={submitting}
                                className="flex-1 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTransferWindows;
