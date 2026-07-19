'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Summary {
  todaySales: number;
  todayCashIn: number;
  lowStockCount: number;
  customerDueTotal: number;
  supplierPayableTotal: number;
  chartData: { label: string; amount: number; date: string }[];
  categoryDistribution: { category: string; count: number }[];
}

export default function OwnerDashboard() {
  const supabase = createClient();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Shop Settings States
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function loadSummary() {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const [{ data: sales }, { data: productsData }, { data: custLedger }, { data: suppLedger }] =
        await Promise.all([
          supabase.from('sales').select('total_amount, amount_paid, created_at').gte('created_at', sevenDaysAgoStr),
          supabase.from('products').select('id, current_stock, reorder_threshold, category'),
          supabase.from('customer_ledger').select('amount, type'),
          supabase.from('supplier_ledger').select('amount, type'),
        ]);

      // Filter today's sales
      const todaySales = (sales || [])
        .filter((s) => s.created_at.startsWith(todayStr))
        .reduce((sum, s) => sum + Number(s.total_amount), 0);
      const todayCashIn = (sales || [])
        .filter((s) => s.created_at.startsWith(todayStr))
        .reduce((sum, s) => sum + Number(s.amount_paid), 0);

      // Low stock count
      const lowStockCount = (productsData || []).filter(
        (p) => Number(p.current_stock) < Number(p.reorder_threshold)
      ).length;

      // Ledgers
      const customerDueTotal = (custLedger || []).reduce(
        (sum, l) => sum + (l.type === 'charge' ? Number(l.amount) : -Number(l.amount)),
        0
      );
      const supplierPayableTotal = (suppLedger || []).reduce(
        (sum, l) => sum + (l.type === 'payable' ? Number(l.amount) : -Number(l.amount)),
        0
      );

      // 7-Day sales chart data
      const dailySalesMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailySalesMap[dateStr] = 0;
      }

      (sales || []).forEach((s) => {
        const dateStr = s.created_at.split('T')[0];
        if (dailySalesMap[dateStr] !== undefined) {
          dailySalesMap[dateStr] += Number(s.total_amount);
        }
      });

      const chartData = Object.entries(dailySalesMap)
        .map(([date, amount]) => ({
          label: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
          amount,
          date,
        }))
        .reverse();

      // Product catalog category distribution
      const catCounts: Record<string, number> = {};
      (productsData || []).forEach((p) => {
        const cat = p.category || 'other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });

      const categoryDistribution = Object.entries(catCounts).map(([category, count]) => ({
        category,
        count,
      })).sort((a, b) => b.count - a.count);

      // Fetch shop details for active user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: worker } = await supabase
          .from('workers')
          .select('shop_id, shops(name)')
          .eq('auth_id', user.id)
          .single();
        if (worker && worker.shop_id) {
          setShopId(worker.shop_id);
          if (worker.shops) {
            const name = (worker.shops as any).name;
            setShopName(name);
            setNewShopName(name);
          }
        }
      }

      setSummary({
        todaySales,
        todayCashIn,
        lowStockCount,
        customerDueTotal,
        supplierPayableTotal,
        chartData,
        categoryDistribution,
      });
      setLoading(false);
    }
    loadSummary();
  }, []);

  async function handleUpdateShopName(e: React.FormEvent) {
    e.preventDefault();
    if (!newShopName.trim() || !shopId) return;

    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ name: newShopName.trim() })
        .eq('id', shopId);

      if (error) {
        alert('Error updating shop name: ' + error.message);
      } else {
        setShopName(newShopName.trim());
        localStorage.setItem('electrostock_shop_name', newShopName.trim());
        setShowSettingsModal(false);
        window.location.reload();
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EDEAE3] dark:bg-[#14181B] text-[#14181B] dark:text-[#EDEAE3] flex flex-col transition-colors duration-200 grid-bg relative overflow-hidden">
      
      {/* Decorative glows */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#C1793D]/5 rounded-full blur-3xl pointer-events-none" />

      <Header title="Owner Dashboard" backUrl="/" />

      <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-8 z-10 animate-slide-up">
        
        {/* Dashboard Summary Cards */}
        {loading || !summary ? (
          <div className="text-center py-12 text-[#93A0A3] font-medium font-mono">Loading metrics...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card label="Today's Sales" value={`₹${summary.todaySales.toLocaleString()}`} icon="📈" borderHighlight="border-l-[#C1793D]" />
            <Card label="Cash Received" value={`₹${summary.todayCashIn.toLocaleString()}`} icon="💵" borderHighlight="border-l-[#4FAE7A]" />
            <Card
              label="Low Stock"
              value={summary.lowStockCount.toString()}
              icon="⚠️"
              alert={summary.lowStockCount > 0}
              borderHighlight={summary.lowStockCount > 0 ? 'border-l-[#D9584C]' : 'border-l-[#F0AD3E]'}
            />
            <Card label="Customer Dues" value={`₹${summary.customerDueTotal.toLocaleString()}`} icon="👥" borderHighlight="border-l-[#C1793D]" />
            <Card
              label="Supplier Payables"
              value={`₹${summary.supplierPayableTotal.toLocaleString()}`}
              icon="🏢"
              borderHighlight="border-l-[#F0AD3E]"
            />
          </div>
        )}

        {/* Visual Charts section */}
        {!loading && summary && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sales Bar Chart */}
            <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-widest mb-4 font-mono">📈 Weekly Sales Trend</h3>
              
              <div className="flex items-end justify-between h-48 pt-4 pb-2 px-2">
                {summary.chartData.map((data, idx) => {
                  const maxVal = Math.max(...summary.chartData.map(d => d.amount), 1);
                  const pct = (data.amount / maxVal) * 100;
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 group relative">
                      {/* Tooltip */}
                      <span className="absolute bottom-full mb-1 scale-0 group-hover:scale-100 transition-all bg-slate-800 dark:bg-slate-950 text-white text-[9px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-md z-20 font-mono">
                        ₹{data.amount.toLocaleString()}
                      </span>
                      
                      <div className="w-8 bg-[#C1793D]/80 hover:bg-[#E0954F] hover:shadow-[0_0_15px_rgba(193,121,61,0.4)] transition-all rounded-t-lg" style={{ height: `${Math.max(4, pct * 1.2)}px` }} />
                      <span className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-bold mt-2 font-mono">{data.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Catalog Distribution Horizontal Chart */}
            <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-widest font-mono">📦 Catalog Distribution</h3>
              
              <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
                {summary.categoryDistribution.map((item, idx) => {
                  const maxCount = Math.max(...summary.categoryDistribution.map(c => c.count), 1);
                  const pct = (item.count / maxCount) * 100;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="capitalize text-slate-700 dark:text-slate-300">{item.category}</span>
                        <span className="text-slate-400 font-mono">{item.count} items</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#14181B] h-2.5 rounded-full overflow-hidden border border-slate-300/10 dark:border-slate-800/30">
                        <div className="bg-gradient-to-r from-[#C1793D] to-[#E0954F] h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Grid */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-xs text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-widest font-mono">Management Operations</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <NavLink href="/owner/inventory" label="Inventory & SKUs" description="Manage electrical products, replenish stock, define warranty terms, and trigger unboxing calculations." icon="📦" badge="ElectroStock Theme" />
            <NavLink href="/owner/customers" label="Customer Credit Ledger" description="Track contractor ledger limits, register payment settlements, and send direct WhatsApp credit alerts." icon="👤" badge="WhatsApp POS" />
            <NavLink href="/owner/suppliers" label="Supplier Accounts" description="Log purchase statements, manage supplier outstanding dues, and check invoice histories." icon="🏭" badge="Purchases" />
            <NavLink href="/owner/purchases/review" label="Invoice OCR Ingestion" description="Scan invoice images or PDFs via Gemini OCR, map extracted line items, and update stock counts." icon="🧾" badge="Gemini AI" />
            <NavLink href="/owner/expenses" label="Expenses & P&L Statements" description="Log monthly office operational expenses (rent, wage bills, utility costs) and inspect net profit margins." icon="📉" badge="Finance Log" />
            <NavLink href="/owner/reports" label="CA GST Reports" description="Compile outward tax invoices (GSTR-1) and ITC purchases (GSTR-3B) into standard CA spreadsheets." icon="📊" badge="GSTR-1/3B Ready" />
             <NavLink href="/owner/reconciliation" label="Stock Reconciliation" description="Audit physical counts, view shrinkage valuation losses, track discrepancy history, and adjust system stock." icon="🔍" badge="Loss Audit" />
            <NavLink href="/owner/staff" label="Staff Roster & Audits" description="Register counter workers, deactivate staff access, and trace historical database audit trails." icon="👥" badge="Logs" />
            
            <button
              onClick={() => setShowSettingsModal(true)}
              className="block text-left relative rounded-2xl bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] p-6 transition-all duration-200 hover:border-[#C1793D] dark:hover:border-[#C1793D] hover:shadow-md group overflow-hidden"
            >
              <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-[#E0954F] bg-[#C1793D]/10 border border-[#C1793D]/25 px-2 py-0.5 rounded-full uppercase font-mono">
                Brand Profile
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xl">⚙️</span>
                <h4 className="text-lg font-bold text-[#14181B] dark:text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">Shop Settings</h4>
              </div>
              <p className="text-[#707C7F] dark:text-[#93A0A3] text-xs mt-2 leading-relaxed font-medium">Update your shop name, configure billing details, and edit your SaaS store brand.</p>
            </button>
          </div>
        </div>
      </div>

      {/* --- SHOP SETTINGS MODAL --- */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-850 p-6 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center">
              <h2 className="text-xl font-bold">Shop Profile Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleUpdateShopName} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Active Shop Name</label>
                <input
                  type="text"
                  required
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#14181B] border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. Apex Lights"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, alert, icon, borderHighlight }: { label: string; value: string; alert?: boolean; icon?: string; borderHighlight: string }) {
  return (
    <div className={`rounded-2xl border border-slate-350/50 dark:border-[#38403F] p-4 shadow-sm transition-all border-l-4 ${borderHighlight} ${
      alert 
        ? 'bg-rose-500/5 border-rose-500/20' 
        : 'bg-[#F4F1EA] dark:bg-[#1E2427]'
    }`}>
      <div className="flex justify-between items-center text-[#707C7F] dark:text-[#93A0A3] text-[9px] font-extrabold tracking-widest uppercase mb-2 font-mono">
        <span>{label}</span>
        <span className="text-xs">{icon}</span>
      </div>
      <p className={`text-xl font-bold tracking-tight ${
        alert ? 'text-[#D9584C]' : 'text-[#14181B] dark:text-white'
      }`}>{value}</p>
    </div>
  );
}

function NavLink({ href, label, description, icon, badge }: { href: string; label: string; description: string; icon: string; badge?: string }) {
  return (
    <a href={href} className="block relative rounded-2xl bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] p-6 transition-all duration-200 hover:border-[#C1793D] dark:hover:border-[#C1793D] hover:shadow-md group overflow-hidden">
      
      {badge && (
        <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-[#E0954F] bg-[#C1793D]/10 border border-[#C1793D]/25 px-2 py-0.5 rounded-full uppercase font-mono">
          {badge}
        </span>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <h4 className="text-lg font-bold text-[#14181B] dark:text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">{label}</h4>
      </div>
      <p className="text-[#707C7F] dark:text-[#93A0A3] text-xs mt-2 leading-relaxed font-medium">{description}</p>
    </a>
  );
}
