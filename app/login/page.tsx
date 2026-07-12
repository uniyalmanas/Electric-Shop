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

    // Phone is stored as email-format internally (e.g. 9876543210@shopapp.com)
    // so shop staff can log in with just their phone number — no email needed.
    const { error } = await supabase.auth.signInWithPassword({
      email: `${phone}@shopapp.com`,
      password,
    });

    if (error) {
      setError('Wrong phone number or password. Try again.');
      setLoading(false);
      return;
    }
    window.location.href = '/login'; // middleware redirects to the right dashboard
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-2xl shadow p-8 space-y-5">
        <h1 className="text-2xl font-semibold text-center">Shop Login</h1>

        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 text-lg"
            placeholder="9876543210"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 text-lg"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
