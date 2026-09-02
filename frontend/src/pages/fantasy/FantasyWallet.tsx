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
    PENDING: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
    PROCESSING: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
    PAID: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
    REJECTED: 'bg-red-500/10 border border-red-500/20 text-red-400',
    CANCELLED: 'bg-neutral-800 border border-neutral-700 text-neutral-400',
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
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <BanknotesIcon className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-black uppercase text-white mb-2">Wallet Unavailable</h1>
                <p className="text-neutral-400 max-w-md mb-6">
                    We couldn't load your fantasy wallet right now. Please refresh and try again.
                </p>
                <Link
                    to="/fantasy"
                    className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-sm uppercase shadow-lg shadow-yellow-500/20"
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
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Top Bar */}
            <div className="border-b border-neutral-800 bg-neutral-950/80 px-4 sm:px-6 py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                        <BanknotesIcon className="w-3.5 h-3.5" /> Fantasy Wallet
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-white">Your Winnings</h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Prize money from your leagues lands here. Request a payout and we'll transfer it to your bank.
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-10">
                {/* ── Balance Hero ──────────────────────────────────────────── */}
                <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                                Available Balance
                            </span>
                            <p className="text-4xl sm:text-5xl font-black text-yellow-400 mt-1 tracking-tight">
                                {formatKobo(wallet.balance_kobo)}
                            </p>
                            {wallet.pending_payout_kobo > 0 && (
                                <p className="text-xs text-neutral-400 mt-2 flex items-start gap-1.5 max-w-md">
                                    <ClockIcon className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
                                    <span>
                                        <span className="font-bold text-amber-400">
                                            {formatKobo(wallet.pending_payout_kobo)}
                                        </span>{' '}
                                        is committed to payout requests being processed. It has already left the balance
                                        above and returns only if a request is cancelled or rejected.
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                                    <TrophyIcon className="w-3.5 h-3.5 text-yellow-400" /> Lifetime Won
                                </span>
                                <p className="text-lg font-black text-white mt-1">
                                    {formatKobo(wallet.lifetime_won_kobo)}
                                </p>
                            </div>
                            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                                    <ArrowUpTrayIcon className="w-3.5 h-3.5 text-emerald-400" /> Lifetime Paid Out
                                </span>
                                <p className="text-lg font-black text-white mt-1">
                                    {formatKobo(wallet.lifetime_paid_kobo)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                    {/* ── Request Payout ────────────────────────────────────── */}
                    <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                        <h2 className="text-xl font-black uppercase tracking-wider text-white mb-1 flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-5 h-5 text-yellow-400" /> Request Payout
                        </h2>
                        <p className="text-xs text-neutral-400 mb-5">
                            Payouts are reviewed and sent <span className="text-white font-bold">manually</span> by the
                            Showtime team as a bank transfer. It is not instant — please allow a few working days.
                        </p>

                        {!wallet.can_request_payout ? (
                            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center">
                                <TrophyIcon className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-1">
                                    Keep Stacking Those Wins
                                </h3>
                                <p className="text-xs text-neutral-400 leading-relaxed">
                                    You need at least{' '}
                                    <span className="text-yellow-400 font-bold">
                                        {formatKobo(wallet.min_payout_kobo)}
                                    </span>{' '}
                                    in your balance before you can request a payout — it keeps bank transfer fees from
                                    eating your winnings. You currently have{' '}
                                    <span className="text-white font-bold">{formatKobo(wallet.balance_kobo)}</span>.
                                </p>
                                <Link
                                    to="/fantasy/leagues"
                                    className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs uppercase transition"
                                >
                                    Find a Prize League <ArrowRightIcon className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">
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
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                    />
                                    <p className="text-[11px] text-neutral-500 mt-1">
                                        Minimum {formatKobo(wallet.min_payout_kobo)} · Available{' '}
                                        {formatKobo(wallet.balance_kobo)}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.bankName}
                                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                        placeholder="e.g. Guaranty Trust Bank"
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={form.accountNumber}
                                        onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                                        placeholder="10-digit NUBAN"
                                        maxLength={20}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm font-mono tracking-wider text-white focus:outline-none focus:border-yellow-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">
                                        Account Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.accountName}
                                        onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                                        placeholder="Exactly as your bank has it"
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">
                                        Anything We Should Know? (Optional)
                                    </label>
                                    <textarea
                                        value={form.userNotes}
                                        onChange={(e) => setForm({ ...form, userNotes: e.target.value.slice(0, 500) })}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="Anything you want us to know about this transfer."
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none"
                                    />
                                    <p className="text-[11px] text-neutral-500 mt-1 text-right">
                                        {form.userNotes.length} / 500
                                    </p>
                                </div>

                                <button
                                    onClick={() => requestMutation.mutate()}
                                    disabled={!canSubmit}
                                    className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-extrabold text-xs uppercase transition active:scale-95 disabled:active:scale-100"
                                >
                                    {requestMutation.isPending ? (
                                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                                    ) : (
                                        'Request Payout'
                                    )}
                                </button>

                                {disabledReason && (
                                    <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                                        <InformationCircleIcon className="w-4 h-4 shrink-0" />
                                        <span>{disabledReason}</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Payout History ────────────────────────────────────── */}
                    <div className="lg:col-span-3">
                        <h2 className="text-xl font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
                            <BuildingLibraryIcon className="w-5 h-5 text-emerald-400" /> Payout Requests
                        </h2>

                        {payoutsLoading ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : payouts.length === 0 ? (
                            <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800/80 text-center">
                                <p className="text-sm text-neutral-400">
                                    You haven't requested a payout yet. Requests you make will be tracked here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {payouts.map((p) => (
                                    <div
                                        key={p.id}
                                        className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${STATUS_STYLES[p.status]}`}
                                                    >
                                                        {p.status}
                                                    </span>
                                                    <span className="text-xs text-neutral-500">
                                                        {formatDate(p.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-2xl font-black text-white mt-1.5">
                                                    {formatKobo(p.amount_kobo)}
                                                </p>
                                                <p className="text-xs text-neutral-400 mt-1">
                                                    {p.bank_name}
                                                    <span className="text-neutral-600"> · </span>
                                                    <span className="font-mono">{p.account_number}</span>
                                                    <span className="text-neutral-600"> · </span>
                                                    {p.account_name}
                                                </p>
                                            </div>

                                            {p.status === 'PENDING' && (
                                                <button
                                                    onClick={() => setCancelTarget(p)}
                                                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 border border-neutral-700 text-xs font-bold text-white transition"
                                                >
                                                    Cancel Request
                                                </button>
                                            )}
                                        </div>

                                        <p className="text-xs text-neutral-500 mt-3">{STATUS_BLURB[p.status]}</p>

                                        {p.user_notes && (
                                            <p className="text-xs text-neutral-400 mt-2 border-l-2 border-neutral-800 pl-3">
                                                Your note: {p.user_notes}
                                            </p>
                                        )}

                                        {p.status === 'PAID' && p.payment_reference && (
                                            <p className="text-xs text-neutral-400 mt-2">
                                                Payment reference:{' '}
                                                <span className="font-mono text-emerald-400">
                                                    {p.payment_reference}
                                                </span>
                                                {p.processed_at && (
                                                    <span className="text-neutral-600"> · {formatDate(p.processed_at)}</span>
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
                    <h2 className="text-xl font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
                        <ReceiptRefundIcon className="w-5 h-5 text-yellow-400" /> Wallet Statement
                    </h2>

                    <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl overflow-hidden">
                        {transactions.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-neutral-400">
                                    No wallet activity yet. Win a prize league and your first credit shows up here.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-800/80">
                                {transactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="px-4 sm:px-5 py-3.5 flex items-start justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                                    {TX_LABEL[tx.type]}
                                                </span>
                                                {tx.league_name && (
                                                    <span className="text-xs text-yellow-400 font-bold truncate">
                                                        {tx.league_name}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-white mt-1">{tx.description}</p>
                                            <p className="text-xs text-neutral-500 mt-0.5">
                                                {formatDateTime(tx.created_at)}
                                            </p>
                                        </div>
                                        <p
                                            className={`text-sm font-black tabular-nums shrink-0 ${
                                                tx.amount_kobo < 0 ? 'text-red-400' : 'text-emerald-400'
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
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-white uppercase">Cancel Payout Request</h3>
                            <button
                                onClick={() => setCancelTarget(null)}
                                className="p-1 rounded-lg bg-neutral-800 text-neutral-400"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-neutral-400 mb-6">
                            Cancel your{' '}
                            <span className="text-white font-bold">{formatKobo(cancelTarget.amount_kobo)}</span> request
                            to {cancelTarget.bank_name}? The full amount returns to your wallet balance straight away
                            and you can request it again whenever you like.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCancelTarget(null)}
                                className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase transition"
                            >
                                Keep Request
                            </button>
                            <button
                                onClick={() => cancelMutation.mutate(cancelTarget.id)}
                                disabled={cancelMutation.isPending}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 disabled:bg-neutral-800 text-white font-extrabold text-xs uppercase transition"
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
