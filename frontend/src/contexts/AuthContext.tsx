import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'fan' | 'admin';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string, role: 'fan' | 'admin') => Promise<boolean>;
    signup: (name: string, email: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    // Load user from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('sffl_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = async (email: string, password: string, role: 'fan' | 'admin'): Promise<boolean> => {
        // Mock authentication - in production, this would be an API call
        // Admin credentials: admin@sffl.football / admin123
        // Fan credentials: any email with password: fan123

        if (role === 'admin' && email === 'admin@sffl.football' && password === 'admin123') {
            const adminUser: User = {
                id: '1',
                name: 'Admin User',
                email: 'admin@sffl.football',
                role: 'admin',
            };
            setUser(adminUser);
            localStorage.setItem('sffl_user', JSON.stringify(adminUser));
            return true;
        } else if (role === 'fan' && password === 'fan123') {
            const fanUser: User = {
                id: Math.random().toString(36).substr(2, 9),
                name: email.split('@')[0],
                email,
                role: 'fan',
            };
            setUser(fanUser);
            localStorage.setItem('sffl_user', JSON.stringify(fanUser));
            return true;
        }

        return false;
    };

    const signup = async (name: string, email: string, _password: string): Promise<boolean> => {
        // Mock signup - in production, this would be an API call
        const newUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            email,
            role: 'fan',
        };
        setUser(newUser);
        localStorage.setItem('sffl_user', JSON.stringify(newUser));
        return true;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('sffl_user');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
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
