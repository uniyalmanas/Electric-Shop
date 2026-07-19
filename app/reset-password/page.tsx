'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateErr) {
      setError(updateErr.message || 'Failed to update password.');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col justify-center items-center font-sans antialiased relative overflow-hidden px-4">
      
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-to-t from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#1E2427] border border-[#38403F] rounded-3xl p-8 space-y-6 shadow-2xl z-10 animate-scale-in relative overflow-hidden">
        
        {/* Copper bar strip */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1793D]" />

        {!success ? (
          <>
            <div className="text-center space-y-1">
              <span className="font-mono text-[9px] tracking-widest text-[#93A0A3] uppercase">Security Portal</span>
              <h1 className="text-2xl font-bold tracking-tight text-[#EDEAE3]">
                Set New <span className="text-[#E0954F]">Password</span>
              </h1>
              <p className="text-xs text-[#93A0A3]">Please enter a strong new password for your shop account.</p>
            </div>

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="Confirm password"
                />
              </div>

              {error && (
                <div className="bg-[#D9584C]/10 border border-[#D9584C]/25 text-[#D9584C] text-xs py-3 px-4 rounded-xl font-medium text-center">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C1793D] hover:bg-[#E0954F] disabled:opacity-40 text-[#1a120a] font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
              >
                {loading ? 'SAVING SECURE PASSWORD...' : 'UPDATE PASSWORD'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm text-emerald-500">
              ✅
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#EDEAE3]">Password Updated!</h2>
              <p className="text-xs text-[#93A0A3]">Your security credentials have been successfully updated.</p>
            </div>

            <button
              onClick={() => { window.location.href = '/login'; }}
              className="w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold py-3.5 rounded-xl transition-all text-xs font-mono tracking-wider"
            >
              PROCEED TO LOGIN
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
