import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    TrophyIcon,
    UserGroupIcon,
    PlusIcon,
    KeyIcon,
    ArrowRightIcon,
    ShieldCheckIcon,
    XMarkIcon,
    CheckBadgeIcon,
    LockClosedIcon,
    TrashIcon,
    BanknotesIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';
import { fantasyApi, fantasyLeagueApi, formatKobo, type FantasyLeague } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

/** Nothing off the wire is trusted to be a finite number. */
const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** The platform cut is a server setting; used only to illustrate a split the
 *  creator has not published yet, and only until a real preview supplies it. */
const FALLBACK_PLATFORM_CUT_PERCENT = 10;

/** The split every new paid league starts from, so the common case is one click. */
const DEFAULT_PRIZE_ROWS = ['50', '30', '20'];

const ordinal = (n: number): string => {
    const v = num(n);
    if (!Number.isInteger(v) || v <= 0) return `#${v}`;
    const mod100 = v % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
    switch (v % 10) {
        case 1: return `${v}st`;
        case 2: return `${v}nd`;
        case 3: return `${v}rd`;
        default: return `${v}th`;
    }
};

/** Percentages are typed as free text so "12." is survivable mid-keystroke. */
const parsePercent = (raw: string): number => {
    const v = parseFloat(String(raw ?? ''));
    return Number.isFinite(v) ? v : 0;
};

/** Same shape the mutation handlers read: the server's own message wins. */
const apiErrorMessage = (err: unknown, fallback: string): string => {
    const e = err as { response?: { data?: { error?: string } }; message?: string } | null | undefined;
    return e?.response?.data?.error || e?.message || fallback;
};

const fmtPercent = (v: number | null | undefined): string => {
    const n = num(v);
    return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
};

// max_members of 0 means unlimited.
const isLeagueFull = (l: FantasyLeague) => num(l.max_members) > 0 && num(l.member_count) >= num(l.max_members);

const formatMembers = (l: FantasyLeague) =>
    num(l.max_members) > 0
        ? `${num(l.member_count)} / ${num(l.max_members)} managers`
        : `${num(l.member_count)} ${num(l.member_count) === 1 ? 'manager' : 'managers'}`;

export function FantasyLeagues() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const { data: season, isLoading: seasonLoading } = useQuery({
        queryKey: ['fantasySeason'],
        queryFn: fantasyApi.getActiveSeason,
    });

    // My Leagues
    const { data: myLeagues = [], isLoading: myLeaguesLoading } = useQuery({
        queryKey: ['myFantasyLeagues', season?.id],
        queryFn: () => (season?.id ? fantasyApi.listMyLeagues(season.id) : Promise.resolve([])),
        enabled: !!season?.id && isAuthenticated,
    });

    // Public Leagues
    const { data: publicLeagues = [], isLoading: publicLeaguesLoading } = useQuery({
        queryKey: ['publicFantasyLeagues', season?.id],
        queryFn: () => (season?.id ? fantasyApi.listPublicLeagues(season.id) : Promise.resolve([])),
        enabled: !!season?.id,
    });

    // Modals
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [inviteCodeInput, setInviteCodeInput] = useState('');

    // Create League Form State
    const [createForm, setCreateForm] = useState({
        name: '',
        type: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
        entryFeeNaira: 0,
        maxMembers: 50,
    });

    // Prize split, one string per paying position. The rank is the row's
    // index + 1, so ranks are always 1,2,3… with no gaps by construction.
    const [prizeRows, setPrizeRows] = useState<string[]>(DEFAULT_PRIZE_ROWS);

    // The terms a manager is currently reading. Either a known league (full
    // preview) or a bare invite code (the league is not identified until the
    // server resolves the code).
    const [termsTarget, setTermsTarget] = useState<{ leagueId?: string; inviteCode?: string; name?: string } | null>(null);

    // Join League Mutation
    const joinMutation = useMutation({
        // Either an invite code (private league) or a league id (joining a
        // public one straight from the browse list).
        mutationFn: async (by: { invite_code?: string; league_id?: string }) => {
            if (!season?.id) throw new Error("Season not loaded");
            return fantasyApi.joinLeague(season.id, by);
        },
        onSuccess: (data) => {
            if (data.paystack_url) {
                toast.success("Redirecting to Paystack for league entry fee...");
                window.location.href = data.paystack_url;
            } else {
                toast.success(`Joined ${data.league_name || 'league'} successfully!`);
                setTermsTarget(null);
                setShowJoinModal(false);
                setInviteCodeInput('');
                queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['publicFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
                queryClient.invalidateQueries({ queryKey: ['leagueJoinPreview'] });
                queryClient.invalidateQueries({ queryKey: ['leagueJoinPreviewByCode'] });
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || "Failed to join league");
        }
    });

    // ─── Prize split (create form) ────────────────────────────────────────────
    const entryFeeKobo = Math.max(0, Math.round(num(createForm.entryFeeNaira) * 100));
    const createIsPaid = entryFeeKobo > 0;

    const prizePercents = useMemo(
        () => (prizeRows ?? []).map((r) => parsePercent(r)),
        [prizeRows]
    );
    const prizeTotal = useMemo(
        () => prizePercents.reduce((sum, p) => sum + num(p), 0),
        [prizePercents]
    );

    // Mirrors the server's rules so the creator is told before the round trip.
    const splitError = useMemo<string | null>(() => {
        if (!createIsPaid) return null;
        if (prizePercents.length === 0) return 'Add at least one paying position.';
        if (prizePercents.some((p) => !(num(p) > 0))) return 'Every position must be greater than 0%.';
        if (prizePercents.some((p) => num(p) > 100)) return 'No single position can take more than 100%.';
        if (prizeTotal > 100.0001) return `Your split adds up to ${fmtPercent(prizeTotal)} — it cannot go over 100%.`;
        return null;
    }, [createIsPaid, prizePercents, prizeTotal]);

    // The platform cut is a server setting. Any existing league's terms carry
    // it, so we borrow it to make the illustration honest; absent that we fall
    // back to the documented default and say the figures are estimates.
    const sampleLeagueId = useMemo(
        () => (publicLeagues ?? []).find((l) => !!l?.id)?.id ?? (myLeagues ?? []).find((l) => !!l?.id)?.id,
        [publicLeagues, myLeagues]
    );
    const { data: cutSample } = useQuery({
        queryKey: ['leagueJoinPreview', sampleLeagueId],
        queryFn: () => fantasyLeagueApi.getJoinPreview(sampleLeagueId as string),
        enabled: showCreateModal && !!sampleLeagueId,
        staleTime: 5 * 60 * 1000,
    });
    const platformCutPercent =
        cutSample && Number.isFinite(cutSample.cut_percent) ? cutSample.cut_percent : FALLBACK_PLATFORM_CUT_PERCENT;

    // A full house, as a concrete illustration. 0 max members means unlimited,
    // in which case there is no field size to multiply by and we show none.
    const illustrationFieldSize = Math.max(0, num(createForm.maxMembers));
    const illustrationGrossKobo = entryFeeKobo * illustrationFieldSize;
    const illustrationPoolKobo = Math.max(
        0,
        Math.round(illustrationGrossKobo - (illustrationGrossKobo * num(platformCutPercent)) / 100)
    );
    const showIllustration = createIsPaid && illustrationFieldSize > 0 && illustrationPoolKobo > 0;

    const setPrizeRow = (index: number, value: string) =>
        setPrizeRows((rows) => (rows ?? []).map((r, i) => (i === index ? value : r)));
    const addPrizeRow = () => setPrizeRows((rows) => [...(rows ?? []), '']);
    const removePrizeRow = (index: number) =>
        setPrizeRows((rows) => (rows ?? []).filter((_, i) => i !== index));

    // Create League Mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!season?.id) throw new Error("Season not loaded");
            if (!createForm.name.trim()) throw new Error("League name required");
            if (splitError) throw new Error(splitError);
            return fantasyApi.createLeague({
                season_id: season.id,
                name: createForm.name.trim(),
                type: createForm.type,
                entry_fee: entryFeeKobo, // kobo
                max_members: Math.max(0, num(createForm.maxMembers)),
                // A free league has nothing to divide, so the server default stands.
                prize_structure: createIsPaid
                    ? prizePercents.map((percent, i) => ({ rank: i + 1, percent: num(percent) }))
                    : undefined,
            });
        },
        onSuccess: () => {
            toast.success("League created successfully!");
            setShowCreateModal(false);
            setCreateForm({ name: '', type: 'PUBLIC', entryFeeNaira: 0, maxMembers: 50 });
            setPrizeRows(DEFAULT_PRIZE_ROWS);
            queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
            queryClient.invalidateQueries({ queryKey: ['publicFantasyLeagues'] });
            queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || "Failed to create league");
        }
    });

    // Cross-reference the browse list against the leagues the manager is
    // already a member of, so a joined league never offers a Join button.
    const joinedLeagueIds = useMemo(
        () => new Set((myLeagues ?? []).map((l) => l?.id).filter(Boolean)),
        [myLeagues]
    );

    // ─── Join terms ───────────────────────────────────────────────────────────
    // Nothing joins and no payment page opens until the manager has read the
    // terms and confirmed in the dialogue below.
    const termsLeagueId = termsTarget?.leagueId;
    // A private league is never listed, so the invite code is the only handle
    // on it. Same terms either way — only the lookup differs.
    const termsInviteCode = !termsLeagueId ? (termsTarget?.inviteCode ?? '').trim() || undefined : undefined;

    const previewById = useQuery({
        queryKey: ['leagueJoinPreview', termsLeagueId],
        queryFn: () => fantasyLeagueApi.getJoinPreview(termsLeagueId as string),
        enabled: !!termsLeagueId,
    });
    const previewByCode = useQuery({
        queryKey: ['leagueJoinPreviewByCode', termsInviteCode],
        queryFn: () => fantasyLeagueApi.getJoinPreviewByCode(termsInviteCode as string),
        enabled: !!termsInviteCode,
        retry: false, // a bad code is a 404, not a blip worth retrying
    });

    const activePreviewQuery = termsLeagueId ? previewById : previewByCode;
    const preview = activePreviewQuery.data;
    const previewLoading = activePreviewQuery.isLoading;
    const previewError = activePreviewQuery.error;

    const openTermsForLeague = (league: FantasyLeague) => {
        if (!isAuthenticated) {
            navigate('/login?redirect=/fantasy/leagues');
            return;
        }
        if (joinMutation.isPending) return;
        if (!league?.id) {
            toast.error('That league could not be identified. Please refresh and try again.');
            return;
        }
        setTermsTarget({ leagueId: league.id, name: league.name });
    };

    const confirmJoin = () => {
        if (!termsTarget || joinMutation.isPending) return;
        if (termsTarget.leagueId) {
            joinMutation.mutate({ league_id: termsTarget.leagueId });
            return;
        }
        const code = (termsTarget.inviteCode ?? '').trim();
        if (!code) return;
        joinMutation.mutate({ invite_code: code });
    };

    const previewFee = num(preview?.entry_fee_kobo);
    const previewIsPaid = previewFee > 0;
    const previewStructure = (preview?.prize_structure ?? []).filter(Boolean);
    const previewBlocked = !!preview && (preview.already_member || preview.is_full || preview.settled);
    const previewStandingsId = preview?.league_id || termsTarget?.leagueId || '';
    const previewErrorMessage = apiErrorMessage(previewError, "Could not load this league's terms.");

    // Only the card that was clicked shows a spinner.
    const pendingLeagueId =
        joinMutation.isPending ? joinMutation.variables?.league_id : undefined;

    if (authLoading || seasonLoading) {
        return <Loader />;
    }

    if (!season) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 md:p-12">
                <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 flex items-center justify-center text-sffl-red mb-4">
                    <ShieldCheckIcon className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black uppercase text-sffl-navy dark:text-white mb-2">No Active Season</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6 text-sm">Fantasy leagues are currently closed. Please check back later.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 pb-24">
            {/* Header Showtime Navy Banner */}
            <div className="bg-sffl-navy text-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                            <TrophyIcon className="w-3.5 h-3.5" /> Leagues & Pools
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tight text-white">
                            Compete & Win
                        </h1>
                        <p className="text-xs md:text-sm text-gray-300 mt-1 font-medium">
                            Join private friend leagues, company pools, or official Showtime cash prize tournaments.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!isAuthenticated) {
                                    navigate('/login?redirect=/fantasy/leagues');
                                    return;
                                }
                                setShowJoinModal(true);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase flex items-center gap-2 transition backdrop-blur-md cursor-pointer"
                        >
                            <KeyIcon className="w-3.5 h-3.5 text-yellow-400" /> Join via Code
                        </button>
                        <button
                            onClick={() => {
                                if (!isAuthenticated) {
                                    navigate('/login?redirect=/fantasy/leagues');
                                    return;
                                }
                                setShowCreateModal(true);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase flex items-center gap-2 transition active:scale-95 shadow-lg shadow-sffl-red/30 cursor-pointer"
                        >
                            <PlusIcon className="w-4 h-4" /> Create League
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* My Leagues Section */}
                {isAuthenticated && (
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                            <UserGroupIcon className="w-5 h-5 text-sffl-red" /> My Leagues
                        </h2>

                        {myLeaguesLoading ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (myLeagues ?? []).length === 0 ? (
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">You haven't joined any custom leagues yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(myLeagues ?? []).map((l) => (
                                    <div
                                        key={l.id}
                                        className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 rounded-2xl shadow-sm flex items-center justify-between transition"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                                    {l.type}
                                                </span>
                                                {l.invite_code && (
                                                    <span className="text-xs font-mono text-sffl-red font-bold">
                                                        Code: {l.invite_code}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5">{l.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Entry: {num(l.entry_fee) > 0 ? formatKobo(num(l.entry_fee)) : 'Free'} • {formatMembers(l)}
                                            </p>
                                        </div>

                                        <Link
                                            to={`/fantasy/leaderboard/${l.id}`}
                                            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1 transition shadow-sm"
                                        >
                                            Standings <ArrowRightIcon className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Public Leagues Section */}
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-sffl-navy dark:text-white mb-4 flex items-center gap-2">
                        <TrophyIcon className="w-5 h-5 text-sffl-navy dark:text-white" /> Official & Public Leagues
                    </h2>

                    {publicLeaguesLoading ? (
                        <div className="py-8 flex justify-center">
                            <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (publicLeagues ?? []).length === 0 ? (
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400">No public leagues open at this moment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(publicLeagues ?? []).map((l) => {
                                const full = isLeagueFull(l);
                                const joined = joinedLeagueIds.has(l.id);
                                const fee = num(l.entry_fee);
                                const pending = pendingLeagueId === l.id;
                                return (
                                    <div
                                        key={l.id}
                                        className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-sffl-red/50 rounded-2xl shadow-sm flex items-center justify-between gap-3 transition"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                                    {l.type}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {fee > 0 ? `Entry: ${formatKobo(fee)}` : 'Free Entry'}
                                                </span>
                                                {joined && (
                                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                        Joined
                                                    </span>
                                                )}
                                                {full && !joined && (
                                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                        Full
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1.5 truncate">{l.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatMembers(l)}</p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Link
                                                to={`/fantasy/leaderboard/${l.id}`}
                                                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1 transition shadow-sm"
                                            >
                                                Standings <ArrowRightIcon className="w-3.5 h-3.5" />
                                            </Link>

                                            {joined ? (
                                                <span className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase flex items-center gap-1.5">
                                                    <CheckBadgeIcon className="w-4 h-4" /> Joined
                                                </span>
                                            ) : full ? (
                                                <button
                                                    type="button"
                                                    disabled
                                                    title="This league has reached its member limit"
                                                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-xs font-black uppercase flex items-center gap-1.5 cursor-not-allowed"
                                                >
                                                    <LockClosedIcon className="w-4 h-4" /> Full
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => openTermsForLeague(l)}
                                                    disabled={joinMutation.isPending}
                                                    title={
                                                        fee > 0
                                                            ? `Entry fee ${formatKobo(fee)} — you'll see the full terms before paying`
                                                            : 'See the league terms before joining'
                                                    }
                                                    className="px-4 py-2 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
                                                >
                                                    {pending ? (
                                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                                    ) : (
                                                        <PlusIcon className="w-4 h-4" />
                                                    )}
                                                    {fee > 0 ? `Join • ${formatKobo(fee)}` : 'Join Free'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Join League Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Join with Invite Code</h3>
                            <button 
                                onClick={() => setShowJoinModal(false)} 
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            Enter the 6-character private invite code provided by your league commissioner.
                        </p>
                        <input
                            type="text"
                            value={inviteCodeInput}
                            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                            placeholder="e.g. ABC123"
                            maxLength={8}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center text-xl font-mono font-black tracking-widest text-sffl-navy dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red mb-4 uppercase"
                        />
                        <button
                            onClick={() => setTermsTarget({ inviteCode: inviteCodeInput.trim() })}
                            disabled={!inviteCodeInput.trim() || joinMutation.isPending}
                            className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                        >
                            Continue
                        </button>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 text-center">
                            You'll see the league's terms before anything is joined or paid.
                        </p>
                    </div>
                </div>
            )}

            {/* Create League Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase">Create New League</h3>
                            <button 
                                onClick={() => setShowCreateModal(false)} 
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">League Name</label>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="e.g. Lagos Flag Masters"
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Privacy Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCreateForm({ ...createForm, type: 'PUBLIC' })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${
                                            createForm.type === 'PUBLIC'
                                                ? 'bg-sffl-navy text-white border-sffl-navy shadow-sm'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                                        }`}
                                    >
                                        Public
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreateForm({ ...createForm, type: 'PRIVATE' })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${
                                            createForm.type === 'PRIVATE'
                                                ? 'bg-sffl-navy text-white border-sffl-navy shadow-sm'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                                        }`}
                                    >
                                        Private (Code Only)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Entry Fee (₦ Naira, 0 for Free)</label>
                                <input
                                    type="number"
                                    value={createForm.entryFeeNaira}
                                    onChange={(e) => setCreateForm({ ...createForm, entryFeeNaira: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase block mb-1">Max Managers (0 for Unlimited)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={createForm.maxMembers}
                                    onChange={(e) => setCreateForm({ ...createForm, maxMembers: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                />
                            </div>

                            {/* ── Prize split ─────────────────────────────── */}
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-white flex items-center gap-1.5">
                                        <BanknotesIcon className="w-4 h-4 text-sffl-red" /> Prize Split
                                    </h4>
                                    {createIsPaid && (
                                        <span
                                            className={`text-[11px] font-black uppercase px-2 py-0.5 rounded ${
                                                prizeTotal > 100.0001
                                                    ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                            }`}
                                        >
                                            Total {fmtPercent(prizeTotal)}
                                        </span>
                                    )}
                                </div>

                                {!createIsPaid ? (
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                                        <InformationCircleIcon className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                                        <span>
                                            This is a free league, so there is no pot to divide. Set an entry fee above to decide
                                            how the prize money is shared.
                                        </span>
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-3">
                                            You decide how the pot is shared. Positions are paid in order, top down.
                                        </p>

                                        <div className="space-y-2">
                                            {(prizeRows ?? []).map((row, i) => {
                                                const pct = parsePercent(row);
                                                const rowKobo = Math.max(
                                                    0,
                                                    Math.round((illustrationPoolKobo * num(pct)) / 100)
                                                );
                                                return (
                                                    <div key={`prize-row-${i}`} className="flex items-center gap-2">
                                                        <span className="w-14 shrink-0 text-xs font-black uppercase text-gray-700 dark:text-gray-200">
                                                            {ordinal(i + 1)}
                                                        </span>
                                                        <div className="relative flex-1 min-w-0">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                step="0.5"
                                                                value={row}
                                                                onChange={(e) => setPrizeRow(i, e.target.value)}
                                                                placeholder="0"
                                                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl py-2 pl-3 pr-7 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-sffl-red focus:ring-1 focus:ring-sffl-red"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-gray-500">
                                                                %
                                                            </span>
                                                        </div>
                                                        {showIllustration && (
                                                            <span className="w-24 shrink-0 text-right text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                                                                {formatKobo(rowKobo)}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removePrizeRow(i)}
                                                            disabled={(prizeRows ?? []).length <= 1}
                                                            title={
                                                                (prizeRows ?? []).length <= 1
                                                                    ? 'At least one paying position is required'
                                                                    : `Remove ${ordinal(i + 1)} place`
                                                            }
                                                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-between gap-2 mt-3">
                                            <button
                                                type="button"
                                                onClick={addPrizeRow}
                                                disabled={(prizeRows ?? []).length >= 20}
                                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                            >
                                                <PlusIcon className="w-3.5 h-3.5" /> Add Position
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPrizeRows(DEFAULT_PRIZE_ROWS)}
                                                className="text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 hover:text-sffl-red transition"
                                            >
                                                Reset 50 / 30 / 20
                                            </button>
                                        </div>

                                        {splitError ? (
                                            <p className="mt-3 text-[11px] font-bold text-red-700 dark:text-red-300 flex items-start gap-1.5">
                                                <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                                                <span>{splitError}</span>
                                            </p>
                                        ) : prizeTotal < 99.9999 ? (
                                            <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                                                {fmtPercent(100 - prizeTotal)} of the pot is left unallocated. That's allowed —
                                                raise a position to share it out.
                                            </p>
                                        ) : null}

                                        {showIllustration ? (
                                            <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                                                Amounts assume a full league of {illustrationFieldSize} at{' '}
                                                {formatKobo(entryFeeKobo)} each ({formatKobo(illustrationGrossKobo)}), less the{' '}
                                                {fmtPercent(platformCutPercent)} platform cut — a{' '}
                                                {formatKobo(illustrationPoolKobo)} prize pool.
                                            </p>
                                        ) : (
                                            <p className="mt-3 text-[11px] text-gray-600 dark:text-gray-300">
                                                No cap on managers, so there's no full-league figure to show. Percentages apply to
                                                whatever the pot reaches, after the {fmtPercent(platformCutPercent)} platform cut.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={!createForm.name.trim() || !!splitError || createMutation.isPending}
                                className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition mt-2 shadow-md cursor-pointer"
                            >
                                {createMutation.isPending ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                    'Confirm & Create'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* League Terms Modal — the only route to an actual join */}
            {termsTarget && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4 gap-3">
                            <div className="min-w-0">
                                <h3 className="text-lg font-black text-sffl-navy dark:text-white uppercase truncate">
                                    {preview?.name || termsTarget.name || 'League Terms'}
                                </h3>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Before you join
                                </p>
                            </div>
                            <button
                                onClick={() => setTermsTarget(null)}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 shrink-0"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {previewLoading ? (
                            <div className="py-10 flex justify-center">
                                <div className="w-8 h-8 border-2 border-sffl-red border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : previewError || !preview ? (
                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                                    <p className="text-xs font-bold text-red-700 dark:text-red-300">{previewErrorMessage}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTermsTarget(null)}
                                    className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs uppercase transition"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                        {preview.type || 'LEAGUE'}
                                    </span>
                                    {termsInviteCode && (
                                        <span className="text-xs font-mono font-bold text-sffl-red">
                                            Code: {termsInviteCode}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {num(preview.max_members) > 0
                                            ? `${num(preview.member_count)} / ${num(preview.max_members)} managers`
                                            : `${num(preview.member_count)} ${num(preview.member_count) === 1 ? 'manager' : 'managers'} • no cap`}
                                    </span>
                                    {preview.owner_name && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            • Run by {preview.owner_name}
                                        </span>
                                    )}
                                </div>

                                {/* States that make joining pointless, said plainly */}
                                {preview.settled && (
                                    <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                            This league has already been settled and paid out. It is closed to new entries.
                                        </p>
                                    </div>
                                )}
                                {preview.already_member && (
                                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                            <CheckBadgeIcon className="w-4 h-4" /> You're already in this league.
                                        </p>
                                        {preview.invite_code && (
                                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                                                Invite code:{' '}
                                                <span className="font-mono font-black">{preview.invite_code}</span> — share it to
                                                bring others in.
                                            </p>
                                        )}
                                    </div>
                                )}
                                {!preview.already_member && preview.membership_status === 'PENDING' && (
                                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                                            Your entry payment hasn't been confirmed yet. If you already paid, give Paystack a
                                            moment before trying again.
                                        </p>
                                    </div>
                                )}
                                {!preview.already_member && preview.is_full && (
                                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                                        <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                                            <LockClosedIcon className="w-4 h-4" /> This league is full — every place has been taken.
                                        </p>
                                    </div>
                                )}

                                {!previewIsPaid ? (
                                    /* ── Free league: short, as asked ── */
                                    <ul className="text-xs text-gray-700 dark:text-gray-200 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <CheckBadgeIcon className="w-4 h-4 shrink-0 text-sffl-red mt-0.5" />
                                            <span>There is no entry fee — this league is free to join.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckBadgeIcon className="w-4 h-4 shrink-0 text-sffl-red mt-0.5" />
                                            <span>
                                                Open to anyone, and you can join right now.{' '}
                                                {num(preview.max_members) > 0
                                                    ? `${num(preview.member_count)} of ${num(preview.max_members)} places taken.`
                                                    : `${num(preview.member_count)} ${num(preview.member_count) === 1 ? 'manager has' : 'managers have'} joined so far.`}
                                            </span>
                                        </li>
                                    </ul>
                                ) : (
                                    /* ── Paid league: money is involved, so nothing is left out ── */
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    You Pay
                                                </p>
                                                <p className="text-lg font-black text-sffl-navy dark:text-white">
                                                    {formatKobo(previewFee)}
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    Prize Pool So Far
                                                </p>
                                                <p className="text-lg font-black text-sffl-navy dark:text-white">
                                                    {formatKobo(num(preview.prize_pool_kobo))}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-300">
                                            The pool grows with every entry, so the figures below rise as more managers join.
                                        </p>

                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                                                    Who Gets What
                                                </h4>
                                            </div>
                                            {previewStructure.length === 0 ? (
                                                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                                                    No prize split has been published for this league yet.
                                                </p>
                                            ) : (
                                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {previewStructure.map((t, i) => (
                                                        <div
                                                            key={`tier-${num(t?.rank) || i + 1}`}
                                                            className="px-3 py-2 flex items-center justify-between gap-2"
                                                        >
                                                            <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-200">
                                                                {ordinal(num(t?.rank) || i + 1)}
                                                            </span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {fmtPercent(num(t?.percent))}
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                                                                {formatKobo(num(t?.amount_kobo))}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                                            <InformationCircleIcon className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                                            <span>
                                                Showtime keeps {fmtPercent(num(preview.cut_percent))} of entries to run the
                                                competition — {formatKobo(num(preview.platform_cut_kobo))} so far. The rest is the
                                                prize pool.
                                            </span>
                                        </p>

                                        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2">
                                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                                                    Your entry fee is not refundable
                                                </p>
                                                <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                                                    Once paid, {formatKobo(previewFee)} cannot be returned — not if you change your
                                                    mind, and not if you finish outside the prizes.
                                                </p>
                                            </div>
                                        </div>

                                        {!previewBlocked && (
                                            <p className="text-[11px] text-gray-600 dark:text-gray-300">
                                                Confirming takes you to Paystack to pay {formatKobo(previewFee)}. Your place is
                                                held once the payment clears.
                                            </p>
                                        )}
                                    </>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                    {previewBlocked ? (
                                        <>
                                            {previewStandingsId && (
                                                <Link
                                                    to={`/fantasy/leaderboard/${previewStandingsId}`}
                                                    onClick={() => setTermsTarget(null)}
                                                    className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-sffl-red hover:text-white text-gray-700 dark:text-gray-200 font-black text-xs uppercase text-center transition"
                                                >
                                                    View Standings
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setTermsTarget(null)}
                                                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs uppercase transition"
                                            >
                                                Close
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setTermsTarget(null)}
                                                className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs uppercase transition"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={confirmJoin}
                                                disabled={joinMutation.isPending}
                                                className="flex-1 py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                                            >
                                                {joinMutation.isPending ? (
                                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                                ) : previewIsPaid ? (
                                                    `Pay ${formatKobo(previewFee)} & Join`
                                                ) : (
                                                    'Join League'
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
