import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase-client';

export const Login: React.FC<{ onToggleRegister: () => void }> = ({ onToggleRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Deep Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#020617] to-[#020617] -z-10">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#6366F1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                {/* Glow Orbs */}
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px]"></div>
            </div>

            {/* Frosted Glass Card */}
            <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-8 md:p-10 shadow-2xl relative z-10"
                style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-10">
                    <div className="relative mb-5">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-shadow hover:shadow-[0_0_40px_rgba(99,102,241,0.5)]">
                            <span className="text-2xl font-black text-white tracking-tighter">PF</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-100 tracking-tight">
                        PartFlow <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Pro</span>
                    </h1>
                    <p className="mt-2 text-slate-400 text-sm font-medium">Sales & Inventory Management</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Input */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300 ml-1">Email address</label>
                        <div className="group relative flex items-center">
                            <svg className="absolute left-4 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            <input
                                type="email"
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-4 pl-12 pr-4 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="Enter your email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300 ml-1">Password</label>
                        <div className="group relative flex items-center">
                            <svg className="absolute left-4 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-4 pl-12 pr-12 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl py-4 px-6 text-white font-bold text-sm transition-all 
                            ${loading 
                                ? 'bg-slate-600 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_25px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_35px_rgba(99,102,241,0.45)]'
                            }`}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Authenticating...</span>
                            </div>
                        ) : (
                            <>
                                <span className="relative z-10">Sign In</span>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-10 text-center">
                    <p className="text-sm text-slate-500">
                        New sales rep?
                        <button
                            onClick={onToggleRegister}
                            className="ml-1.5 font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Create an Account
                        </button>
                    </p>
                </div>
            </div>

            {/* Bottom Branding */}
            <div className="fixed bottom-6 w-full text-center z-10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-bold">
                    Premium Distribution Management System
                </p>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};
