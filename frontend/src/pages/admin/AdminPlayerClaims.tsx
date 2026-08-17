import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminClaimsApi, type ClaimCodeData, type PlayerClaimData } from '../../services/api';

/**
 * Cross-team oversight of the player account claim flow.
 *
 * Admins can act on any team's claims and, uniquely, revoke an approval — the escape
 * hatch for when a manager approves the wrong person. Revoking demotes the account back
 * to player_pending and returns the claim to the review queue rather than deleting
 * anything, so the mistake is recoverable in both directions.
 */
export const AdminPlayerClaims: React.FC = () => {
    const [claims, setClaims] = useState<PlayerClaimData[]>([]);
    const [codes, setCodes] = useState<ClaimCodeData[]>([]);
    const [status, setStatus] = useState<string>('PENDING');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [showCodes, setShowCodes] = useState(false);

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const res = await adminClaimsApi.list({
                status: status || 'ALL',
                search: search || undefined,
                limit: 100,
            });
            setClaims(res.data || []);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to load claims');
        } finally {
            setLoading(false);
        }
    };

    const fetchCodes = async () => {
        try {
            setCodes(await adminClaimsApi.listCodes());
        } catch {
            setCodes([]);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, [status]);

    useEffect(() => {
        if (showCodes) fetchCodes();
    }, [showCodes]);

    const label = (c: PlayerClaimData) => c.player_name || c.proposed_name || c.claimed_email;

    const handleApprove = async (c: PlayerClaimData) => {
        if (!window.confirm(`Approve ${label(c)}? This creates their player login.`)) return;
        setActing(c.id);
        try {
            await adminClaimsApi.approve(c.id);
            toast.success(`${label(c)} approved`);
            fetchClaims();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to approve');
        } finally {
            setActing(null);
        }
    };

    const handleReject = async (c: PlayerClaimData) => {
        const reason = window.prompt(`Reason for rejecting ${label(c)}?`, '');
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error('A reason is required.');
            return;
        }
        setActing(c.id);
        try {
            await adminClaimsApi.reject(c.id, reason.trim());
            toast.success('Claim rejected');
            fetchClaims();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to reject');
        } finally {
            setActing(null);
        }
    };

    const handleRevoke = async (c: PlayerClaimData) => {
        if (!window.confirm(
            `Revoke the approval for ${label(c)}?\n\nTheir account drops back to pending, they lose player portal access, and the claim returns to the review queue.`
        )) return;
        setActing(c.id);
        try {
            await adminClaimsApi.revoke(c.id);
            toast.success('Approval revoked');
            fetchClaims();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to revoke');
        } finally {
            setActing(null);
        }
    };

    const handleRevokeCode = async (id: string) => {
        if (!window.confirm('Revoke this code? That team cannot claim accounts until a new one is generated.')) return;
        try {
            await adminClaimsApi.revokeCode(id);
            toast.success('Code revoked');
            fetchCodes();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to revoke the code');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase tracking-tight">
                        Player Account Claims
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Team managers review their own squads. Use this to oversee every team and to undo a
                        wrong approval.
                    </p>
                </div>
                <button
                    onClick={() => setShowCodes(v => !v)}
                    className="px-4 py-2 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 text-sm font-bold rounded-lg"
                >
                    {showCodes ? 'Hide claim codes' : 'Show claim codes'}
                </button>
            </div>

            {showCodes && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Team</th>
                                    <th className="p-4">Code</th>
                                    <th className="p-4">Uses</th>
                                    <th className="p-4">Expires</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {codes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">
                                            No live claim codes. Managers generate their own from their dashboard.
                                        </td>
                                    </tr>
                                ) : (
                                    codes.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="p-4 font-semibold text-gray-900 dark:text-white">{c.team_name || '—'}</td>
                                            <td className="p-4 font-mono font-bold tracking-widest text-gray-900 dark:text-white">{c.code}</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-300">{c.uses} / {c.max_uses}</td>
                                            <td className="p-4 text-gray-600 dark:text-gray-300">
                                                {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleRevokeCode(c.id)}
                                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold rounded-lg"
                                                >
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                    <option value="PENDING">Awaiting review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="">All statuses</option>
                </select>
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        fetchClaims();
                    }}
                    className="flex gap-2 flex-1 min-w-[240px]"
                >
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by player name or email…"
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                    <button type="submit" className="px-4 py-2 bg-sffl-navy text-white text-sm font-bold rounded-lg">
                        Search
                    </button>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading claims…</div>
                ) : claims.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No claims match this filter.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Claimant</th>
                                    <th className="p-4">Team</th>
                                    <th className="p-4">Record</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                {claims.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {c.claimed_photo ? (
                                                    <img src={c.claimed_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {label(c)}
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {c.claimed_email}
                                                        {!c.email_verified && ' · unconfirmed'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-gray-300">{c.team_name || '—'}</td>
                                        <td className="p-4 text-gray-600 dark:text-gray-300">
                                            {c.is_new_player_request ? (
                                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                    New player request
                                                </span>
                                            ) : (
                                                <span className="text-xs">
                                                    {c.matches_played} match{c.matches_played === 1 ? '' : 'es'}
                                                    {c.past_teams?.length ? ` · ${c.past_teams.join(', ')}` : ''}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                    c.status === 'PENDING'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : c.status === 'APPROVED'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}
                                            >
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                                            {c.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => handleReject(c)}
                                                        disabled={acting === c.id}
                                                        className="px-3 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold rounded-lg"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(c)}
                                                        disabled={acting === c.id}
                                                        className="px-3 py-1 bg-sffl-red hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                                                    >
                                                        Approve
                                                    </button>
                                                </>
                                            )}
                                            {c.status === 'APPROVED' && (
                                                <button
                                                    onClick={() => handleRevoke(c)}
                                                    disabled={acting === c.id}
                                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg"
                                                >
                                                    Revoke approval
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPlayerClaims;
