import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { teamHeadClaimsApi, type ClaimCodeData, type PlayerClaimData } from '../../services/api';

/**
 * The team manager's claim review screen.
 *
 * Every player was imported from historical data with no email, phone or photo, so there
 * is no contact detail to authenticate anyone against. The manager knowing these people
 * personally is the only identity check available — which is why each card puts what the
 * claimant submitted next to what the system already knows about that player. A claimant
 * can invent an email address; they cannot invent a season of appearances.
 */
export const TeamHeadClaims: React.FC = () => {
    const [claims, setClaims] = useState<PlayerClaimData[]>([]);
    const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);

    const [code, setCode] = useState<ClaimCodeData | null>(null);
    const [codeLoading, setCodeLoading] = useState(true);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const res = await teamHeadClaimsApi.list({ status, limit: 100 });
            setClaims(res.data || []);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to load claims');
        } finally {
            setLoading(false);
        }
    };

    const fetchCode = async () => {
        setCodeLoading(true);
        try {
            setCode(await teamHeadClaimsApi.getCode());
        } catch {
            setCode(null);
        } finally {
            setCodeLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, [status]);

    useEffect(() => {
        fetchCode();
    }, []);

    const handleGenerateCode = async () => {
        if (code && !window.confirm('This replaces your current code. Anyone still using the old one will need the new code. Continue?')) {
            return;
        }
        try {
            const fresh = await teamHeadClaimsApi.generateCode();
            setCode(fresh);
            toast.success('New claim code generated');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to generate a code');
        }
    };

    const handleRevokeCode = async () => {
        if (!code) return;
        if (!window.confirm('Revoke this code? Players will not be able to claim their accounts until you generate a new one.')) return;
        try {
            await teamHeadClaimsApi.revokeCode(code.id);
            setCode(null);
            toast.success('Claim code revoked');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to revoke the code');
        }
    };

    const handleApprove = async (claim: PlayerClaimData) => {
        const who = claim.player_name || claim.proposed_name || claim.claimed_email;

        let confirmMsg = `Approve ${who}? This creates their login and gives them access to their player portal.`;
        if (!claim.email_verified) {
            confirmMsg = `${who} has not confirmed their email address yet.\n\nApproving is still fine if you know this is them — it only means they may need help resetting a password later.\n\nApprove anyway?`;
        }
        if (!window.confirm(confirmMsg)) return;

        // For a new-player request the manager owns the roster fields, so offer a chance
        // to correct them before the players row is created.
        const payload: { name?: string; jersey_number?: number; position?: string } = {};
        if (claim.is_new_player_request) {
            const name = window.prompt('Player name (as it should appear on the roster):', claim.proposed_name || '');
            if (name === null) return;
            payload.name = name.trim();

            const jersey = window.prompt('Jersey number:', claim.proposed_jersey_number ? String(claim.proposed_jersey_number) : '');
            if (jersey && Number(jersey) > 0) payload.jersey_number = Number(jersey);

            const position = window.prompt('Position:', claim.proposed_position || '');
            if (position) payload.position = position.trim();
        }

        setActing(claim.id);
        try {
            await teamHeadClaimsApi.approve(claim.id, payload);
            toast.success(`${who} approved`);
            fetchClaims();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to approve the claim');
        } finally {
            setActing(null);
        }
    };

    const handleReject = async (claim: PlayerClaimData) => {
        const who = claim.player_name || claim.proposed_name || claim.claimed_email;
        const reason = window.prompt(`Why are you rejecting ${who}? They will see this reason.`, '');
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error('A reason is required.');
            return;
        }

        setActing(claim.id);
        try {
            await teamHeadClaimsApi.reject(claim.id, reason.trim());
            toast.success('Claim rejected');
            fetchClaims();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to reject the claim');
        } finally {
            setActing(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* The code a manager gives their squad */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">
                    Your team claim code
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Share this with your squad. They enter it at <span className="font-mono">/claim</span> to find
                    their name and set a password. Nothing happens until you approve them here.
                </p>

                {codeLoading ? (
                    <div className="mt-4 text-sm text-gray-400">Loading…</div>
                ) : code ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <code className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 font-mono text-lg font-black tracking-widest text-gray-900 dark:text-white">
                            {code.code}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(code.code);
                                toast.success('Code copied');
                            }}
                            className="px-3 py-2 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 text-xs font-bold rounded-lg"
                        >
                            Copy
                        </button>
                        <button
                            onClick={handleGenerateCode}
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg"
                        >
                            Rotate
                        </button>
                        <button
                            onClick={handleRevokeCode}
                            className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold rounded-lg"
                        >
                            Revoke
                        </button>
                        <span className="text-xs text-gray-400">
                            used {code.uses} of {code.max_uses}
                            {code.expires_at && ` · expires ${new Date(code.expires_at).toLocaleDateString()}`}
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={handleGenerateCode}
                        className="mt-4 px-4 py-2 bg-sffl-red hover:bg-red-700 text-white text-sm font-bold rounded-lg"
                    >
                        Generate a claim code
                    </button>
                )}
            </div>

            {/* Review queue */}
            <div>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
                                status === s
                                    ? 'border-sffl-red text-sffl-red'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {s === 'PENDING' ? 'Awaiting review' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading claims…</div>
                ) : claims.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        {status === 'PENDING'
                            ? 'No claims awaiting your review.'
                            : `No ${status.toLowerCase()} claims.`}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {claims.map(claim => (
                            <div
                                key={claim.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
                                    {/* What the claimant submitted */}
                                    <div className="p-5">
                                        <div className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">
                                            They say they are
                                        </div>
                                        <div className="flex items-start gap-4">
                                            {claim.claimed_photo ? (
                                                <img
                                                    src={claim.claimed_photo}
                                                    alt="Submitted photo"
                                                    className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 text-center px-1">
                                                    No photo
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 text-sm space-y-1">
                                                <div className="font-bold text-gray-900 dark:text-white truncate">
                                                    {claim.player_name || claim.proposed_name || '—'}
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-300 truncate">
                                                    {claim.claimed_email}
                                                    {claim.email_verified ? (
                                                        <span className="ml-2 text-xs font-bold text-green-600 dark:text-green-400">
                                                            confirmed
                                                        </span>
                                                    ) : (
                                                        <span className="ml-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                                                            unconfirmed
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-300">
                                                    {claim.claimed_phone || 'No phone given'}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    submitted {new Date(claim.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        {claim.is_new_player_request && (
                                            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs">
                                                <div className="font-bold text-amber-700 dark:text-amber-400">
                                                    Not on your roster — asking to be added
                                                </div>
                                                <div className="mt-1 text-gray-600 dark:text-gray-300">
                                                    Proposed: {claim.proposed_name || '—'}
                                                    {claim.proposed_jersey_number ? ` · #${claim.proposed_jersey_number}` : ''}
                                                    {claim.proposed_position ? ` · ${claim.proposed_position}` : ''}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* What the system already knows */}
                                    <div className="p-5 bg-gray-50/50 dark:bg-gray-900/30">
                                        <div className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">
                                            What our records show
                                        </div>
                                        {claim.is_new_player_request ? (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                No existing record — this player has never been on the platform.
                                                Approving creates their roster entry and a 10-match contract.
                                            </p>
                                        ) : (
                                            <dl className="text-sm space-y-2">
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Roster name</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white text-right">
                                                        {claim.player_name || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Jersey</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.player_jersey_number ? `#${claim.player_jersey_number}` : '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Position</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.player_position || '—'}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Matches played</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white">
                                                        {claim.matches_played}
                                                    </dd>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <dt className="text-gray-500 dark:text-gray-400">Teams</dt>
                                                    <dd className="font-bold text-gray-900 dark:text-white text-right">
                                                        {claim.past_teams?.length ? claim.past_teams.join(', ') : '—'}
                                                    </dd>
                                                </div>
                                            </dl>
                                        )}
                                    </div>
                                </div>

                                {claim.status === 'PENDING' ? (
                                    <div className="px-5 py-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 justify-end">
                                        <button
                                            onClick={() => handleReject(claim)}
                                            disabled={acting === claim.id}
                                            className="px-4 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-sm font-bold rounded-lg"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(claim)}
                                            disabled={acting === claim.id}
                                            className="px-5 py-2 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
                                        >
                                            {acting === claim.id ? 'Working…' : 'Approve'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="px-5 py-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
                                        {claim.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                        {claim.reviewed_at && ` on ${new Date(claim.reviewed_at).toLocaleDateString()}`}
                                        {claim.reject_reason && ` — ${claim.reject_reason}`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamHeadClaims;
