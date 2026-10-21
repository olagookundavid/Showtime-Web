import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCircleIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts';
import { updateOwnProfile } from '../../services/api';
import { getApiErrorMessage } from '../../utils';
import { ConfirmDialog, ConfirmSummary, Button, Field, Input } from '../../components';

export const MyProfile = () => {
    const { isAuthenticated, isLoading, user, refreshUser } = useAuth();
    const [firstName, setFirstName] = useState(user?.firstName ?? '');
    const [lastName, setLastName] = useState(user?.lastName ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);

    if (isLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    const dirty =
        firstName.trim() !== (user?.firstName ?? '') ||
        lastName.trim() !== (user?.lastName ?? '') ||
        phone.trim() !== (user?.phone ?? '');

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateOwnProfile(firstName.trim(), lastName.trim(), phone.trim());
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
                        {user?.roleName ?? 'Account'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 text-sffl-navy dark:text-white font-bold">
                    <UserCircleIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
                    Account Details
                </div>

                <Field label="Email" htmlFor="profile-email">
                    <Input id="profile-email" type="email" value={user?.email ?? ''} disabled />
                </Field>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Field label="First Name *" htmlFor="profile-first-name" className="flex-1">
                        <Input
                            id="profile-first-name"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First Name"
                        />
                    </Field>

                    <Field label="Last Name *" htmlFor="profile-last-name" className="flex-1">
                        <Input
                            id="profile-last-name"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last Name"
                        />
                    </Field>
                </div>

                <Field label="Phone" htmlFor="profile-phone">
                    <Input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone Number"
                    />
                </Field>

                <div className="flex justify-end">
                    <Button
                        disabled={!dirty || !firstName.trim() || !lastName.trim()}
                        onClick={() => setConfirming(true)}
                    >
                        Save Changes
                    </Button>
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
                            ['First name', firstName.trim()],
                            ['Last name', lastName.trim()],
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
