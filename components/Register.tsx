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
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Registration Successful!</h2>
                    <p className="text-slate-500 font-medium">Redirecting you to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Create Account</h2>
                    <p className="text-slate-500 text-sm font-medium">Join Vidushan Motors Sales Team</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                        <input 
                            type="text" 
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="Vidushan Perera"
                            value={formData.full_name}
                            onChange={e => setFormData({...formData, full_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                        <input 
                            type="email" 
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="rep@example.com"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Confirm</label>
                            <input 
                                type="password" 
                                required
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                            />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-black text-white shadow-xl transition-all active:scale-95 ${
                            loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                        }`}
                    >
                        {loading ? 'Creating Account...' : 'Register Now'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-50 pt-6">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Already have an account?</p>
                    <button 
                        onClick={onToggleLogin}
                        className="text-indigo-600 font-black text-sm hover:underline mt-1"
                    >
                        Sign In Instead
                    </button>
                </div>
            </div>
        </div>
    );
};
