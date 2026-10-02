import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCircleIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { updateOwnProfile } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { ROLE_LABELS } from '../../components/dashboard/dashboardNav';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';

const inputClass =
    'w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 min-h-11 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red transition-colors text-sm font-semibold';

export const MyProfilePage = () => {
    const { isAuthenticated, isLoading, user, refreshUser } = useAuth();
    const [fullName, setFullName] = useState(user?.name ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);

    if (isLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    const dirty = fullName.trim() !== (user?.name ?? '') || phone.trim() !== (user?.phone ?? '');

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateOwnProfile(fullName.trim(), phone.trim());
            await refreshUser();
            toast.success('Profile updated');
            setConfirming(false);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to update profile.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
            <div className="flex items-center gap-4 pb-4 border-b dark:border-gray-800">
                <div className="w-14 h-14 shrink-0 rounded-full bg-sffl-red text-white font-black text-xl flex items-center justify-center">
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-sffl-navy dark:text-white uppercase leading-none">
                        My Profile
                    </h1>
                    <p className="text-xs text-gray-500 uppercase font-black tracking-widest mt-1.5">
                        {user?.role ? ROLE_LABELS[user.role] ?? user.role : 'Account'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 text-sffl-navy dark:text-white font-bold">
                    <UserCircleIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
                    Account Details
                </div>

                <div>
                    <label htmlFor="profile-email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Email
                    </label>
                    <input
                        id="profile-email"
                        type="email"
                        value={user?.email ?? ''}
                        disabled
                        className={`${inputClass} opacity-60 cursor-not-allowed`}
                    />
                </div>

                <div>
                    <label htmlFor="profile-fullname" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Full Name *
                    </label>
                    <input
                        id="profile-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={inputClass}
                        placeholder="Full Name"
                    />
                </div>

                <div>
                    <label htmlFor="profile-phone" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                    </label>
                    <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputClass}
                        placeholder="Phone Number"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        disabled={!dirty || !fullName.trim()}
                        className="px-5 py-2.5 min-h-11 bg-sffl-red hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 text-sffl-navy dark:text-white font-bold">
                    <KeyIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
                    Password
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Reset your password by email with a one-time code.
                </p>
                <Link
                    to="/forgot-password"
                    className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-xl text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                    Change Password
                </Link>
            </div>

            <ConfirmDialog
                open={confirming}
                title="Save profile changes?"
                tone="info"
                icon={UserCircleIcon}
                confirmLabel="Save Changes"
                pending={saving}
                body={
                    <ConfirmSummary
                        rows={[
                            ['Full name', fullName.trim()],
                            ['Phone', phone.trim()],
                        ]}
                    />
                }
                onConfirm={handleSave}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
};
