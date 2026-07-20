'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'deactivated') {
      setError('Your worker profile has been deactivated. Please contact your shop owner.');
    }
  }, []);

  // Forgot password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState({ success: false, message: '' });

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const input = identifier.trim();
    let emailToAuth = input;

    // Check if the input is a 10-digit phone number (all digits or simple symbols)
    const phoneClean = input.replace(/\D/g, '');
    const isPhone = phoneClean.length === 10 && !input.includes('@');

    if (isPhone) {
      try {
        const res = await fetch('/api/auth/phone-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneClean }),
        });
        const data = await res.json();
        if (!res.ok || !data.email) {
          setError('No user profile found for this mobile number.');
          setLoading(false);
          return;
        }
        emailToAuth = data.email;
      } catch (err: any) {
        setError('Connection failed: ' + err.message);
        setLoading(false);
        return;
      }
    } else {
      if (!input.includes('@') || !input.includes('.')) {
        setError('Please enter a valid phone number or email address.');
        setLoading(false);
        return;
      }
    }

    let { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: emailToAuth,
      password,
    });

    // Auto-register / sign-up master admin if they don't exist in Supabase Auth yet
    if (authErr && emailToAuth === 'uniyalmanasjob1@gmail.com' && password === 'Manas@12RYZEN') {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: 'uniyalmanasjob1@gmail.com',
        password: 'Manas@12RYZEN',
        options: {
          data: {
            role: 'master',
          }
        }
      });
      if (!signUpErr && signUpData?.user) {
        // Try logging in again after auto-signup
        const retry = await supabase.auth.signInWithPassword({
          email: 'uniyalmanasjob1@gmail.com',
          password: 'Manas@12RYZEN',
        });
        authData = retry.data;
        authErr = retry.error;
      } else {
        authErr = signUpErr || authErr;
      }
    }

    if (authErr) {
      setError(authErr.message || 'Wrong credentials. Please try again.');
      setLoading(false);
      return;
    }

    // Auto-provision master worker record
    if (authData?.user && authData.user.email === 'uniyalmanasjob1@gmail.com') {
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id')
        .eq('auth_id', authData.user.id)
        .single();

      if (!existingWorker) {
        // Find or create a shop for the master account
        let shopId;
        const { data: firstShop } = await supabase.from('shops').select('id').limit(1).single();
        if (firstShop) {
          shopId = firstShop.id;
        } else {
          const { data: newShop } = await supabase
            .from('shops')
            .insert({ name: 'System Admin Console' })
            .select('id')
            .single();
          if (newShop) shopId = newShop.id;
        }

        await supabase.from('workers').insert({
          auth_id: authData.user.id,
          name: 'Master Admin',
          phone: '9999999999',
          email: 'uniyalmanasjob1@gmail.com',
          role: 'master',
          active: true,
          shop_id: shopId
        });
      } else {
        await supabase
          .from('workers')
          .update({ role: 'master', active: true })
          .eq('auth_id', authData.user.id);
      }
    }
    
    // Redirect to root or master page
    if (emailToAuth === 'uniyalmanasjob1@gmail.com') {
      window.location.href = '/master';
    } else {
      window.location.href = '/'; 
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotStatus({ success: false, message: '' });

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetErr) {
      setForgotStatus({ success: false, message: resetErr.message });
    } else {
      setForgotStatus({ success: true, message: 'Reset email sent! Please check your inbox.' });
    }
    setForgotLoading(false);
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
          <p className="text-xs text-[#93A0A3]">Enter your phone number or email and password to access your dashboard.</p>
        </div>

        <div className="space-y-4">
          
          {/* Identity Input */}
          <div>
            <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Phone or Email Address</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
              placeholder="9876543210 or name@example.com"
            />
          </div>

          {/* Password Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotStatus({ success: false, message: '' });
                  setForgotEmail('');
                  setShowForgotModal(true);
                }}
                className="text-[9px] font-bold text-[#E0954F] hover:underline uppercase tracking-wider focus:outline-none"
              >
                Forgot Password?
              </button>
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 shadow-2xl animate-scale-in text-left">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#E0954F]" />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#EDEAE3]">Account Recovery</h3>
                <p className="text-xs text-[#93A0A3]">Reset your account password via email link.</p>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-[#93A0A3] hover:text-[#EDEAE3] text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Registered Email Address</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="e.g. manas@example.com"
                />
              </div>

              {forgotStatus.message && (
                <div className={`p-3 rounded-xl text-xs font-medium text-center border ${
                  forgotStatus.success 
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-450' 
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-450'
                }`}>
                  {forgotStatus.success ? '✅' : '⚠️'} {forgotStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-[#C1793D] hover:bg-[#E0954F] disabled:opacity-40 text-[#1a120a] font-bold py-3 rounded-xl transition-all shadow-md text-xs uppercase font-mono tracking-wider"
              >
                {forgotLoading ? 'Sending link...' : 'Send Recovery Email'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
