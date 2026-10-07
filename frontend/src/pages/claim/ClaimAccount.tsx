import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { Button, Field, Input, Select, ConfirmDialog, ConfirmSummary } from '../../components';
import { claimApi } from '../../services/api';
import type { ClaimablePlayerData, VerifyClaimCodeData } from '../../types';
import { PLAYER_POSITIONS as CLAIM_POSITIONS } from '../../constants';

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

export const ClaimAccount: React.FC = () => {
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
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            toast.error(error.response?.data?.error || 'That code is not valid. Please check with your team manager.');
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
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            toast.error(error.response?.data?.error || 'Could not submit your claim. Please try again.');
            setSubmitting(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 py-8 sm:py-10 px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
                            <Field label="Team code" htmlFor="claim-team-code" hint="Do not have a code? Ask your team manager for it.">
                                <Input
                                    id="claim-team-code"
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. A7KD92QP"
                                    autoComplete="off"
                                />
                            </Field>
                            <Button
                                type="submit"
                                size="lg"
                                fullWidth
                                loading={submitting}
                                disabled={!code.trim()}
                            >
                                {submitting ? 'Checking' : 'Continue'}
                            </Button>
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
                                <Field label="Find your name" htmlFor="claim-player">
                                    <Select
                                        id="claim-player"
                                        value={selectedPlayerId}
                                        onChange={e => setSelectedPlayerId(e.target.value)}
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
                                    </Select>
                                </Field>
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
                                    <Field label="Full name" htmlFor="claim-full-name">
                                        <Input
                                            id="claim-full-name"
                                            type="text"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                        />
                                    </Field>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Jersey number" htmlFor="claim-jersey">
                                            <Input
                                                id="claim-jersey"
                                                type="number"
                                                value={jerseyNumber}
                                                onChange={e => setJerseyNumber(e.target.value)}
                                            />
                                        </Field>
                                        <Field label="Position" htmlFor="claim-position">
                                            <Select
                                                id="claim-position"
                                                value={position}
                                                onChange={e => setPosition(e.target.value)}
                                            >
                                                <option value="">Select position…</option>
                                                {CLAIM_POSITIONS.map(pos => (
                                                    <option key={pos} value={pos}>{pos}</option>
                                                ))}
                                            </Select>
                                        </Field>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="ghost" size="lg" onClick={() => setStep('code')}>
                                    Back
                                </Button>
                                <Button size="lg" className="flex-1" onClick={handleContinueFromPlayer}>
                                    Continue
                                </Button>
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

                            <Field label="Email address" htmlFor="claim-email">
                                <Input
                                    id="claim-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                />
                            </Field>

                            <Field label="Phone number" htmlFor="claim-phone" hint="Helps your manager recognise you.">
                                <Input
                                    id="claim-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    autoComplete="tel"
                                />
                            </Field>

                            <Field label="Password" htmlFor="claim-password" hint="At least 8 characters, with a number and a symbol.">
                                <Input
                                    id="claim-password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                />
                            </Field>

                            <Field label="Confirm password" htmlFor="claim-confirm-password">
                                <Input
                                    id="claim-confirm-password"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                />
                            </Field>

                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" size="lg" onClick={() => setStep('player')}>
                                    Back
                                </Button>
                                <Button type="submit" size="lg" className="flex-1" loading={submitting}>
                                    Claim my account
                                </Button>
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

export default ClaimAccount;
