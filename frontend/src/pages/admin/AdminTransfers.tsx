import React, { useState, useEffect } from 'react';
import { adminTransfersApi, transfersApi, type TransferData, type TeamBudgetData } from '../../services/api';
import toast from 'react-hot-toast';

export const AdminTransfers: React.FC = () => {
    const [transfers, setTransfers] = useState<TransferData[]>([]);
    const [budgets, setBudgets] = useState<TeamBudgetData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tRes, bRes] = await Promise.all([
                transfersApi.getTeamTransfers({ limit: 200 }),
                adminTransfersApi.getAllBudgets(),
            ]);
            setTransfers(tRes.data || []);
            setBudgets(bRes || []);
        } catch {
            toast.error('Failed to load transfers or budgets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSeedBudgets = async () => {
        if (!window.confirm('Reset all team budgets to 15,000,000 pts?')) return;
        try {
            await adminTransfersApi.seedBudgets();
            toast.success('All team budgets seeded to 15,000,000 pts');
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to seed budgets');
        }
    };

    const handleAdjustBudget = async (teamId: string, teamName: string) => {
        const valStr = window.prompt(`Set new total budget for ${teamName} (Points):`, '15000000');
        if (!valStr) return;
        const val = parseInt(valStr, 10);
        if (isNaN(val) || val <= 0) {
            toast.error('Invalid budget value');
            return;
        }

        try {
            await adminTransfersApi.adjustBudget(teamId, val);
            toast.success(`Budget for ${teamName} updated`);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to adjust budget');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Admin Transfer & Budget Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Oversee all team budgets, active listings, and transfer proposals.</p>
                </div>

                <button
                    onClick={handleSeedBudgets}
                    className="px-4 py-2.5 bg-sffl-red hover:bg-sffl-red/90 text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                >
                    ⚡ Seed All Budgets (15M)
                </button>
            </div>

            {/* Team Budgets Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden space-y-4 p-6">
                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">Team Budget Allowances</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <th className="p-3">Team</th>
                                <th className="p-3">Total Budget</th>
                                <th className="p-3">Spent</th>
                                <th className="p-3">Remaining</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                            {budgets.map(b => (
                                <tr key={b.id}>
                                    <td className="p-3 font-bold text-gray-900 dark:text-white">{b.team?.name || 'Team'}</td>
                                    <td className="p-3 font-mono font-bold">{b.total_budget.toLocaleString()} pts</td>
                                    <td className="p-3 text-sffl-red font-mono font-bold">{b.spent.toLocaleString()} pts</td>
                                    <td className="p-3 text-green-600 dark:text-green-400 font-mono font-bold">{b.remaining.toLocaleString()} pts</td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => handleAdjustBudget(b.team_id, b.team?.name || 'Team')}
                                            className="px-3 py-1 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 font-bold text-xs rounded-lg transition-colors"
                                        >
                                            Adjust Budget
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transfers Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden space-y-4 p-6">
                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">All Transfer Activity</h2>
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading transfers...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Player</th>
                                    <th className="p-3">From Team</th>
                                    <th className="p-3">To Team</th>
                                    <th className="p-3">Price / Value</th>
                                    <th className="p-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {transfers.map(t => (
                                    <tr key={t.id}>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 bg-sffl-navy/10 text-sffl-navy text-xs font-bold rounded">
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold text-gray-900 dark:text-white">{t.player?.name}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-300">{t.from_team?.name}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-300">{t.to_team?.name || '-'}</td>
                                        <td className="p-3 font-mono font-bold">{t.asking_price?.toLocaleString() || '-'} pts</td>
                                        <td className="p-3 font-bold text-xs">{t.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTransfers;
