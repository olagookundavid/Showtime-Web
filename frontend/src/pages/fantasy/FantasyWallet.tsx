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
    ReceiptRefundIcon,
    InformationCircleIcon,
    XMarkIcon,
    BuildingLibraryIcon,
    ArrowRightIcon,
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
    PENDING: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    PROCESSING: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    PAID: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    REJECTED: 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    CANCELLED: 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300',
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

// Credits are positive, debits negative — render the sign explicitly so the
// ledger reads like a bank statement.
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

    // Prefill the bank fields once from the details used on the last request.
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
            if (!wallet) throw new Error('Wallet not loaded');
            return fantasyWalletApi.requestPayout({
                amount_kobo: Math.round(parseFloat(form.amountNaira) * 100),
                bank_name: form.bankName.trim(),
                account_number: form.accountNumber.trim(),
                account_name: form.accountName.trim(),
                user_notes: form.userNotes.trim() || undefined,
            });
        },
        onSuccess: () => {
            toast.success('Payout request submitted. We will transfer it manually to your bank.');
            setForm((f) => ({ ...f, amountNaira: '', userNotes: '' }));
            queryClient.invalidateQueries({ queryKey: ['fantasyWallet'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyMyPayouts'] });
        },
        onError: (err: any) => {
            // 409 == the server recomputed the balance and it no longer covers this.
            toast.error(err?.response?.data?.error || err.message || 'Failed to request payout');
        },
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => fantasyWalletApi.cancelPayout(id),
        onSuccess: () => {
            toast.success('Request cancelled — the funds are back in your wallet balance.');
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
                    className="px-6 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-bold text-sm shadow-md transition active:scale-95"
                >
                    Back to Fantasy
                </Link>
            </div>
        );
    }

    // ── Client-side guards mirroring the server rules ────────────────────────
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
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                    <BanknotesIcon className="w-3.5 h-3.5" /> Fantasy Wallet
                </div>
                <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white">Your Winnings</h1>
                <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                    Prize money from your leagues lands here. Request a payout and we'll transfer it directly to your bank account.
                </p>
            </div>

            <div className="space-y-8">
                {/* ── Balance Hero ──────────────────────────────────────────── */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-8 shadow-sm">
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
                                        is committed to payout requests being processed. It has already left the balance
                                        above and returns only if a request is cancelled or rejected.
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <TrophyIcon className="w-3.5 h-3.5 text-amber-500" /> Lifetime Won
                                </span>
                                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">
                                    {formatKobo(wallet.lifetime_won_kobo)}
                                </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <ArrowUpTrayIcon className="w-3.5 h-3.5 text-emerald-500" /> Lifetime Paid Out
                                </span>
                                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">
                                    {formatKobo(wallet.lifetime_paid_kobo)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                    {/* ── Request Payout ────────────────────────────────────── */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mb-1 flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-5 h-5 text-sffl-red" /> Request Payout
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                            Payouts are reviewed and sent <span className="text-gray-900 dark:text-white font-bold">manually</span> by the
                            Showtime team as a bank transfer. It is not instant — please allow a few working days.
                        </p>

                        {!wallet.can_request_payout ? (
                            <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center">
                                <TrophyIcon className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                <h3 className="text-sm font-black uppercase tracking-wider text-sffl-navy dark:text-white mb-1">
                                    Keep Stacking Those Wins
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                    You need at least{' '}
                                    <span className="text-sffl-red font-bold">
                                        {formatKobo(wallet.min_payout_kobo)}
                                    </span>{' '}
                                    in your balance before you can request a payout — it keeps bank transfer fees from
                                    eating your winnings. You currently have{' '}
                                    <span className="text-gray-900 dark:text-white font-bold">{formatKobo(wallet.balance_kobo)}</span>.
                                </p>
                                <Link
                                    to="/fantasy/leagues"
                                    className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-extrabold text-xs uppercase transition shadow-md"
                                >
                                    Find a Prize League <ArrowRightIcon className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase block mb-1">
                                        Amount (₦ Naira)
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="0.01"
                                        value={form.amountNaira}
                                        onChange={(e) => setForm({ ...form, amountNaira: e.target.value })}
                                        placeholder="e.g. 5000"
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                    />
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        Minimum {formatKobo(wallet.min_payout_kobo)} · Available{' '}
                                        {formatKobo(wallet.balance_kobo)}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase block mb-1">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.bankName}
                                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                        placeholder="e.g. Guaranty Trust Bank"
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase block mb-1">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={form.accountNumber}
                                        onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                                        placeholder="10-digit NUBAN"
                                        maxLength={20}
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm font-mono tracking-wider text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase block mb-1">
                                        Account Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.accountName}
                                        onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                                        placeholder="Exactly as your bank has it"
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase block mb-1">
                                        Anything We Should Know? (Optional)
                                    </label>
                                    <textarea
                                        value={form.userNotes}
                                        onChange={(e) => setForm({ ...form, userNotes: e.target.value.slice(0, 500) })}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="Anything you want us to know about this transfer."
                                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red resize-none"
                                    />
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 text-right">
                                        {form.userNotes.length} / 500
                                    </p>
                                </div>

                                <button
                                    onClick={() => requestMutation.mutate()}
                                    disabled={!canSubmit}
                                    className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white font-black text-xs uppercase transition active:scale-95 disabled:active:scale-100 shadow-md cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {requestMutation.isPending ? (
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                    ) : (
                                        'Request Payout'
                                    )}
                                </button>

                                {disabledReason && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                                        <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{disabledReason}</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Payout History ────────────────────────────────────── */}
                    <div className="lg:col-span-3">
                        <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                            <BuildingLibraryIcon className="w-5 h-5 text-sffl-red" /> Payout Requests
                        </h2>

                        {payoutsLoading ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : payouts.length === 0 ? (
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    You haven't requested a payout yet. Requests you make will be tracked here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {payouts.map((p) => (
                                    <div
                                        key={p.id}
                                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${STATUS_STYLES[p.status]}`}
                                                    >
                                                        {p.status}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {formatDate(p.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-2xl font-black text-sffl-red mt-1.5">
                                                    {formatKobo(p.amount_kobo)}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {p.bank_name}
                                                    <span className="text-gray-300 dark:text-gray-600"> · </span>
                                                    <span className="font-mono font-bold text-gray-900 dark:text-white">{p.account_number}</span>
                                                    <span className="text-gray-300 dark:text-gray-600"> · </span>
                                                    {p.account_name}
                                                </p>
                                            </div>

                                            {p.status === 'PENDING' && (
                                                <button
                                                    onClick={() => setCancelTarget(p)}
                                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-sffl-red border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 transition cursor-pointer"
                                                >
                                                    Cancel Request
                                                </button>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{STATUS_BLURB[p.status]}</p>

                                        {p.user_notes && (
                                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                                                Your note: {p.user_notes}
                                            </p>
                                        )}

                                        {p.status === 'PAID' && p.payment_reference && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                Payment reference:{' '}
                                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {p.payment_reference}
                                                </span>
                                                {p.processed_at && (
                                                    <span className="text-gray-400"> · {formatDate(p.processed_at)}</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Transaction Ledger ────────────────────────────────────── */}
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                        <ReceiptRefundIcon className="w-5 h-5 text-sffl-red" /> Wallet Statement
                    </h2>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                        {transactions.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No wallet activity yet. Win a prize league and your first credit shows up here.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {transactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="px-4 sm:px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                                    {TX_LABEL[tx.type]}
                                                </span>
                                                {tx.league_name && (
                                                    <span className="text-xs text-sffl-red font-bold truncate">
                                                        {tx.league_name}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{tx.description}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {formatDateTime(tx.created_at)}
                                            </p>
                                        </div>
                                        <p
                                            className={`text-sm font-black tabular-nums shrink-0 ${
                                                tx.amount_kobo < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                            }`}
                                        >
                                            {formatSignedKobo(tx.amount_kobo)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cancel Confirmation Modal */}
            {cancelTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Cancel Payout Request</h3>
                            <button
                                onClick={() => setCancelTarget(null)}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Cancel your{' '}
                            <span className="text-sffl-red font-bold">{formatKobo(cancelTarget.amount_kobo)}</span> request
                            to {cancelTarget.bank_name}? The full amount returns to your wallet balance straight away
                            and you can request it again whenever you like.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCancelTarget(null)}
                                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase transition cursor-pointer"
                            >
                                Keep Request
                            </button>
                            <button
                                onClick={() => cancelMutation.mutate(cancelTarget.id)}
                                disabled={cancelMutation.isPending}
                                className="flex-1 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                            >
                                {cancelMutation.isPending ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                    'Cancel & Refund'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
