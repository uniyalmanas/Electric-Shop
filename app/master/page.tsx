'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import { translations } from '@/lib/translations';

interface ShopOwner {
  id: string;
  name: string;
  created_at: string;
  subscription_status: string;
  trial_ends_at: string;
  owner_auth_id: string;
}

interface Feedback {
  id: string;
  content: string;
  rating: number;
  created_at: string;
  shops: any;
  workers: any;
}

const getShopName = (feed: Feedback) => {
  if (!feed.shops) return 'Unknown Shop';
  if (Array.isArray(feed.shops)) {
    return feed.shops[0]?.name || 'Unknown Shop';
  }
  return feed.shops.name || 'Unknown Shop';
};

const getWorkerName = (feed: Feedback) => {
  if (!feed.workers) return 'Generic Worker';
  if (Array.isArray(feed.workers)) {
    return feed.workers[0]?.name || 'Generic Worker';
  }
  return feed.workers.name || 'Generic Worker';
};

export default function MasterDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shops' | 'feedback'>('dashboard');
  const [shops, setShops] = useState<ShopOwner[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'hinglish' | 'hindi'>('en');

  useEffect(() => {
    const cached = localStorage.getItem('electrostock_language') as 'en' | 'hinglish' | 'hindi';
    if (cached) setLang(cached);

    const handleLangChange = () => {
      const nextLang = localStorage.getItem('electrostock_language') as 'en' | 'hinglish' | 'hindi';
      if (nextLang) setLang(nextLang);
    };

    window.addEventListener('languageChange', handleLangChange);

    async function loadMasterData() {
      try {
        // Fetch all shops
        const { data: shopsData } = await supabase
          .from('shops')
          .select('id, name, created_at, subscription_status, trial_ends_at, owner_auth_id')
          .order('created_at', { ascending: false });

        // Fetch all feedbacks
        const { data: feedbacksData } = await supabase
          .from('feedbacks')
          .select(`
            id,
            content,
            rating,
            created_at,
            shops (name),
            workers (name)
          `)
          .order('created_at', { ascending: false });

        setShops(shopsData || []);
        setFeedbacks(feedbacksData || []);
      } catch (err) {
        console.error('Error loading master portal data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();

    return () => {
      window.removeEventListener('languageChange', handleLangChange);
    };
  }, []);

  // Impersonate Shop Owner Account
  const handleImpersonate = (shopId: string) => {
    localStorage.setItem('electrostock_impersonated_shop_id', shopId);
    // Redirect to owner dashboard
    window.location.href = '/owner';
  };

  // Clear Impersonation
  const handleClearImpersonate = () => {
    localStorage.removeItem('electrostock_impersonated_shop_id');
    alert('Impersonation cleared. You are back in standard Master Admin mode.');
  };

  // Calculate MRR based on mock subscriptions
  const subscribedShopsCount = shops.filter(s => s.subscription_status === 'active_paid' || s.subscription_status === 'pro' || s.subscription_status === 'premium').length;
  // Estimate revenue: suppose 40% are on ₹799, 40% on ₹399, 20% on ₹1299
  const basicPlanCount = shops.filter(s => s.subscription_status === 'basic' || s.subscription_status === 'active_paid').length;
  const proPlanCount = shops.filter(s => s.subscription_status === 'pro').length;
  const premiumPlanCount = shops.filter(s => s.subscription_status === 'premium').length;

  const totalRevenue = (basicPlanCount * 399) + (proPlanCount * 799) + (premiumPlanCount * 1299);

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-hidden">
      
      {/* Glow highlight */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/5 to-transparent blur-3xl pointer-events-none" />

      <Header title="Voltix ERP — Master Control Panel" />

      {/* Main Layout containing Sidebar & Content Grid */}
      <div className="flex-1 flex z-10">
        
        {/* --- LEFT SIDEBAR (Voltix ERP Style) --- */}
        <aside className="w-64 bg-[#1E2427] border-r border-[#38403F]/60 flex flex-col justify-between p-6">
          <div className="space-y-8">
            {/* Header info */}
            <div>
              <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest font-mono">Master Administrator</p>
              <h2 className="text-lg font-black text-[#EDEAE3] tracking-tight">Voltix System Console</h2>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                📊 System Summary
              </button>
              <button
                onClick={() => setActiveTab('shops')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'shops'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                🏢 Shop Owners Directory
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'feedback'
                    ? 'bg-[#C1793D] text-[#1a120a] shadow-lg'
                    : 'bg-transparent text-[#93A0A3] hover:bg-[#2A3135] hover:text-[#EDEAE3]'
                }`}
              >
                💬 Feedback & Suggestions
              </button>
            </nav>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleClearImpersonate}
              className="w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-2.5 rounded-lg text-[10px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
            >
              Clear Impersonation
            </button>
            <p className="text-[9px] text-[#93A0A3] text-center font-mono">ElectroStock v2.0</p>
          </div>
        </aside>

        {/* --- MAIN CONTENT PANEL --- */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {loading ? (
            <div className="text-center py-12 text-[#93A0A3] font-mono">Loading Master Console Data...</div>
          ) : (
            <>
              {/* Tab 1: Dashboard Overview */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-[#C1793D]/5 rounded-bl-3xl flex items-center justify-center text-lg text-[#E0954F]">🏢</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Total Registered Shops</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{shops.length}</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-emerald-450">💳</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Active Subscriptions</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{basicPlanCount + proPlanCount + premiumPlanCount}</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-amber-500">💰</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Estimated Monthly Revenue</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">₹{totalRevenue.toLocaleString()}</p>
                    </div>

                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/5 rounded-bl-3xl flex items-center justify-center text-lg text-rose-400">💬</div>
                      <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Feedback Logs</p>
                      <p className="text-3xl font-black text-[#EDEAE3] mt-1">{feedbacks.length}</p>
                    </div>
                  </div>

                  {/* Two Column details: Recent Shops & Recent Feedbacks */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Registrations */}
                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                      <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Recent Onboarded Shops</h3>
                      <div className="space-y-3">
                        {shops.slice(0, 5).map((shop) => (
                          <div key={shop.id} className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl flex justify-between items-center">
                            <div>
                              <p className="font-bold text-sm text-[#EDEAE3]">{shop.name}</p>
                              <p className="text-[10px] text-[#93A0A3] mt-0.5">Created: {new Date(shop.created_at).toLocaleDateString('en-IN')}</p>
                            </div>
                            <button
                              onClick={() => handleImpersonate(shop.id)}
                              className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
                            >
                              Access
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Feedbacks */}
                    <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                      <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Latest Shop Feedback</h3>
                      <div className="space-y-3">
                        {feedbacks.slice(0, 5).map((feed) => (
                          <div key={feed.id} className="bg-[#14181B] border border-[#38403F]/40 p-4 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-[#E0954F]">{getShopName(feed)}</span>
                              <span className="text-[#93A0A3] font-mono">{new Date(feed.created_at).toLocaleDateString('en-IN')}</span>
                            </div>
                            <p className="text-xs text-[#EDEAE3] font-medium italic">"{feed.content}"</p>
                            <div className="text-[10px] text-amber-500 font-bold">{'⭐️'.repeat(feed.rating || 5)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Shops Management directory */}
              {activeTab === 'shops' && (
                <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">Shops & Accounts Management</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase tracking-wider border-b border-[#38403F]">
                          <th className="py-3 px-4">Shop Name</th>
                          <th className="py-3 px-4">Registration Date</th>
                          <th className="py-3 px-4">Plan Status</th>
                          <th className="py-3 px-4">Trial Ends At</th>
                          <th className="py-3 px-4 text-center">Impersonation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#38403F]/20">
                        {shops.map((shop) => (
                          <tr key={shop.id} className="hover:bg-[#14181B]/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-[#EDEAE3]">{shop.name}</td>
                            <td className="py-3 px-4 text-[#93A0A3] font-mono">
                              {new Date(shop.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] uppercase ${
                                shop.subscription_status === 'expired' 
                                  ? 'bg-rose-500/10 text-rose-455' 
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {shop.subscription_status || 'Trial'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#93A0A3] font-mono">
                              {shop.trial_ends_at ? new Date(shop.trial_ends_at).toLocaleDateString('en-IN') : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleImpersonate(shop.id)}
                                className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-3 py-1 rounded-lg text-[9px] uppercase font-mono tracking-wider transition-colors cursor-pointer"
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
                              <h4 className="font-extrabold text-sm text-[#EDEAE3]">{getShopName(feed)}</h4>
                              <p className="text-[10px] text-[#93A0A3] mt-0.5">Submitted by: {getWorkerName(feed)}</p>
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
    </div>
  );
}
