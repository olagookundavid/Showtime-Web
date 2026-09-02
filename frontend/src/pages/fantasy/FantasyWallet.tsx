import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    BanknotesIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ClockIcon,
    TrophyIcon,
} from '@heroicons/react/24/outline';
import {
    fantasyWalletApi,
    formatKobo,
    type PayoutRequest,
    type PayoutStatus,
    type WalletTransaction,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

const STATUS_STYLES: Record<PayoutStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    PROCESSING: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    PAID: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800',
    CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
};

const STATUS_BLURB: Record<PayoutStatus, string> = {
    PENDING: 'Queued for a manual review by the Showtime finance team.',
    PROCESSING: 'Approved — the bank transfer is being sent.',
    PAID: 'Transfer completed to the account below.',
    REJECTED: 'Not approved. The funds were returned to your wallet.',
    CANCELLED: 'You cancelled this request. The funds went back to your wallet.',
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

const formatDateTime = (iso: string) =>
    `${formatDate(iso)} · ${new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`;

const formatSignedKobo = (kobo: number) => `${kobo < 0 ? '-' : '+'}${formatKobo(Math.abs(kobo))}`;

const TX_LABEL: Record<WalletTransaction['type'], string> = {
    WINNINGS: 'Winnings',
    PAYOUT: 'Payout',
    PAYOUT_REVERSAL: 'Payout Returned',
    ADJUSTMENT: 'Adjustment',
};

export function FantasyWallet() {
    const queryClient = useQueryClient();
    const { isLoading: authLoading } = useAuth();

    const { data: wallet, isLoading: walletLoading } = useQuery({
        queryKey: ['fantasyWallet'],
        queryFn: fantasyWalletApi.getWallet,
    });

    const { data: payouts = [], isLoading: payoutsLoading } = useQuery({
        queryKey: ['fantasyMyPayouts'],
        queryFn: fantasyWalletApi.listMyPayouts,
    });

    const [form, setForm] = useState({
        amountNaira: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
        userNotes: '',
    });
    const [prefilled, setPrefilled] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<PayoutRequest | null>(null);

    useEffect(() => {
        const bank = wallet?.last_bank_details;
        if (!bank || prefilled) return;
        setForm((f) => ({
            ...f,
            bankName: f.bankName || bank.bank_name,
            accountNumber: f.accountNumber || bank.account_number,
            accountName: f.accountName || bank.account_name,
        }));
        setPrefilled(true);
    }, [wallet?.last_bank_details, prefilled]);

    const requestMutation = useMutation({
        mutationFn: async () => {
            const amountKobo = Math.round(parseFloat(form.amountNaira) * 100);
            return fantasyWalletApi.requestPayout({
                amount_kobo: amountKobo,
                bank_name: form.bankName.trim(),
                account_number: form.accountNumber.trim(),
                account_name: form.accountName.trim(),
                user_notes: form.userNotes.trim() || undefined,
            });
        },
        onSuccess: (created) => {
            toast.success(`Payout of ${formatKobo(created.amount_kobo)} requested!`);
            setForm((f) => ({ ...f, amountNaira: '', userNotes: '' }));
            queryClient.invalidateQueries({ queryKey: ['fantasyWallet'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyMyPayouts'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || 'Failed to request payout');
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: string) => fantasyWalletApi.cancelPayout(id),
        onSuccess: (cancelled) => {
            toast.success(`Payout of ${formatKobo(cancelled.amount_kobo)} cancelled; funds returned.`);
            setCancelTarget(null);
            queryClient.invalidateQueries({ queryKey: ['fantasyWallet'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyMyPayouts'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || 'Failed to cancel payout request');
        },
    });

    if (authLoading || walletLoading) {
        return <Loader />;
    }

    if (!wallet) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                    <BanknotesIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">Wallet Unavailable</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">
                    We couldn't load your fantasy wallet right now. Please refresh and try again.
                </p>
                <Link
                    to="/fantasy"
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition"
                >
                    Back to Fantasy
                </Link>
            </div>
        );
    }

    const amountKobo = form.amountNaira.trim() === '' ? NaN : Math.round(parseFloat(form.amountNaira) * 100);
    const accountDigitsOnly = /^\d+$/.test(form.accountNumber.trim());

    let disabledReason = '';
    if (Number.isNaN(amountKobo)) {
        disabledReason = 'Enter the amount you want to withdraw.';
    } else if (amountKobo <= 0) {
        disabledReason = 'Amount must be greater than zero.';
    } else if (amountKobo < wallet.min_payout_kobo) {
        disabledReason = `The minimum payout is ${formatKobo(wallet.min_payout_kobo)}.`;
    } else if (amountKobo > wallet.balance_kobo) {
        disabledReason = `That is more than your available balance of ${formatKobo(wallet.balance_kobo)}.`;
    } else if (!form.bankName.trim()) {
        disabledReason = 'Enter the name of your bank.';
    } else if (!form.accountNumber.trim()) {
        disabledReason = 'Enter your account number.';
    } else if (!accountDigitsOnly) {
        disabledReason = 'Account number must be digits only — no spaces or dashes.';
    } else if (!form.accountName.trim()) {
        disabledReason = 'Enter the account name exactly as your bank has it.';
    } else if (form.userNotes.length > 500) {
        disabledReason = 'Notes must be 500 characters or fewer.';
    }

    const canSubmit = disabledReason === '' && !requestMutation.isPending;
    const transactions = wallet.transactions || [];

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Top Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                        <BanknotesIcon className="w-3.5 h-3.5" /> Fantasy Prize Wallet
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white">Your Winnings</h1>
                    <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                        Prize money from your leagues lands here. Request a payout and we'll transfer it to your bank.
                    </p>
                </div>
            </div>

            {/* Balance Hero Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Available Balance
                        </span>
                        <p className="text-4xl sm:text-5xl font-black text-sffl-red mt-1 tracking-tight">
                            {formatKobo(wallet.balance_kobo)}
                        </p>
                        {wallet.pending_payout_kobo > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-start gap-1.5 max-w-md">
                                <ClockIcon className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
                                <span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {formatKobo(wallet.pending_payout_kobo)}
                                    </span>{' '}
                                    is committed to payout requests currently being processed.
                                </span>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <TrophyIcon className="w-3.5 h-3.5 text-yellow-500" /> Lifetime Won
                            </span>
                            <p className="text-lg font-black text-sffl-navy dark:text-white mt-1">
                                {formatKobo(wallet.lifetime_won_kobo)}
                            </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <ArrowUpTrayIcon className="w-3.5 h-3.5 text-emerald-500" /> Lifetime Paid Out
                            </span>
                            <p className="text-lg font-black text-sffl-navy dark:text-white mt-1">
                                {formatKobo(wallet.lifetime_paid_kobo)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                {/* Request Payout Form */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <ArrowDownTrayIcon className="w-5 h-5 text-sffl-red" />
                        <h2 className="text-lg font-black uppercase text-sffl-navy dark:text-white">Request Payout</h2>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (canSubmit) requestMutation.mutate();
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Amount (₦ Naira)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₦</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    placeholder="e.g. 5000"
                                    value={form.amountNaira}
                                    onChange={(e) => setForm({ ...form, amountNaira: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                Minimum withdrawal: {formatKobo(wallet.min_payout_kobo)}
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Bank Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. GTBank, Zenith, Access"
                                value={form.bankName}
                                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Account Number
                            </label>
                            <input
                                type="text"
                                maxLength={10}
                                placeholder="10-digit NUBAN"
                                value={form.accountNumber}
                                onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Account Name
                            </label>
                            <input
                                type="text"
                                placeholder="Name as it appears on your account"
                                value={form.accountName}
                                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                                Notes (Optional)
                            </label>
                            <textarea
                                rows={2}
                                maxLength={500}
                                placeholder="Additional transfer instructions..."
                                value={form.userNotes}
                                onChange={(e) => setForm({ ...form, userNotes: e.target.value })}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                        >
                            {requestMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                                'Submit Payout Request'
                            )}
                        </button>
                    </form>
                </div>

                {/* Payout History & Ledger */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Recent Payout Requests */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white">Payout Requests</h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{payouts.length} Total</span>
                        </div>

                        {payoutsLoading ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-6 h-6 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : payouts.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No payout requests yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {payouts.map((p) => (
                                    <div key={p.id} className="p-3.5 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${STATUS_STYLES[p.status]}`}>
                                                    {p.status}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(p.created_at)}</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                                {formatKobo(p.amount_kobo)} → {p.bank_name} ({p.account_number})
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{STATUS_BLURB[p.status]}</p>
                                        </div>

                                        {p.status === 'PENDING' && (
                                            <button
                                                onClick={() => setCancelTarget(p)}
                                                className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-gray-700 dark:text-gray-200 transition"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Transaction Ledger */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-base font-black uppercase text-sffl-navy dark:text-white">Wallet Ledger</h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{transactions.length} Entries</span>
                        </div>

                        {transactions.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No transaction activity recorded.</p>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white block">{TX_LABEL[tx.type]}</span>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{tx.description || formatDateTime(tx.created_at)}</span>
                                        </div>
                                        <span className={`font-mono font-bold text-sm ${
                                            tx.amount_kobo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-sffl-red'
                                        }`}>
                                            {formatSignedKobo(tx.amount_kobo)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cancel Payout Modal */}
            {cancelTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-3xl p-6 shadow-2xl w-full max-w-md">
                        <h3 className="text-lg font-black uppercase text-sffl-navy dark:text-white mb-2">Cancel Payout Request?</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            Are you sure you want to cancel your payout of <strong>{formatKobo(cancelTarget.amount_kobo)}</strong>? The funds will immediately return to your available wallet balance.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setCancelTarget(null)}
                                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold"
                            >
                                Keep Request
                            </button>
                            <button
                                onClick={() => cancelMutation.mutate(cancelTarget.id)}
                                disabled={cancelMutation.isPending}
                                className="px-4 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold"
                            >
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
