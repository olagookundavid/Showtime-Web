import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { claimApi, type ClaimablePlayerData, type VerifyClaimCodeData } from '../../services/api';

/**
 * The player account claim page.
 *
 * Unlisted rather than secret: there is no nav entry and it is marked noindex, but the
 * URL and the team code must both be assumed public — a code handed to a whole squad
 * will end up in a group chat. That is acceptable because the code only reveals player
 * names, jersey numbers and positions, all of which are already on the public roster
 * pages. What actually gates getting an account is the team manager approving the claim.
 */

type Step = 'code' | 'player' | 'account';

const NOT_LISTED = '__NOT_LISTED__';

export const ClaimAccountPage: React.FC = () => {
    const [step, setStep] = useState<Step>('code');
    const [submitting, setSubmitting] = useState(false);

    const [code, setCode] = useState('');
    const [team, setTeam] = useState<VerifyClaimCodeData | null>(null);

    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [fullName, setFullName] = useState('');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [position, setPosition] = useState('');

    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        document.title = 'Claim your player account — Showtime';
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
        return () => {
            document.head.removeChild(meta);
        };
    }, []);

    const isNotListed = selectedPlayerId === NOT_LISTED;
    const selectedPlayer: ClaimablePlayerData | undefined =
        team?.players.find(p => p.id === selectedPlayerId);

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setSubmitting(true);
        try {
            const res = await claimApi.verifyCode(code.trim());
            setTeam(res);
            setStep('player');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'That code is not valid. Please check with your team manager.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleContinueFromPlayer = () => {
        if (!selectedPlayerId) {
            toast.error('Please select your name, or choose "My name is not listed".');
            return;
        }
        if (isNotListed && !fullName.trim()) {
            toast.error('Please enter your full name so your manager can identify you.');
            return;
        }
        if (selectedPlayer) {
            setFullName(selectedPlayer.name);
        }
        setStep('account');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('The two passwords do not match.');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters, including a number and a symbol.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await claimApi.submit({
                code: code.trim(),
                email: email.trim(),
                password,
                phone: phone.trim(),
                player_id: isNotListed ? undefined : selectedPlayerId,
                full_name: fullName.trim(),
                proposed_jersey_number: isNotListed && jerseyNumber ? Number(jerseyNumber) : undefined,
                proposed_position: isNotListed ? position.trim() : undefined,
            });

            if (res.access_token) {
                localStorage.setItem('showtime_access_token', res.access_token);
            }
            toast.success(res.message);

            // Full reload so AuthProvider re-probes the session and picks up the new
            // player_pending role before the status screen renders.
            window.location.assign('/claim/status');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Could not submit your claim. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Claim your player account</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Enter the code your team manager gave you, find your name, and set a password.
                        Your manager confirms it is really you before your account goes live.
                    </p>
                </div>

                <ol className="flex items-center justify-center gap-2 mb-6 text-xs font-bold">
                    {(['code', 'player', 'account'] as Step[]).map((s, i) => (
                        <li key={s} className="flex items-center gap-2">
                            <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    step === s
                                        ? 'bg-sffl-red text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                }`}
                            >
                                {i + 1}
                            </span>
                            {i < 2 && <span className="w-6 h-px bg-gray-300 dark:bg-gray-600" />}
                        </li>
                    ))}
                </ol>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                    {step === 'code' && (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Team code
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. A7KD92QP"
                                    autoComplete="off"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                />
                                <p className="mt-2 text-xs text-gray-400">
                                    Do not have a code? Ask your team manager for it.
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || !code.trim()}
                                className="w-full py-3 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
                            >
                                {submitting ? 'Checking…' : 'Continue'}
                            </button>
                        </form>
                    )}

                    {step === 'player' && team && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                                {team.team_logo && (
                                    <img src={team.team_logo} alt={team.team_name} className="w-10 h-10 object-contain" />
                                )}
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{team.team_name}</div>
                                    <div className="text-xs text-gray-400">
                                        {team.players.length} player{team.players.length === 1 ? '' : 's'} available to claim
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Find your name
                                </label>
                                <select
                                    value={selectedPlayerId}
                                    onChange={e => setSelectedPlayerId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sffl-red"
                                >
                                    <option value="">Select your name…</option>
                                    {team.players.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                            {p.jersey_number ? ` — #${p.jersey_number}` : ''}
                                            {p.position ? ` (${p.position})` : ''}
                                        </option>
                                    ))}
                                    <option value={NOT_LISTED}>My name is not listed</option>
                                </select>
                                {team.players.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                        Every player on this team has already been claimed. If you should be on
                                        this squad, choose “My name is not listed”.
                                    </p>
                                )}
                            </div>

                            {isNotListed && (
                                <div className="space-y-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Your manager will create your player record once they confirm who you are.
                                    </p>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            Full name
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Jersey number
                                            </label>
                                            <input
                                                type="number"
                                                value={jerseyNumber}
                                                onChange={e => setJerseyNumber(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Position
                                            </label>
                                            <input
                                                type="text"
                                                value={position}
                                                onChange={e => setPosition(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('code')}
                                    className="px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleContinueFromPlayer}
                                    className="flex-1 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'account' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="p-3 rounded-lg bg-sffl-navy/5 dark:bg-blue-900/20 text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Claiming as </span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    {selectedPlayer?.name || fullName}
                                </span>
                                {team && <span className="text-gray-500 dark:text-gray-400"> · {team.team_name}</span>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Phone number
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    autoComplete="tel"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                    Helps your manager recognise you.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                    At least 8 characters, with a number and a symbol.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Confirm password
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep('player')}
                                    className="px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
                                >
                                    {submitting ? 'Submitting…' : 'Claim my account'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-gray-400">
                    Already claimed your account? <Link to="/login" className="font-bold text-sffl-red hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default ClaimAccountPage;
