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
    LockClosedIcon
} from '@heroicons/react/24/outline';
import { fantasyApi, formatKobo, type FantasyLeague } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

/** Nothing off the wire is trusted to be a finite number. */
const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

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
                setShowJoinModal(false);
                setInviteCodeInput('');
                queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['publicFantasyLeagues'] });
                queryClient.invalidateQueries({ queryKey: ['fantasyDashboard'] });
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || "Failed to join league");
        }
    });

    // Create League Mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!season?.id) throw new Error("Season not loaded");
            if (!createForm.name.trim()) throw new Error("League name required");
            return fantasyApi.createLeague({
                season_id: season.id,
                name: createForm.name.trim(),
                type: createForm.type,
                entry_fee: Math.round(createForm.entryFeeNaira * 100), // convert to kobo
                max_members: createForm.maxMembers,
            });
        },
        onSuccess: () => {
            toast.success("League created successfully!");
            setShowCreateModal(false);
            setCreateForm({ name: '', type: 'PUBLIC', entryFeeNaira: 0, maxMembers: 50 });
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

    // Joining a public league straight from its card. Paid leagues come back
    // with a paystack_url and are redirected by the shared onSuccess handler.
    const handleJoinPublic = (league: FantasyLeague) => {
        if (!isAuthenticated) {
            navigate('/login?redirect=/fantasy/leagues');
            return;
        }
        if (joinMutation.isPending) return;
        joinMutation.mutate({ league_id: league.id });
    };

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
                                                    onClick={() => handleJoinPublic(l)}
                                                    disabled={joinMutation.isPending}
                                                    title={
                                                        fee > 0
                                                            ? `Entry fee ${formatKobo(fee)} — you'll be sent to Paystack to pay`
                                                            : 'Free to join'
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
                            onClick={() => joinMutation.mutate({ invite_code: inviteCodeInput.trim() })}
                            disabled={!inviteCodeInput.trim() || joinMutation.isPending}
                            className="w-full py-3 rounded-xl bg-sffl-red hover:bg-[#A52323] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-black text-xs uppercase transition shadow-md cursor-pointer"
                        >
                            {joinMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                                'Join League'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Create League Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl">
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

                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={!createForm.name.trim() || createMutation.isPending}
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
        </div>
    );
}
