import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { supabase } from '../services/supabase-client';

interface AuthContextType extends AuthState {
    login: (user: User, token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>(() => {
        const savedAuth = localStorage.getItem('partflow_auth');
        if (savedAuth) {
            return JSON.parse(savedAuth);
        }
        return { user: null, token: null, isAuthenticated: false };
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const user: User = {
                    id: session.user.id,
                    username: session.user.email || '',
                    full_name: session.user.user_metadata?.full_name || '',
                    role: 'rep'
                };
                login(user, session.access_token);
            }
        });
    }, []);

    const login = (user: User, token: string) => {
        const newState = { user, token, isAuthenticated: true };
        setState(newState);
        localStorage.setItem('partflow_auth', JSON.stringify(newState));
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setState({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('partflow_auth');
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
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
