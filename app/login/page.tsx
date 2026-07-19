'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const phoneClean = phone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    // Phone is stored as email-format internally (e.g. 9876543210@shopapp.com)
    // so shop staff can log in with just their phone number — no email needed.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: `${phoneClean}@shopapp.com`,
      password,
    });

    if (authErr) {
      setError('Wrong phone number or password. Please try again.');
      setLoading(false);
      return;
    }
    
    // Redirect to root, where the middleware or routing logic redirects to the correct dashboard (/owner or /staff)
    window.location.href = '/'; 
  }

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col justify-center items-center font-sans antialiased relative overflow-hidden px-4">
      
      {/* Top copper glow */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-to-t from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      <form onSubmit={handleLogin} className="w-full max-w-md bg-[#1E2427] border border-[#38403F] rounded-3xl p-8 space-y-6 shadow-2xl z-10 animate-slide-up relative overflow-hidden">
        
        {/* Copper vertical strip */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1793D]" />

        <div className="text-center space-y-1">
          <span className="font-mono text-[9px] tracking-widest text-[#93A0A3] uppercase">SaaS Management Portal</span>
          <h1 className="text-2xl font-bold tracking-tight">
            Sign In to <span className="text-[#E0954F]">ElectroStock</span>
          </h1>
          <p className="text-xs text-[#93A0A3]">Enter your registered mobile number and password to access your dashboard.</p>
        </div>

        <div className="space-y-4">
          
          {/* Phone Number Input */}
          <div>
            <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Registered Phone Number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#707C7F] dark:text-[#93A0A3]">+91</span>
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl pl-12 pr-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors font-mono"
                placeholder="9876543210"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider">Password</label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
              placeholder="••••••••"
            />
          </div>

        </div>

        {error && (
          <div className="bg-[#D9584C]/10 border border-[#D9584C]/25 text-[#D9584C] text-xs py-3 px-4 rounded-xl font-medium text-center">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#C1793D] hover:bg-[#E0954F] disabled:opacity-40 text-[#1a120a] font-extrabold py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
        >
          {loading ? 'LOGGING INTO SECURE SESSION...' : 'ENTER DASHBOARD'}
        </button>

        <div className="text-center pt-2 border-t border-slate-700/30">
          <p className="text-xs text-[#93A0A3]">
            New to ElectroStock?{' '}
            <a href="/signup" className="text-[#E0954F] hover:underline font-bold">
              Register Shop (1-Week Free Trial)
            </a>
          </p>
        </div>

      </form>
    </div>
  );
}
