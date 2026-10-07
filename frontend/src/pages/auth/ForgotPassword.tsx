import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeftIcon, EnvelopeIcon, KeyIcon, LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Button, Field, IconButton, Input } from '../../components/ui';

type Step = 'email' | 'otp' | 'password' | 'success';

export const ForgotPassword = () => {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const { forgotPassword, resetPasswordWithOTP } = useAuth();
    const navigate = useNavigate();

    // Resend timer effect
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = await forgotPassword(email);
        if (result.success) {
            toast.success('Reset code sent to your email');
            setStep('otp');
            setResendTimer(60);
        } else {
            toast.error(result.error || 'Failed to send reset code');
        }
        setLoading(false);
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-advance
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length !== 6) {
            toast.error('Please enter the full 6-digit code');
            return;
        }
        setStep('password');
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        const result = await resetPasswordWithOTP(email, otp.join(''), newPassword);
        if (result.success) {
            setStep('success');
            toast.success('Password reset successfully');
        } else {
            toast.error(result.error || 'Failed to reset password');
        }
        setLoading(false);
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        const result = await forgotPassword(email);
        if (result.success) {
            toast.success('New code sent');
            setResendTimer(60);
        } else {
            toast.error(result.error || 'Failed to resend code');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-[80dvh] flex items-center justify-center transition-colors py-6 sm:py-12">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl p-5 sm:p-8 relative overflow-hidden">
                
                {/* Step Indicator */}
                {step !== 'success' && (
                    <div className="flex justify-center mb-8 gap-2">
                        {(['email', 'otp', 'password'] as Step[]).map((s, idx) => (
                            <div 
                                key={s}
                                className={`h-1.5 w-8 rounded-full transition-colors ${
                                    step === s ? 'bg-sffl-red' : idx < (['email', 'otp', 'password'].indexOf(step)) ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                            />
                        ))}
                    </div>
                )}

                {/* Back Button */}
                {step !== 'success' && (
                    <IconButton
                        variant="ghost"
                        icon={ArrowLeftIcon}
                        label={step === 'email' ? 'Back to login' : 'Back to the previous step'}
                        className="absolute top-2 left-2 sm:top-4 sm:left-4"
                        onClick={() => {
                            if (step === 'email') navigate('/login');
                            else if (step === 'otp') setStep('email');
                            else if (step === 'password') setStep('otp');
                        }}
                    />
                )}

                {/* Step 1: Email */}
                {step === 'email' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <EnvelopeIcon className="w-8 h-8 text-sffl-red" />
                            </div>
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Forgot Password?</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">Enter your email and we'll send a reset code.</p>
                        </div>

                        <form onSubmit={handleSendOTP} className="space-y-6">
                            <Field label="Email Address" htmlFor="forgot-email">
                                <Input
                                    id="forgot-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                />
                            </Field>

                            <Button type="submit" fullWidth size="lg" loading={loading}>
                                {loading ? 'Sending…' : 'Send Reset Code'}
                            </Button>
                        </form>
                    </div>
                )}

                {/* Step 2: OTP */}
                {step === 'otp' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <KeyIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Verify Code</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">Enter the 6-digit code sent to <span className="font-bold text-gray-900 dark:text-white break-all">{email}</span></p>
                        </div>

                        <form onSubmit={handleVerifyOtp} className="space-y-8">
                            <div className="flex justify-center gap-1.5 sm:gap-2">
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => { otpRefs.current[idx] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        aria-label={`Digit ${idx + 1} of 6`}
                                        className="flex-1 min-w-0 max-w-12 h-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red focus:border-transparent transition-all"
                                    />
                                ))}
                            </div>

                            <div className="space-y-4">
                                <Button type="submit" fullWidth size="lg">
                                    Verify Code
                                </Button>

                                <div className="text-center">
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={handleResend}
                                        disabled={resendTimer > 0 || loading}
                                    >
                                        {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Step 3: Password */}
                {step === 'password' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <LockClosedIcon className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h2 className="text-2xl font-black text-sffl-navy dark:text-white">Secure Account</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">Create a new secure password for your account.</p>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <Field label="New Password" htmlFor="new-password">
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                />
                            </Field>

                            <Field label="Confirm Password" htmlFor="confirm-new-password">
                                <Input
                                    id="confirm-new-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                />
                            </Field>

                            <Button type="submit" fullWidth size="lg" loading={loading}>
                                {loading ? 'Resetting…' : 'Reset Password'}
                            </Button>
                        </form>
                    </div>
                )}

                {/* Step Success */}
                {step === 'success' && (
                    <div className="text-center py-8 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircleIcon className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white mb-2">Success!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-10">Your password has been reset successfully. You can now log in with your new credentials.</p>
                        
                        <Link 
                            to="/login"
                            className="inline-block w-full bg-sffl-navy dark:bg-white dark:text-sffl-navy text-white font-black py-4 rounded-xl hover:opacity-90 transition-opacity"
                        >
                            Return to Login
                        </Link>
                    </div>
                )}

            </div>
        </div>
    );
};
