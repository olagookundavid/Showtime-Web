import React, { useState, useEffect } from 'react';
import { transfersApi, type TeamBudgetData } from '../../services/api';
import toast from 'react-hot-toast';

export const TeamHeadBudget: React.FC = () => {
    const [budget, setBudget] = useState<TeamBudgetData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchBudget = async () => {
            setLoading(true);
            try {
                const res = await transfersApi.getBudget();
                setBudget(res);
            } catch (err: any) {
                toast.error('Failed to load team budget details');
            } finally {
                setLoading(false);
            }
        };
        fetchBudget();
    }, []);

    if (loading) {
        return <div className="p-12 text-center text-gray-400">Loading budget...</div>;
    }

    if (!budget) {
        return <div className="p-12 text-center text-gray-400">No budget record found for your team.</div>;
    }

    const spentPercentage = Math.min(100, (budget.spent / budget.total_budget) * 100);

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">Team Budget Standing</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overview of your team's point allowance, expenditures, and available balance for player contracts and transfers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Season Budget</span>
                    <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">{budget.total_budget.toLocaleString()} pts</div>
                    <span className="text-xs text-gray-400 mt-1 block">Default: 15,000,000 pts</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Spent</span>
                    <div className="text-3xl font-black text-sffl-red mt-2">{budget.spent.toLocaleString()} pts</div>
                    <span className="text-xs text-gray-400 mt-1 block">{spentPercentage.toFixed(1)}% of total budget</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Remaining Balance</span>
                    <div className="text-3xl font-black text-green-600 dark:text-green-400 mt-2">{budget.remaining.toLocaleString()} pts</div>
                    <span className="text-xs text-gray-400 mt-1 block">Available for bids & transfers</span>
                </div>
            </div>

            {/* Visual Bar */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-900 dark:text-white">Budget Utilization</span>
                    <span className="text-sffl-red">{spentPercentage.toFixed(1)}%</span>
                </div>

                <div className="w-full bg-gray-100 dark:bg-gray-700 h-4 rounded-full overflow-hidden p-0.5">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            spentPercentage > 85 ? 'bg-red-600' : spentPercentage > 60 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${spentPercentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
