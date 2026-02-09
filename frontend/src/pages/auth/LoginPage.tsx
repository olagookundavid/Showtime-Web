import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage = () => {
    const [searchParams] = useSearchParams();
    const initialRole = (searchParams.get('role') as 'fan' | 'admin') || 'fan';

    const [role, setRole] = useState<'fan' | 'admin'>(initialRole);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const success = await login(email, password, role);

        if (success) {
            navigate(role === 'admin' ? '/admin' : '/');
        } else {
            setError('Invalid credentials. Try admin@sffl.football/admin123 or any email with fan123');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <img
                        src="https://images.leaguerepublic.com/data/images/738010788/107.png"
                        alt="SFFL Logo"
                        className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-2"
                    />
                    <h1 className="text-3xl font-black text-sffl-navy">Welcome Back</h1>
                    <p className="text-gray-600 mt-2">Sign in to continue</p>
                </div>

                {/* Role Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                    <button
                        type="button"
                        onClick={() => setRole('fan')}
                        className={`flex-1 py-2 px-4 rounded-md font-bold transition-all ${role === 'fan'
                                ? 'bg-sffl-red text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Fan Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`flex-1 py-2 px-4 rounded-md font-bold transition-all ${role === 'admin'
                                ? 'bg-sffl-navy text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Admin Login
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sffl-red"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sffl-red"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sffl-red hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Demo Credentials */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                    <p className="font-bold mb-2">Demo Credentials:</p>
                    <p>Admin: admin@sffl.football / admin123</p>
                    <p>Fan: any email / fan123</p>
                </div>

                {/* Sign Up Link */}
                {role === 'fan' && (
                    <p className="text-center text-sm text-gray-600 mt-6">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-sffl-red font-bold hover:underline">
                            Sign up for free
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
};
