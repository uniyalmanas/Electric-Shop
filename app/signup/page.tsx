'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [seedCatalog, setSeedCatalog] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (phone.length !== 10 || isNaN(Number(phone))) {
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
          phone,
          password,
          seedCatalog,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Registration failed.');
        setLoading(false);
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
            <span className="font-mono text-[9px] tracking-widest text-[#93A0A3] uppercase">Launch Your Cloud SaaS</span>
            <h1 className="text-2xl font-bold tracking-tight">
              Create <span className="text-[#E0954F]">ElectroStock</span> Shop
            </h1>
            <p className="text-xs text-[#93A0A3]">Sign up to get your isolated retail inventory & billing counter database.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Electrical Shop Name</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
                placeholder="e.g. Senwal Electricals"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Owner Name</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
                placeholder="e.g. Manas Uniyal"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Phone Number (Login)</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="10-digit mobile"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="Min 6 chars"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={seedCatalog}
                  onChange={(e) => setSeedCatalog(e.target.checked)}
                  className="w-5 h-5 rounded bg-[#14181B] border-[#38403F] text-[#C1793D] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-[#EDEAE3] block">Pre-seed Catalog</span>
                  <span className="text-[10px] text-[#93A0A3] block">Populate with 87 standard Indian electrical brands/units.</span>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/25 p-3.5 rounded-xl text-rose-450 text-xs font-medium text-center">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 text-sm"
          >
            {loading ? 'Registering & Launching Shop...' : 'Register & Launch Shop'}
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
