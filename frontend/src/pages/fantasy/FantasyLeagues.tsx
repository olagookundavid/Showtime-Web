import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
    TrophyIcon, 
    UserGroupIcon, 
    PlusIcon, 
    KeyIcon, 
    ArrowRightIcon, 
    ShieldCheckIcon, 
    XMarkIcon 
} from '@heroicons/react/24/outline';
import { fantasyApi, type FantasyLeague } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../../components/ui/Loader';

// max_members of 0 means unlimited.
const isLeagueFull = (l: FantasyLeague) => l.max_members > 0 && l.member_count >= l.max_members;

const formatMembers = (l: FantasyLeague) =>
    l.max_members > 0
        ? `${l.member_count} / ${l.max_members} managers`
        : `${l.member_count} ${l.member_count === 1 ? 'manager' : 'managers'}`;

export function FantasyLeagues() {
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
        mutationFn: async (code: string) => {
            if (!season?.id) throw new Error("Season not loaded");
            return fantasyApi.joinLeague(season.id, code);
        },
        onSuccess: (data) => {
            if (data.paystack_url) {
                toast.success("Redirecting to Paystack for league entry fee...");
                window.location.href = data.paystack_url;
            } else {
                toast.success(`Joined ${data.league_name} successfully!`);
                setShowJoinModal(false);
                setInviteCodeInput('');
                queryClient.invalidateQueries({ queryKey: ['myFantasyLeagues'] });
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
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err.message || "Failed to create league");
        }
    });

    if (authLoading || seasonLoading) {
        return <Loader />;
    }

    if (!season) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                <ShieldCheckIcon className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-black uppercase text-white mb-2">No Active Season</h1>
                <p className="text-neutral-400 max-w-md mb-6">Fantasy leagues are currently closed. Please check back later.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white pb-24">
            {/* Top Bar */}
            <div className="border-b border-neutral-800 bg-neutral-950/80 px-4 sm:px-6 py-8">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase mb-2">
                            <TrophyIcon className="w-3.5 h-3.5" /> Leagues & Pools
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-white">
                            Compete & Win
                        </h1>
                        <p className="text-sm text-neutral-400 mt-1">
                            Join private friend leagues, company pools, or official Showtime cash prize tournaments.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs uppercase flex items-center gap-2 transition"
                        >
                            <KeyIcon className="w-3.5 h-3.5 text-yellow-400" /> Join via Code
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs uppercase flex items-center gap-2 transition active:scale-95 shadow-lg shadow-yellow-500/20"
                        >
                            <PlusIcon className="w-4 h-4" /> Create League
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-12">
                {/* My Leagues Section */}
                {isAuthenticated && (
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4 flex items-center gap-2">
                            <UserGroupIcon className="w-5 h-5 text-yellow-400" /> My Leagues
                        </h2>

                        {myLeaguesLoading ? (
                            <div className="py-8 flex justify-center">
                                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : myLeagues.length === 0 ? (
                            <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800/80 text-center">
                                <p className="text-sm text-neutral-400">You haven't joined any custom leagues yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myLeagues.map((l) => (
                                    <div
                                        key={l.id}
                                        className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between hover:border-neutral-700 transition"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                                    {l.type}
                                                </span>
                                                {l.invite_code && (
                                                    <span className="text-xs font-mono text-yellow-400 font-bold">
                                                        Code: {l.invite_code}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-bold text-white mt-1">{l.name}</h3>
                                            <p className="text-xs text-neutral-400 mt-0.5">
                                                Entry: {l.entry_fee > 0 ? `₦${(l.entry_fee / 100).toLocaleString()}` : 'Free'}
                                                <span className="text-neutral-600"> · </span>
                                                {formatMembers(l)}
                                            </p>
                                        </div>

                                        <Link
                                            to={`/fantasy/leaderboard/${l.id}`}
                                            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1 transition"
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
                    <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4 flex items-center gap-2">
                        <TrophyIcon className="w-5 h-5 text-emerald-400" /> Official & Public Leagues
                    </h2>

                    {publicLeaguesLoading ? (
                        <div className="py-8 flex justify-center">
                            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : publicLeagues.length === 0 ? (
                        <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800/80 text-center">
                            <p className="text-sm text-neutral-400">No public leagues open at this moment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {publicLeagues.map((l) => (
                                <div
                                    key={l.id}
                                    className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between hover:border-neutral-700 transition"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                                {l.type}
                                            </span>
                                            <span className="text-xs text-neutral-400">
                                                {l.entry_fee > 0 ? `Entry: ₦${(l.entry_fee / 100).toLocaleString()}` : 'Free Entry'}
                                            </span>
                                            {isLeagueFull(l) && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                                    Full
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-bold text-white mt-1">{l.name}</h3>
                                        <p className="text-xs text-neutral-400 mt-0.5">{formatMembers(l)}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            to={`/fantasy/leaderboard/${l.id}`}
                                            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1 transition"
                                        >
                                            Standings <ArrowRightIcon className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Join League Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-white uppercase">Join with Invite Code</h3>
                            <button onClick={() => setShowJoinModal(false)} className="p-1 rounded-lg bg-neutral-800 text-neutral-400">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-neutral-400 mb-4">
                            Enter the 6-character private invite code provided by your league commissioner.
                        </p>
                        <input
                            type="text"
                            value={inviteCodeInput}
                            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                            placeholder="e.g. ABC123"
                            maxLength={8}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-center text-xl font-mono font-bold tracking-widest text-yellow-400 focus:outline-none focus:border-yellow-500 mb-4"
                        />
                        <button
                            onClick={() => joinMutation.mutate(inviteCodeInput.trim())}
                            disabled={!inviteCodeInput.trim() || joinMutation.isPending}
                            className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-800 text-black font-extrabold text-xs uppercase transition"
                        >
                            {joinMutation.isPending ? (
                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                                'Join League'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Create League Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-white uppercase">Create New League</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg bg-neutral-800 text-neutral-400">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">League Name</label>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="e.g. Lagos Flag Masters"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">Privacy Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCreateForm({ ...createForm, type: 'PUBLIC' })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${
                                            createForm.type === 'PUBLIC'
                                                ? 'bg-yellow-500 text-black border-yellow-500'
                                                : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                                        }`}
                                    >
                                        Public
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreateForm({ ...createForm, type: 'PRIVATE' })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${
                                            createForm.type === 'PRIVATE'
                                                ? 'bg-yellow-500 text-black border-yellow-500'
                                                : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                                        }`}
                                    >
                                        Private (Code Only)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-neutral-400 uppercase block mb-1">Entry Fee (₦ Naira, 0 for Free)</label>
                                <input
                                    type="number"
                                    value={createForm.entryFeeNaira}
                                    onChange={(e) => setCreateForm({ ...createForm, entryFeeNaira: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={!createForm.name.trim() || createMutation.isPending}
                                className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-800 text-black font-extrabold text-xs uppercase transition mt-2"
                            >
                                {createMutation.isPending ? (
                                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
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
