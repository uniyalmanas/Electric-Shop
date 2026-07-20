'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [seedCatalog, setSeedCatalog] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [mode, setMode] = useState<'trial' | 'pay'>('trial');

  const supabase = createClient();

  // Safe query parameters retrieval at runtime to prevent SSR build errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'pay') {
      setMode('pay');
    }
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (phone.trim().length !== 10 || isNaN(Number(phone.trim()))) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/shops/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopName,
          ownerName,
          email,
          phone,
          password,
          seedCatalog,
          mode,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      // Auto sign in user to provide zero-friction entry
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (!signInErr) {
        if (mode === 'pay') {
          window.location.href = '/owner/billing';
        } else {
          window.location.href = '/owner';
        }
        return;
      }

      setStep('success');
    } catch (err: any) {
      setError('An unexpected error occurred: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col justify-center items-center font-sans antialiased relative overflow-hidden px-4">
      {/* Decorative glows */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-to-t from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      {step === 'form' ? (
        <form onSubmit={handleSignup} className="w-full max-w-md bg-[#1E2427] border border-[#38403F] rounded-3xl p-8 space-y-6 shadow-2xl z-10 animate-slide-up relative overflow-hidden">
          {/* Copper Busbar Strip */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1793D]" />

          <div className="text-center space-y-1">
            <span className="font-mono text-[9px] tracking-widest text-[#93A0A3] uppercase">
              {mode === 'pay' ? 'PAY & OWN PORTAL' : 'LAUNCH FREE TRIAL'}
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              Create <span className="text-[#E0954F]">ElectroStock</span> Shop
            </h1>
            <p className="text-xs text-[#93A0A3]">
              {mode === 'pay' 
                ? 'Register your shop and unlock unlimited platform access (₹1).' 
                : 'Sign up to get a 7-day free trial on your isolated inventory database.'}
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Electrical Shop Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Electricals"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Owner Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                required
                placeholder="owner@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Mobile Number</label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                required
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="seedCatalog"
                checked={seedCatalog}
                onChange={(e) => setSeedCatalog(e.target.checked)}
                className="rounded border-[#38403F] text-[#C1793D] focus:ring-0 cursor-pointer bg-[#14181B] w-4 h-4"
              />
              <label htmlFor="seedCatalog" className="text-xs text-[#93A0A3] select-none cursor-pointer">
                Seed default electrical catalog items (MCBs, wires, brands)
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 text-sm cursor-pointer font-mono tracking-wide uppercase"
          >
            {loading 
              ? 'PROVISIONING DATABASE...' 
              : mode === 'pay' 
                ? 'REGISTER & PAY NOW' 
                : 'REGISTER & START TRIAL'}
          </button>

          <p className="text-center text-xs text-[#93A0A3]">
            Already have a shop?{' '}
            <a href="/login" className="text-[#E0954F] hover:underline font-bold">
              Sign In
            </a>
          </p>
        </form>
      ) : (
        <div className="w-full max-w-md bg-[#1E2427] border border-[#38403F] rounded-3xl p-8 space-y-6 text-center shadow-2xl z-10 animate-scale-in relative overflow-hidden">
          {/* Green Glow Bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#4FAE7A]" />

          <div className="w-16 h-16 bg-[#4FAE7A]/10 border border-[#4FAE7A]/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm text-[#4FAE7A]">
            ✅
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#EDEAE3]">Shop Registered!</h2>
            <p className="text-sm text-[#93A0A3]">
              Your shop database has been created and initialized. You can now log in using your phone number and password.
            </p>
          </div>

          <a
            href="/login"
            className="block w-full bg-[#4FAE7A] hover:bg-[#4FAE7A]/90 text-white font-bold py-3.5 rounded-xl text-center text-sm shadow transition-all active:scale-95"
          >
            Log In to Shop Counter →
          </a>
        </div>
      )}
    </div>
  );
}
