import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../services/supabase-client';

export const Register: React.FC<{ onToggleLogin: () => void }> = ({ onToggleLogin }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const { error: supabaseError } = await supabase.auth.signUp({
                email: formData.email,
                password: bcrypt.hashSync(formData.password, 10),
                options: {
                    data: {
                        full_name: formData.full_name
                    }
                }
            });

            if (supabaseError) {
                setError(supabaseError.message);
            } else {
                setSuccess(true);
                setTimeout(() => onToggleLogin(), 2000);
            }
        } catch (err) {
            setError('Registration failed');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
                <div className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#020617] to-[#020617] -z-10">
                    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#6366F1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                    <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px]"></div>
                </div>
                <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-8 text-center" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-black text-slate-100 mb-2">Registration Successful!</h2>
                    <p className="text-slate-400 font-medium">Redirecting you to login...</p>
                </div>
                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Deep Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#020617] to-[#020617] -z-10">
                <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#6366F1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }}></div>
            </div>

            {/* Frosted Glass Card */}
            <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-8 md:p-10 shadow-2xl relative z-10"
                style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_25px_rgba(99,102,241,0.3)] mx-auto mb-4">
                        <span className="text-lg font-black text-white">PF</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-100 tracking-tight">Create Account</h2>
                    <p className="text-slate-400 text-sm font-medium mt-1">Join the Sales Team</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-sm">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300 ml-1">Full Name</label>
                        <div className="group relative flex items-center">
                            <svg className="absolute left-4 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <input
                                type="text"
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="Enter your full name"
                                value={formData.full_name}
                                onChange={e => setFormData({...formData, full_name: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300 ml-1">Email</label>
                        <div className="group relative flex items-center">
                            <svg className="absolute left-4 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            <input
                                type="email"
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="rep@example.com"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300 ml-1">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3.5 px-4 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300 ml-1">Confirm</label>
                            <input
                                type="password"
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3.5 px-4 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-sm font-medium"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Register Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl py-4 px-6 text-white font-bold text-sm transition-all
                            ${loading
                                ? 'bg-slate-600 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_25px_rgba(99,102,241,0.35)]'
                            }`}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Creating Account...</span>
                            </div>
                        ) : (
                            <>
                                <span className="relative z-10">Register Now</span>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-sm text-slate-500">
                        Already have an account?
                        <button
                            onClick={onToggleLogin}
                            className="ml-1.5 font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Sign In Instead
                        </button>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
