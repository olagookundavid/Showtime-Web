import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { claimApi, type MyClaimStatusData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useImageUpload } from '../../hooks/useImageUpload';

/**
 * The one screen a player_pending user can see.
 *
 * This exists so a claimant gets real feedback instead of staring at a form wondering
 * whether it submitted. It is also where they attach their photo: the backend pins a
 * player_pending caller's upload folder to claim-photos, so being signed in is what
 * makes the upload safe to allow at all — and that photo is the main thing the manager
 * identifies them by.
 */
export const ClaimStatusPage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { uploadImage, isUploading } = useImageUpload();

    const [claim, setClaim] = useState<MyClaimStatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await claimApi.getMyStatus();
            setClaim(res);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Could not load your claim status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = 'Your claim status — Showtime';
        fetchStatus();
    }, []);

    // An approved claimant is a full player now, so send them where they belong.
    useEffect(() => {
        if (claim?.status === 'APPROVED' && user?.role === 'player') {
            navigate('/player-portal', { replace: true });
        }
    }, [claim?.status, user?.role, navigate]);

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = await uploadImage(file, 'claim-photos', { maxSizeMB: 0.5, maxWidthOrHeight: 800 });
        if (!url) {
            toast.error('Could not upload that photo. Please try again.');
            return;
        }
        try {
            await claimApi.setMyPhoto(url);
            toast.success('Photo saved. Your manager can now see it.');
            fetchStatus();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Could not save your photo');
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            await claimApi.resendVerification();
            toast.success('Verification email sent.');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Could not resend the verification email');
        } finally {
            setResending(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-400">Loading your claim…</div>
            </div>
        );
    }

    if (!claim?.has_claim) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md text-center">
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">No claim found</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        We could not find a player account claim for this login.
                    </p>
                    <Link
                        to="/claim"
                        className="inline-block mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
                    >
                        Start a claim
                    </Link>
                </div>
            </div>
        );
    }

    const isPending = claim.status === 'PENDING';
    const isRejected = claim.status === 'REJECTED';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
            <div className="max-w-lg mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div
                        className={`p-6 text-center ${
                            isPending
                                ? 'bg-amber-50 dark:bg-amber-900/20'
                                : isRejected
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : 'bg-green-50 dark:bg-green-900/20'
                        }`}
                    >
                        <div className="text-3xl mb-2">{isPending ? '⏳' : isRejected ? '✕' : '✓'}</div>
                        <h1 className="text-lg font-black text-gray-900 dark:text-white">
                            {isPending
                                ? 'Waiting for your team manager'
                                : isRejected
                                ? 'Your claim was not approved'
                                : 'Your account is approved'}
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {isPending
                                ? `${claim.team_name || 'Your team'}'s manager needs to confirm it is really you.`
                                : isRejected
                                ? claim.reject_reason || 'Please speak with your team manager.'
                                : 'You now have full access to your player portal.'}
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        <dl className="space-y-3 text-sm">
                            {claim.player_name && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                                    <dd className="font-bold text-gray-900 dark:text-white">{claim.player_name}</dd>
                                </div>
                            )}
                            {claim.team_name && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Team</dt>
                                    <dd className="font-bold text-gray-900 dark:text-white">{claim.team_name}</dd>
                                </div>
                            )}
                            <div className="flex justify-between gap-4">
                                <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                                <dd className="text-right">
                                    <span className="font-bold text-gray-900 dark:text-white">{claim.claimed_email}</span>
                                    {claim.email_verified ? (
                                        <span className="ml-2 text-xs font-bold text-green-600 dark:text-green-400">confirmed</span>
                                    ) : (
                                        <span className="ml-2 text-xs font-bold text-amber-600 dark:text-amber-400">unconfirmed</span>
                                    )}
                                </dd>
                            </div>
                            {claim.claimed_phone && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
                                    <dd className="font-bold text-gray-900 dark:text-white">{claim.claimed_phone}</dd>
                                </div>
                            )}
                        </dl>

                        {!claim.email_verified && (
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Confirming your email is not required for approval, but it is what lets you
                                    reset your password later.
                                </p>
                                <button
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="mt-2 text-xs font-bold text-sffl-red hover:underline disabled:opacity-50"
                                >
                                    {resending ? 'Sending…' : 'Resend confirmation email'}
                                </button>
                            </div>
                        )}

                        {isPending && (
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-4">
                                    {claim.claimed_photo ? (
                                        <img
                                            src={claim.claimed_photo}
                                            alt="Your photo"
                                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
                                            📷
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {claim.claimed_photo ? 'Your photo' : 'Add a photo of yourself'}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            This is how your manager recognises you. It speeds up approval a lot.
                                        </p>
                                        <label className="inline-block mt-2 px-3 py-1.5 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 text-xs font-bold rounded-lg cursor-pointer">
                                            {isUploading ? 'Uploading…' : claim.claimed_photo ? 'Replace photo' : 'Upload photo'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhoto}
                                                disabled={isUploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {claim.status === 'APPROVED' && (
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                {/* Full reload rather than a router navigation: this session was
                                    issued while the account was still player_pending, so the
                                    cached profile has to be re-fetched before the portal's role
                                    guard will let them through. */}
                                <button
                                    onClick={() => window.location.assign('/player-portal')}
                                    className="w-full py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                                >
                                    Go to my player portal
                                </button>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={fetchStatus}
                                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                Refresh status
                            </button>
                            <button
                                onClick={async () => {
                                    await logout();
                                    navigate('/');
                                }}
                                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClaimStatusPage;
