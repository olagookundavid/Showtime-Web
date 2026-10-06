import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { claimApi, type MyClaimStatusData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui';
import { Spinner } from '../../components/ui/Spinner';
import {
    ArrowPathIcon,
    ArrowRightOnRectangleIcon,
    CameraIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

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
    const [confirmLogout, setConfirmLogout] = useState(false);

    const [claim, setClaim] = useState<MyClaimStatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await claimApi.getMyStatus();
            setClaim(res);
        } catch (err: unknown) {
            const message =
                typeof err === 'object' && err !== null && 'response' in err
                    ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                    : undefined;
            toast.error(message || 'Could not load your claim status');
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
        } catch (err: unknown) {
            const message =
                typeof err === 'object' && err !== null && 'response' in err
                    ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                    : undefined;
            toast.error(message || 'Could not save your photo');
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            await claimApi.resendVerification();
            toast.success('Verification email sent.');
        } catch (err: unknown) {
            const message =
                typeof err === 'object' && err !== null && 'response' in err
                    ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                    : undefined;
            toast.error(message || 'Could not resend the verification email');
        } finally {
            setResending(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Spinner label="Loading your claim…" />
            </div>
        );
    }

    if (!claim?.has_claim) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-md text-center">
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">No claim found</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        We could not find a player account claim for this login.
                    </p>
                    <Link
                        to="/claim"
                        className="inline-flex items-center justify-center min-h-11 mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
                    >
                        Start a claim
                    </Link>
                </div>
            </div>
        );
    }

    const isPending = claim.status === 'PENDING';
    const isRejected = claim.status === 'REJECTED';
    // Someone who was not on the roster is reviewed by the league office, not their
    // manager. Saying "your manager" here would send them chasing the wrong person.
    const isNewPlayerRequest = claim.claim_kind === 'NEW_PLAYER';

    return (
        <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 py-6 sm:py-10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="max-w-lg mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div
                        className={`p-4 sm:p-6 text-center ${
                            isPending
                                ? 'bg-amber-50 dark:bg-amber-900/20'
                                : isRejected
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : 'bg-green-50 dark:bg-green-900/20'
                        }`}
                    >
                        {isPending ? (
                            <ClockIcon className="w-9 h-9 mx-auto mb-2 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        ) : isRejected ? (
                            <XCircleIcon className="w-9 h-9 mx-auto mb-2 text-red-600 dark:text-red-400" aria-hidden="true" />
                        ) : (
                            <CheckCircleIcon className="w-9 h-9 mx-auto mb-2 text-green-600 dark:text-green-400" aria-hidden="true" />
                        )}
                        <h1 className="text-lg font-black text-gray-900 dark:text-white">
                            {isPending
                                ? isNewPlayerRequest
                                    ? 'Waiting for the league office'
                                    : 'Waiting for your team manager'
                                : isRejected
                                ? 'Your claim was not approved'
                                : 'Your account is approved'}
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {isPending
                                ? isNewPlayerRequest
                                    ? `You are not on ${claim.team_name || 'the team'}'s roster yet, so the league office reviews this. Your manager is being asked to confirm they know you. This takes longer than a normal claim.`
                                    : `${claim.team_name || 'Your team'}'s manager needs to confirm it is really you.`
                                : isRejected
                                ? claim.reject_reason || 'Please speak with your team manager.'
                                : 'You now have full access to your player portal.'}
                        </p>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <dl className="space-y-3 text-sm">
                            {claim.player_name && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                                    <dd className="min-w-0 text-right wrap-break-word font-bold text-gray-900 dark:text-white">{claim.player_name}</dd>
                                </div>
                            )}
                            {claim.team_name && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Team</dt>
                                    <dd className="min-w-0 text-right wrap-break-word font-bold text-gray-900 dark:text-white">{claim.team_name}</dd>
                                </div>
                            )}
                            <div className="flex justify-between gap-4">
                                <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                                <dd className="min-w-0 text-right">
                                    <span className="font-bold text-gray-900 dark:text-white break-all">{claim.claimed_email}</span>
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
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="mt-1"
                                    loading={resending}
                                    onClick={handleResend}
                                >
                                    {resending ? 'Sending…' : 'Resend confirmation email'}
                                </Button>
                            </div>
                        )}

                        {isPending && (
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    {claim.claimed_photo ? (
                                        <img
                                            src={claim.claimed_photo}
                                            alt="Your photo"
                                            className="w-16 h-16 shrink-0 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                            <CameraIcon className="w-7 h-7" aria-hidden="true" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {claim.claimed_photo ? 'Your photo' : 'Add a photo of yourself'}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            This is how your manager recognises you. It speeds up approval a lot.
                                        </p>
                                        <label className="inline-flex items-center gap-1.5 min-h-11 mt-2 px-4 py-1.5 bg-sffl-navy/10 hover:bg-sffl-navy/20 text-sffl-navy dark:text-blue-400 text-xs font-bold rounded-lg cursor-pointer focus-within:ring-2 focus-within:ring-sffl-red">
                                            {isUploading && <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                            {isUploading ? 'Uploading…' : claim.claimed_photo ? 'Replace photo' : 'Upload photo'}
                                            <input
                                                type="file"
                                                accept="image/*,.heic,.heif"
                                                onChange={handlePhoto}
                                                disabled={isUploading}
                                                className="sr-only"
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
                                <Button fullWidth size="lg" onClick={() => window.location.assign('/player-portal')}>
                                    Go to my player portal
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <Button variant="ghost" size="sm" className="-ml-2" icon={ArrowPathIcon} onClick={fetchStatus}>
                                Refresh status
                            </Button>
                            <Button variant="ghost" size="sm" className="-mr-2" icon={ArrowRightOnRectangleIcon} onClick={() => setConfirmLogout(true)}>
                                Sign out
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirmLogout}
                title="Log out?"
                description="Your claim stays as it is. Sign back in any time to check on it."
                confirmLabel="Log out"
                tone="info"
                icon={ArrowRightOnRectangleIcon}
                onConfirm={async () => {
                    setConfirmLogout(false);
                    await logout();
                    navigate('/');
                }}
                onCancel={() => setConfirmLogout(false)}
            />
        </div>
    );
};

export default ClaimStatusPage;
