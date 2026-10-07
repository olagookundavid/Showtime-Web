import React, { useState, useEffect } from 'react';
import { transfersApi } from '../../services/api';
import type { TeamBudgetData } from '../../types';
import toast from 'react-hot-toast';
import { DashboardPageHeader, Spinner } from '../../components';

export const TeamHeadBudget: React.FC = () => {
    const [budget, setBudget] = useState<TeamBudgetData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchBudget = async () => {
            setLoading(true);
            try {
                const res = await transfersApi.getBudget();
                setBudget(res);
            } catch {
                toast.error('Failed to load team budget details');
            } finally {
                setLoading(false);
            }
        };
        fetchBudget();
    }, []);

    // A zero budget would divide by zero; show it as fully used instead of NaN.
    const spentPercentage = budget
        ? budget.total_budget > 0 ? Math.min(100, (budget.spent / budget.total_budget) * 100) : 100
        : 0;

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Team Budget"
                subtitle="Your season's point allowance, what you've spent and what's left for contracts and transfers."
            />

            {loading ? (
                <Spinner label="Loading budget" />
            ) : !budget ? (
                <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    No budget record found for your team.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        <div className="min-w-0 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Season Budget</span>
                            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2 wrap-break-word">{budget.total_budget.toLocaleString()} pts</div>
                            <span className="text-xs text-gray-400 mt-1 block">Default: 15,000,000 pts</span>
                        </div>

                        <div className="min-w-0 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Spent</span>
                            <div className="text-2xl sm:text-3xl font-black text-sffl-red mt-2 wrap-break-word">{budget.spent.toLocaleString()} pts</div>
                            <span className="text-xs text-gray-400 mt-1 block">{spentPercentage.toFixed(1)}% of total budget</span>
                        </div>

                        <div className="min-w-0 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Remaining Balance</span>
                            <div className="text-2xl sm:text-3xl font-black text-green-600 dark:text-green-400 mt-2 wrap-break-word">{budget.remaining.toLocaleString()} pts</div>
                            <span className="text-xs text-gray-400 mt-1 block">Available for bids & transfers</span>
                        </div>
                    </div>

                    {/* Visual Bar */}
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex justify-between gap-3 text-sm font-bold">
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
                </>
            )}
        </div>
    );
};
