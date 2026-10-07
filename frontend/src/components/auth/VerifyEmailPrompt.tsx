import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { EnvelopeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { confirmEmailVerification, sendEmailVerificationCode } from '../../services/api';
import { useAuth } from '../../contexts';
import { Button, Field, Input } from '../ui';

const apiError = (err: unknown, fallback: string) =>
    (axios.isAxiosError(err) && err.response?.data?.error) ||
    (axios.isAxiosError(err) && err.response?.data?.message) ||
    fallback;

interface VerifyEmailPromptProps {
    /** Why verification is needed, shown under the heading. */
    reason: string;
    onVerified?: () => void;
}

/**
 * Two steps: email the user a 6-digit code, then they type it in. Typing the
 * emailed code is itself the confirmation, so there is no extra dialog.
 */
export const VerifyEmailPrompt = ({ reason, onVerified }: VerifyEmailPromptProps) => {
    const { user, refreshUser } = useAuth();
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState<'send' | 'verify' | null>(null);

    const send = async () => {
        setBusy('send');
        try {
            await sendEmailVerificationCode();
            setSent(true);
            setCode('');
            toast.success(`Code sent to ${user?.email}`);
        } catch (err) {
            toast.error(apiError(err, 'The code could not be sent. Please try again.'));
        } finally {
            setBusy(null);
        }
    };

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy('verify');
        try {
            await confirmEmailVerification(code.trim());
            await refreshUser();
            toast.success('Email verified');
            onVerified?.();
        } catch (err) {
            toast.error(apiError(err, 'That code did not work. Request a new one.'));
            setCode('');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-6 h-6 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-blue-950 dark:text-blue-100">Verify your email to vote</h3>
                        <p className="text-sm text-blue-900/80 dark:text-blue-200/80">{reason}</p>
                    </div>

                    {!sent ? (
                        <Button
                            variant="navy"
                            icon={EnvelopeIcon}
                            loading={busy === 'send'}
                            disabled={busy !== null}
                            onClick={send}
                        >
                            Email me a code
                        </Button>
                    ) : (
                        <form onSubmit={verify} className="space-y-2">
                            <Field
                                label={<>Enter the 6-digit code sent to <span className="font-black wrap-break-word">{user?.email}</span></>}
                                htmlFor="verify-code"
                            >
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                        id="verify-code"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                        className="sm:w-40"
                                        aria-describedby="verify-code-hint"
                                    />
                                    <Button
                                        type="submit"
                                        className="shrink-0"
                                        loading={busy === 'verify'}
                                        disabled={code.length !== 6 || busy !== null}
                                    >
                                        Verify email
                                    </Button>
                                </div>
                            </Field>
                            <p id="verify-code-hint" className="text-xs text-blue-900/70 dark:text-blue-200/70">
                                The code expires in 15 minutes. Didn't get it? Check spam, or{' '}
                                <button
                                    type="button"
                                    onClick={send}
                                    disabled={busy !== null}
                                    className="font-bold underline underline-offset-2 min-h-11 sm:min-h-0 disabled:opacity-60"
                                >
                                    send a new code
                                </button>
                                .
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
