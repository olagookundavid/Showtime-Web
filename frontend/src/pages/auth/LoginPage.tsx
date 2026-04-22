import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            toast.success('Welcome back!');
            navigate('/');
        } else {
            toast.error(result.error || 'Invalid credentials');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <img
                        src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                        alt="SFFL Logo"
                        className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-2"
                    />
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Welcome Back</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in to your account</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sffl-red transition-colors"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sffl-red transition-colors"
                            placeholder="••••••••"
                        />
                        <div className="flex justify-end mt-1">
                            <Link 
                                to="/forgot-password" 
                                className="text-xs font-bold text-sffl-red hover:underline transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sffl-red hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Sign Up Link */}
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-sffl-red font-bold hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors">
                        Sign up for free
                    </Link>
                </p>
            </div>
        </div>
    );
};
