import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowPathIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
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

// Position choices for a brand-new (unlisted) claim. Center is rated
// identically to Receiver — see backend/internal/domain/player_rating.go
// RateByPosition. No "-" option here (that's an admin-only "unrated" sentinel,
// not something a self-service claimant should pick).
const CLAIM_POSITIONS = ['QB', 'Receiver', 'Center', 'Defender', 'Rusher', 'Allrounder'];

const fieldClass = 'w-full min-h-11 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white';
const smallFieldClass = 'w-full min-h-11 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm';

export const ClaimAccountPage: React.FC = () => {
    const [step, setStep] = useState<Step>('code');
    const [submitting, setSubmitting] = useState(false);
    // Submitting the claim creates the account, so it asks first.
    const [confirmOpen, setConfirmOpen] = useState(false);

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

    // Runs before the confirm dialog opens, so it never asks about a claim that can't be sent.
    const requestSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('The two passwords do not match.');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters, including a number and a symbol.');
            return;
        }
        setConfirmOpen(true);
    };

    const handleSubmit = async () => {
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
            // The dialog stays in its pending state until the page unloads, so it never flashes shut.
            window.location.assign('/claim/status');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Could not submit your claim. Please try again.');
            setSubmitting(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 sm:py-10 px-4">
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

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
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
                                    className={`${fieldClass} font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-sffl-red`}
                                />
                                <p className="mt-2 text-xs text-gray-400">
                                    Do not have a code? Ask your team manager for it.
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || !code.trim()}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 min-h-11 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
                            >
                                {submitting && <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                {submitting ? 'Checking' : 'Continue'}
                            </button>
                        </form>
                    )}

                    {step === 'player' && team && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                                {team.team_logo && (
                                    <img src={team.team_logo} alt={team.team_name} className="w-10 h-10 shrink-0 object-contain" />
                                )}
                                <div className="min-w-0">
                                    <div className="font-bold text-gray-900 dark:text-white wrap-break-word">{team.team_name}</div>
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
                                    className={`${fieldClass} focus:outline-none focus:ring-2 focus:ring-sffl-red`}
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
                                        Because you are not on the roster, the league office decides this one, not
                                        your team manager — your manager is asked to confirm they know you, then the
                                        league office adds you. It usually takes a little longer than a normal claim.
                                    </p>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            Full name
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            className={smallFieldClass}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Jersey number
                                            </label>
                                            <input
                                                type="number"
                                                value={jerseyNumber}
                                                onChange={e => setJerseyNumber(e.target.value)}
                                                className={smallFieldClass}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                Position
                                            </label>
                                            <select
                                                value={position}
                                                onChange={e => setPosition(e.target.value)}
                                                className={smallFieldClass}
                                            >
                                                <option value="">Select position…</option>
                                                {CLAIM_POSITIONS.map(pos => (
                                                    <option key={pos} value={pos}>{pos}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('code')}
                                    className="px-4 py-3 min-h-11 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleContinueFromPlayer}
                                    className="flex-1 py-3 min-h-11 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'account' && (
                        <form onSubmit={requestSubmit} className="space-y-4">
                            <div className="p-3 rounded-lg bg-sffl-navy/5 dark:bg-blue-900/20 text-sm wrap-break-word">
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
                                    className={fieldClass}
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
                                    className={fieldClass}
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
                                    className={fieldClass}
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
                                    className={fieldClass}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep('player')}
                                    className="px-4 py-3 min-h-11 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 min-h-11 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
                                >
                                    Claim my account
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-gray-400">
                    Already claimed your account? <Link to="/login" className="inline-flex items-center min-h-11 font-bold text-sffl-red hover:underline">Sign in</Link>
                </p>
            </div>

            {/* Outside the form, so the dialog's buttons can never submit it. */}
            <ConfirmDialog
                open={confirmOpen}
                title="Submit your claim?"
                description={isNotListed
                    ? 'Because you are not on the roster, the league office decides this one after your manager confirms they know you. It usually takes a little longer than a normal claim.'
                    : 'Your team manager confirms it is really you before your account goes live.'}
                body={(
                    <ConfirmSummary rows={[
                        ['Name', selectedPlayer?.name || fullName.trim()],
                        ['Team', team?.team_name],
                        ...(isNotListed
                            ? [
                                ['Jersey', jerseyNumber ? `#${jerseyNumber}` : undefined] as [string, string | undefined],
                                ['Position', position || undefined] as [string, string | undefined],
                            ]
                            : []),
                        ['Email', email.trim()],
                        ['Phone', phone.trim()],
                    ]} />
                )}
                confirmLabel="Submit Claim"
                tone="info"
                icon={UserPlusIcon}
                pending={submitting}
                onConfirm={handleSubmit}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};

export default ClaimAccountPage;
