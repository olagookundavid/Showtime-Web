import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { loginUser, registerUser, logoutUser, getUserProfile, type AuthUser } from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'admin' | 'app_admin' | 'user' | 'team_head' | 'ticketer' | 'referee' | 'stats' | 'seller';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    resetPasswordWithOTP: (email: string, otp: string, new_password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapAuthUser(authUser: AuthUser): User {
    return {
        id: authUser.id,
        name: authUser.full_name,
        email: authUser.email,
        phone: authUser.phone,
        role: authUser.user_type as User['role'],
    };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount, try to get user profile (cookie-based session)
    useEffect(() => {
        const checkSession = async () => {
            try {
                const profile = await getUserProfile();
                setUser(mapAuthUser(profile));
            } catch {
                // No valid session — that's fine
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const authUser = await loginUser(email, password);
            if (authUser.access_token) {
                localStorage.setItem('showtime_access_token', authUser.access_token);
            }
            setUser(mapAuthUser(authUser));
            return { success: true };
        } catch (err: any) {
            const message = err.response?.data?.message || err.response?.data?.error || 'Login failed';
            return { success: false, error: message };
        }
    };

    const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await registerUser(name, email, password);
            // Auto-login after registration
            return await login(email, password);
        } catch (err: any) {
            const message = err.response?.data?.message || err.response?.data?.error || 'Registration failed';
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        try {
            await logoutUser();
        } catch {
            // Ignore errors — clear local state anyway
        }
        localStorage.removeItem('showtime_access_token');
        setUser(null);
    };

    const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { forgotPassword: forgotPasswordApi } = await import('../services/api');
            await forgotPasswordApi(email);
            return { success: true };
        } catch (err: any) {
            const message = err.response?.data?.message || err.response?.data?.error || 'Failed to send reset code';
            return { success: false, error: message };
        }
    };

    const resetPasswordWithOTP = async (email: string, otp: string, new_password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { resetPassword: resetPasswordApi } = await import('../services/api');
            await resetPasswordApi({ email, otp, new_password });
            return { success: true };
        } catch (err: any) {
            const message = err.response?.data?.message || err.response?.data?.error || 'Failed to reset password';
            return { success: false, error: message };
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            isAuthenticated: !!user, 
            isLoading, 
            login, 
            signup, 
            logout,
            forgotPassword,
            resetPasswordWithOTP
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
