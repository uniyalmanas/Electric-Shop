'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Expense {
  id: string;
  category: 'rent' | 'wages' | 'electricity' | 'transport' | 'misc';
  amount: number;
  notes: string | null;
  created_at: string;
}

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Profit & Loss calculation states
  const [plSummary, setPlSummary] = useState({
    totalSales: 0,
    cogs: 0,
    grossMargin: 0,
    operatingExpenses: 0,
    netProfit: 0,
  });

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [expCategory, setExpCategory] = useState<'rent' | 'wages' | 'electricity' | 'transport' | 'misc'>('misc');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: worker } = await supabase
          .from('workers')
          .select('shop_id')
          .eq('auth_id', user.id)
          .single();
        
        if (worker && worker.shop_id) {
          setShopId(worker.shop_id);
          fetchData(worker.shop_id, firstDay, lastDay);
        }
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchData(targetShopId = shopId, start = startDate, end = endDate) {
    if (!targetShopId) return;
    setLoading(true);

    const startIso = start + 'T00:00:00';
    const endIso = end + 'T23:59:59';

    // Fetch expenses
    const [{ data: expData }, { data: salesData }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('shop_id', targetShopId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          sale_items (
            quantity,
            price,
            product_id,
            products (
              cost_price
            )
          )
        `)
        .eq('shop_id', targetShopId)
        .gte('created_at', startIso)
        .lte('created_at', endIso),
    ]);

    const finalExpenses = (expData as Expense[]) || [];
    setExpenses(finalExpenses);

    // Calculate P&L metrics
    let totalSalesVal = 0;
    let totalCogsVal = 0;

    (salesData || []).forEach((sale: any) => {
      totalSalesVal += Number(sale.total_amount) || 0;
      sale.sale_items?.forEach((item: any) => {
        const qty = Number(item.quantity) || 0;
        const currentCost = Number(item.products?.cost_price) || 0;
        totalCogsVal += qty * currentCost;
      });
    });

    const totalOpExp = finalExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const grossMargin = totalSalesVal - totalCogsVal;
    const netProfit = grossMargin - totalOpExp;

    setPlSummary({
      totalSales: totalSalesVal,
      cogs: totalCogsVal,
      grossMargin,
      operatingExpenses: totalOpExp,
      netProfit,
    });

    setLoading(false);
  }

  // Handle Add Expense
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expAmount || !shopId) return;
    setSavingExpense(true);

    const { data: workers } = await supabase.from('workers').select('id').limit(1);
    if (!workers || workers.length === 0) {
      alert('Requires at least one worker.');
      setSavingExpense(false);
      return;
    }
    const workerId = workers[0].id;

    const { error } = await supabase.from('expenses').insert({
      shop_id: shopId,
      worker_id: workerId,
      category: expCategory,
      amount: Number(expAmount),
      notes: expNotes || null,
    });

    setSavingExpense(false);
    if (error) {
      alert('Failed: ' + error.message);
    } else {
      setShowAddModal(false);
      setExpAmount('');
      setExpNotes('');
      setExpCategory('misc');
      fetchData();
    }
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    fetchData();
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="Operating Expenses & P&L" backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Date Filter & Add Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleFilter} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-wrap md:flex-nowrap items-end gap-3 w-full md:max-w-3xl">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">From</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">To</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-205 font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all shadow-sm"
            >
              Filter Dates
            </button>
          </form>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap"
          >
            ➕ Record Shop Expense
          </button>
        </div>

        {/* Profit & Loss statement */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Statement of Profit & Loss (P&L)</h3>
          
          <div className="grid md:grid-cols-5 gap-4">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Revenue (Sales)</span>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">₹{plSummary.totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Cost of Goods (COGS)</span>
              <p className="text-xl font-black text-slate-650 dark:text-slate-400 mt-1">₹{plSummary.cogs.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Margin</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-450 mt-1">₹{plSummary.grossMargin.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Operating Expenses</span>
              <p className="text-xl font-black text-rose-500 mt-1">₹{plSummary.operatingExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Net Profit</span>
              <p className={`text-xl font-black mt-1 ${plSummary.netProfit >= 0 ? 'text-amber-500' : 'text-red-650'}`}>
                ₹{plSummary.netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-12 text-slate-405">Loading operating ledger...</div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expense Line Entries</h3>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No shop expenses logged in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Category</th>
                      <th className="py-3.5 px-6">Notes</th>
                      <th className="py-3.5 px-6 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                        <td className="py-3.5 px-6 text-slate-500 whitespace-nowrap">
                          {new Date(e.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-6 capitalize font-bold text-slate-700 dark:text-slate-200">
                          <span className={`px-2.5 py-1 rounded text-[10px] uppercase ${
                            e.category === 'rent' ? 'bg-indigo-500/10 text-indigo-500' :
                            e.category === 'wages' ? 'bg-cyan-500/10 text-cyan-500' :
                            e.category === 'electricity' ? 'bg-amber-500/10 text-amber-600' :
                            e.category === 'transport' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'
                          }`}>
                            {e.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 font-medium">
                          {e.notes || '-'}
                        </td>
                        <td className="py-3.5 px-6 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                          ₹{Number(e.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- ADD EXPENSE MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-850 p-6 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center">
              <h2 className="text-xl font-bold">Record Shop Expense</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-105 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none text-xs"
                >
                  <option value="rent">Shop Rent</option>
                  <option value="wages">Staff Wages / Salary</option>
                  <option value="electricity">Electricity Bill</option>
                  <option value="transport">Transport / Delivery charges</option>
                  <option value="misc">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Expense Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-105 font-bold focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Expense Notes / Remarks</label>
                <textarea
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-xs focus:outline-none h-20"
                  placeholder="e.g. Paid cash for tea and packaging paper"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                >
                  {savingExpense ? 'Logging...' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
