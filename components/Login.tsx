import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase-client';

export const Login: React.FC<{ onToggleRegister: () => void }> = ({ onToggleRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (supabaseError) {
                setError(supabaseError.message);
            } else if (data.user) {
                login(
                    { id: data.user.id, username: data.user.email || '', full_name: data.user.user_metadata?.full_name || '', role: 'rep' },
                    data.session?.access_token || ''
                );
            }
        } catch (err) {
            setError('Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-4 shadow-lg shadow-indigo-200">PF</div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">PartFlow Pro</h2>
                    <p className="text-slate-500 text-sm font-medium">Sales & Inventory Management</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                        <input 
                            type="email" 
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="rep@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-black text-white shadow-xl transition-all active:scale-95 ${
                            loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
                        }`}
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-50 pt-6">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">New sales rep?</p>
                    <button 
                        onClick={onToggleRegister}
                        className="text-indigo-600 font-black text-sm hover:underline mt-1"
                    >
                        Create an Account
                    </button>
                </div>
            </div>
        </div>
    );
};
