'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface DetailedShop {
  id: string;
  name: string;
  created_at: string;
  subscription_status: string;
  trial_ends_at: string;
  is_suspended: boolean;
  owner_auth_id: string;
  workerCount: number;
  productCount: number;
  salesCount: number;
  duesSum: number;
}

interface Feedback {
  id: string;
  content: string;
  rating: number;
  created_at: string;
  shops: { name: string } | null;
  workers: { name: string } | null;
}

export default function MasterDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shops' | 'feedback'>('dashboard');
  const [shops, setShops] = useState<DetailedShop[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<DetailedShop | null>(null);

  // Load portal data
  async function loadMasterData() {
    try {
      setLoading(true);
      // Fetch aggregated shop details
      const res = await fetch('/api/master/shops');
      const data = await res.json();
      
      if (res.ok) {
        setShops(data.shops || []);
      } else {
        console.error('Error fetching shops:', data.error);
      }

      // Fetch feedbacks
      const fRes = await fetch('/api/feedbacks');
      const fData = await fRes.json();
      if (fRes.ok) {
        setFeedbacks(fData.feedbacks || []);
      }
    } catch (err) {
      console.error('Error loading master portal:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasterData();
  }, []);

  // Update shop subscription status or suspension status
  const handleUpdateShop = async (shopId: string, updates: Partial<DetailedShop>) => {
    try {
      const res = await fetch('/api/master/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, ...updates }),
      });

      if (res.ok) {
        // Refresh local state
        setShops(prev => prev.map(s => s.id === shopId ? { ...s, ...updates } as DetailedShop : s));
      } else {
        const data = await res.json();
        alert('Failed to update shop: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating shop.');
    }
  };

  // Extend shop free trial
  const handleExtendTrial = (shopId: string, currentTrialEnd: string, days: number) => {
    const current = new Date(currentTrialEnd);
    current.setDate(current.getDate() + days);
    handleUpdateShop(shopId, { trial_ends_at: current.toISOString() });
  };

  // Impersonate Shop Owner Account
  const handleImpersonate = (shopId: string) => {
    localStorage.setItem('electrostock_impersonated_shop_id', shopId);
    window.location.href = '/owner';
  };

  // Clear Impersonation
  const handleClearImpersonate = () => {
    localStorage.removeItem('electrostock_impersonated_shop_id');
    alert('Impersonation cleared. Back in Master Admin mode.');
  };

  // Sign out master admin
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Stats summaries
  const totalShops = shops.length;
  const activeSubs = shops.filter(s => s.subscription_status && s.subscription_status !== 'expired' && s.subscription_status !== 'trial').length;
  const suspendedCount = shops.filter(s => s.is_suspended).length;

  // Estimate Monthly Recurring Revenue (MRR)
  const basicCount = shops.filter(s => s.subscription_status === 'basic').length;
  const proCount = shops.filter(s => s.subscription_status === 'pro').length;
  const premiumCount = shops.filter(s => s.subscription_status === 'premium').length;
  const mrr = (basicCount * 399) + (proCount * 799) + (premiumCount * 1299);

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-hidden">
      
      {/* Radial copper glow */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/5 to-transparent blur-3xl pointer-events-none" />

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 w-full bg-[#1E2427]/80 backdrop-blur-md border-b border-[#38403F]/60 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#EDEAE3] via-[#E0954F] to-[#C1793D] font-mono">
            VOLTIX MASTER CONSOLE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSignOut}
            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-455 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer"
          >
            LOG OUT
          </button>
        </div>
      </header>

      {/* --- SIDEBAR & MAIN BODY --- */}
      <div className="flex-1 flex z-10">
        
        {/* --- Voltix ERP Sidebar --- */}
        <aside className="w-64 bg-[#1E2427] border-r border-[#38403F]/60 flex flex-col justify-between p-6">
          <div className="space-y-8">
            <div>
              <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest font-mono">Control System</p>
              <h2 className="text-lg font-black text-[#EDEAE3] tracking-tight">System Admin v2.0</h2>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                📊 Dashboard Summary
              </button>
              <button
                onClick={() => setActiveTab('shops')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'shops'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                🏢 Shop Directory
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'feedback'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                💬 Feedback Hub
              </button>
            </nav>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleClearImpersonate}
              className="w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-2 rounded-lg text-[9px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
            >
              Clear Impersonation
            </button>
            <button
              onClick={handleSignOut}
              className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 font-bold py-2 rounded-lg text-[9px] uppercase font-mono tracking-wider transition-colors cursor-pointer text-center"
            >
              🚪 Exit Admin Session
            </button>
          </div>
        </aside>

        {/* --- Main content grid --- */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {loading ? (
            <div className="text-center py-12 text-[#93A0A3] font-mono text-sm">Aggregating Cloud Server Metrics...</div>
          ) : (
            <>
              {/* Tab 1: Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Summary Metric Cards */}
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-[#C1793D]/5 rounded-bl-3xl flex items-center justify-center text-lg text-[#E0954F]">🏬</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Total Registers</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{totalShops} Shops</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-emerald-400">⚡</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Paying Subscribed</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{activeSubs} Shops</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-rose-455">🚫</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Suspended Shops</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{suspendedCount} Accounts</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-amber-500">💰</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Estimated Revenue (MRR)</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">₹{mrr.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Revenue Distribution Chart */}
                  <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider">Plan Subscriptions Distribution</h3>
                    <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                      <div className="bg-[#14181B] border border-[#38403F]/40 p-5 rounded-2xl">
                        <p className="text-[#93A0A3] text-[10px] font-bold uppercase">Basic (₹399)</p>
                        <p className="text-2xl font-extrabold text-[#EDEAE3] mt-1">{basicCount}</p>
                      </div>
                      <div className="bg-[#14181B] border-2 border-[#C1793D] p-5 rounded-2xl relative">
                        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-[#C1793D] text-[#1a120a] text-[8px] font-black uppercase px-2 py-0.5 rounded-full">POPULAR</div>
                        <p className="text-[#93A0A3] text-[10px] font-bold uppercase">Pro (₹799)</p>
                        <p className="text-2xl font-extrabold text-[#E0954F] mt-1">{proCount}</p>
                      </div>
                      <div className="bg-[#14181B] border border-[#38403F]/40 p-5 rounded-2xl">
                        <p className="text-[#93A0A3] text-[10px] font-bold uppercase">Premium (₹1299)</p>
                        <p className="text-2xl font-extrabold text-[#EDEAE3] mt-1">{premiumCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent registrations */}
                  <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Latest Shop Registrations</h3>
                    <div className="space-y-3">
                      {shops.slice(0, 5).map((shop) => (
                        <div key={shop.id} className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm text-[#EDEAE3]">{shop.name}</p>
                            <p className="text-[10px] text-[#93A0A3] mt-0.5">Created: {new Date(shop.created_at).toLocaleDateString('en-IN')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] uppercase ${
                              shop.is_suspended ? 'bg-rose-500/10 text-rose-455' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {shop.is_suspended ? 'Suspended' : 'Active'}
                            </span>
                            <button
                              onClick={() => setSelectedShop(shop)}
                              className="bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Shops Management Directory */}
              {activeTab === 'shops' && (
                <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Shops & Subscription Management</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase tracking-wider border-b border-[#38403F]">
                          <th className="py-3 px-4">Shop Details</th>
                          <th className="py-3 px-4">Stats</th>
                          <th className="py-3 px-4">Tier Plan</th>
                          <th className="py-3 px-4">Trial Extension</th>
                          <th className="py-3 px-4">Control Status</th>
                          <th className="py-3 px-4 text-center">Admin Impersonate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#38403F]/20">
                        {shops.map((shop) => (
                          <tr key={shop.id} className="hover:bg-[#14181B]/30 transition-colors">
                            <td className="py-4 px-4 space-y-1">
                              <p className="font-bold text-[#EDEAE3]">{shop.name}</p>
                              <p className="text-[10px] text-[#93A0A3] font-mono">Reg: {new Date(shop.created_at).toLocaleDateString('en-IN')}</p>
                            </td>
                            <td className="py-4 px-4 font-mono text-[10px] text-[#EDEAE3] space-y-0.5">
                              <div>Counters: {shop.workerCount}</div>
                              <div>Products: {shop.productCount}</div>
                              <div>Invoices: {shop.salesCount}</div>
                            </td>
                            <td className="py-4 px-4">
                              <select
                                value={shop.subscription_status || 'trial'}
                                onChange={(e) => handleUpdateShop(shop.id, { subscription_status: e.target.value })}
                                className="bg-[#14181B] border border-[#38403F] rounded-lg px-2 py-1.5 text-xs text-[#EDEAE3] focus:outline-none"
                              >
                                <option value="trial">Trial (7 Days)</option>
                                <option value="basic">Basic (₹399)</option>
                                <option value="pro">Pro (₹799)</option>
                                <option value="premium">Premium (₹1299)</option>
                                <option value="expired">Expired</option>
                              </select>
                            </td>
                            <td className="py-4 px-4 space-y-1">
                              <p className="text-[10px] text-[#93A0A3] font-mono">Ends: {new Date(shop.trial_ends_at).toLocaleDateString('en-IN')}</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleExtendTrial(shop.id, shop.trial_ends_at, 7)}
                                  className="bg-[#2A3135] hover:bg-[#38403F] px-2 py-1 rounded text-[9px] font-bold text-[#EDEAE3] font-mono cursor-pointer"
                                >
                                  +7 Days
                                </button>
                                <button
                                  onClick={() => handleExtendTrial(shop.id, shop.trial_ends_at, 30)}
                                  className="bg-[#2A3135] hover:bg-[#38403F] px-2 py-1 rounded text-[9px] font-bold text-[#EDEAE3] font-mono cursor-pointer"
                                >
                                  +30 Days
                                </button>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <button
                                onClick={() => handleUpdateShop(shop.id, { is_suspended: !shop.is_suspended })}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                                  shop.is_suspended 
                                    ? 'bg-rose-500/10 text-rose-455 hover:bg-rose-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                              >
                                {shop.is_suspended ? 'Suspended' : 'Active'}
                              </button>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => handleImpersonate(shop.id)}
                                className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-3.5 py-2 rounded-xl text-[10px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
                              >
                                Login As Owner
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Feedback Forms Directory */}
              {activeTab === 'feedback' && (
                <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Feedback & Suggestions Log</h3>
                  <div className="space-y-4">
                    {feedbacks.length === 0 ? (
                      <p className="text-center py-12 text-[#93A0A3] text-xs font-mono">No feedbacks submitted by users yet.</p>
                    ) : (
                      feedbacks.map((feed) => (
                        <div key={feed.id} className="bg-[#14181B] border border-[#38403F]/30 p-5 rounded-2xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-sm text-[#EDEAE3]">
                                {Array.isArray(feed.shops) ? (feed.shops as any)[0]?.name : (feed.shops as any)?.name || 'Unknown Shop'}
                              </h4>
                              <p className="text-[10px] text-[#93A0A3] mt-0.5">
                                Submitted by: {Array.isArray(feed.workers) ? (feed.workers as any)[0]?.name : (feed.workers as any)?.name || 'Generic Worker'}
                              </p>
                            </div>
                            <span className="text-[10px] text-[#93A0A3] font-mono">{new Date(feed.created_at).toLocaleString('en-IN')}</span>
                          </div>
                          
                          <p className="text-sm text-[#EDEAE3] leading-relaxed font-medium bg-[#1E2427]/40 p-4 rounded-xl border border-[#38403F]/20 italic">
                            "{feed.content}"
                          </p>

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-500 font-bold">Rating: {'⭐️'.repeat(feed.rating || 5)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* --- SHOP DETAILS MODAL --- */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-[#EDEAE3]">
            <div className="bg-[#14181B] p-6 border-b border-[#38403F]/60 flex justify-between items-center">
              <h2 className="text-lg font-bold">{selectedShop.name} — Live Info</h2>
              <button onClick={() => setSelectedShop(null)} className="text-[#93A0A3] hover:text-[#EDEAE3] text-2xl font-bold cursor-pointer">×</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl">
                  <p className="text-[#93A0A3] text-[9px] font-bold uppercase">Staff Counters</p>
                  <p className="text-xl font-bold mt-0.5">{selectedShop.workerCount}</p>
                </div>
                <div className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl">
                  <p className="text-[#93A0A3] text-[9px] font-bold uppercase">Inventory Items</p>
                  <p className="text-xl font-bold mt-0.5">{selectedShop.productCount} SKUs</p>
                </div>
                <div className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl">
                  <p className="text-[#93A0A3] text-[9px] font-bold uppercase">Transactions</p>
                  <p className="text-xl font-bold mt-0.5">{selectedShop.salesCount} Invoices</p>
                </div>
                <div className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl">
                  <p className="text-[#93A0A3] text-[9px] font-bold uppercase">Contractor Dues</p>
                  <p className="text-xl font-bold mt-0.5 text-rose-455">₹{selectedShop.duesSum.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#93A0A3]">Subscription Plan:</span>
                  <span className="font-bold text-[#E0954F] uppercase">{selectedShop.subscription_status || 'Trial'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#93A0A3]">Suspended State:</span>
                  <span className={`font-bold uppercase ${selectedShop.is_suspended ? 'text-rose-455' : 'text-emerald-450'}`}>
                    {selectedShop.is_suspended ? 'Yes (Suspended)' : 'No (Active)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#93A0A3]">Trial Ending Timestamp:</span>
                  <span className="font-mono">{new Date(selectedShop.trial_ends_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedShop(null)}
                  className="bg-[#2A3135] hover:bg-[#38403F] text-[#EDEAE3] font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedShop(null);
                    handleImpersonate(selectedShop.id);
                  }}
                  className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Impersonate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
