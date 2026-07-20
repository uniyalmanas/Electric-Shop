'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface CashFlowItem {
  id: string;
  type: 'sale' | 'expense' | 'supplier_payment' | 'contractor_credit';
  description: string;
  amount: number;
  date: string;
}

export default function FinanceHubPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [inflow, setInflow] = useState(0);
  const [outflow, setOutflow] = useState(0);
  const [contractorDues, setContractorDues] = useState(0);
  const [supplierDues, setSupplierDues] = useState(0);
  const [transactions, setTransactions] = useState<CashFlowItem[]>([]);

  async function loadFinanceData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: worker } = await supabase
        .from('workers')
        .select('shop_id')
        .eq('auth_id', user.id)
        .single();

      if (!worker) return;

      const shopId = worker.shop_id;

      // 1. Fetch Sales Inflow
      const { data: sales } = await supabase
        .from('sales')
        .select('id, total_amount, created_at, invoice_number')
        .eq('shop_id', shopId);

      const totalSales = (sales || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
      setInflow(totalSales);

      // 2. Fetch Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, amount, description, date')
        .eq('shop_id', shopId);

      const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);
      setOutflow(totalExpenses);

      // 3. Fetch Contractor Dues Outstanding (Customer Ledgers)
      const { data: customerLedger } = await supabase
        .from('customer_ledger')
        .select('amount, type')
        .eq('shop_id', shopId);

      const totalCustDues = (customerLedger || []).reduce(
        (sum, l) => sum + (l.type === 'charge' ? Number(l.amount) : -Number(l.amount)),
        0
      );
      setContractorDues(totalCustDues);

      // 4. Fetch Supplier Payables Outstanding (Supplier Ledgers)
      const { data: supplierLedger } = await supabase
        .from('supplier_ledger')
        .select('amount, type')
        .eq('shop_id', shopId);

      const totalSuppDues = (supplierLedger || []).reduce(
        (sum, l) => sum + (l.type === 'purchase' ? Number(l.amount) : -Number(l.amount)),
        0
      );
      setSupplierDues(totalSuppDues);

      // 5. Compile Recent Unified Transactions list
      const list: CashFlowItem[] = [];

      (sales || []).slice(0, 10).forEach(s => {
        list.push({
          id: s.id,
          type: 'sale',
          description: `Retail Invoice #${s.invoice_number}`,
          amount: Number(s.total_amount),
          date: s.created_at
        });
      });

      (expenses || []).slice(0, 10).forEach(e => {
        list.push({
          id: e.id,
          type: 'expense',
          description: e.description || 'Generic Expense',
          amount: Number(e.amount),
          date: e.date
        });
      });

      // Sort by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(list.slice(0, 8));

    } catch (err) {
      console.error('Error loading finance metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinanceData();
  }, []);

  const netProfit = inflow - outflow;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex items-center justify-center font-mono">
        Aggregating store ledger cashflows...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-hidden">
      
      {/* Top copper glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />

      <Header title="Finance Control Hub" />

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-8 z-10 animate-fade-in">
        
        {/* --- DUKAN FINANCE OVERVIEW CARD --- */}
        <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-[#C1793D] to-amber-600" />
          
          <p className="text-[10px] text-[#93A0A3] uppercase tracking-widest font-mono">Net Portal Capital</p>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-2">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-[#EDEAE3]">
                ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <p className="text-[11px] text-[#93A0A3] font-semibold mt-1">Cash Balance (Sales Inflows minus Expenses Outflows)</p>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-[#14181B] border border-[#38403F] px-4 py-3 rounded-2xl">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Contractor Dues Receivable</p>
                <p className="text-lg font-bold text-[#E0954F] mt-0.5">₹{contractorDues.toLocaleString()}</p>
              </div>
              <div className="bg-[#14181B] border border-[#38403F] px-4 py-3 rounded-2xl">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Supplier Payables Due</p>
                <p className="text-lg font-bold text-rose-455 mt-0.5">₹{supplierDues.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- METRICS GRID --- */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-10 h-10 bg-emerald-500/5 rounded-bl-2xl flex items-center justify-center text-emerald-400 font-bold">📈</div>
            <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Total Sales Inflow</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">₹{inflow.toLocaleString()}</p>
          </div>

          <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-10 h-10 bg-rose-500/5 rounded-bl-2xl flex items-center justify-center text-rose-455 font-bold">📉</div>
            <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Total Expenses Outflow</p>
            <p className="text-2xl font-black text-rose-455 mt-1">₹{outflow.toLocaleString()}</p>
          </div>

          <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-10 h-10 bg-amber-500/5 rounded-bl-2xl flex items-center justify-center text-amber-500 font-bold">⚖️</div>
            <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-wider">Net Operating Profit Margin</p>
            <p className="text-2xl font-black text-[#EDEAE3] mt-1">
              {inflow > 0 ? `${Math.round((netProfit / inflow) * 100)}%` : '0%'}
            </p>
          </div>
        </div>

        {/* --- UNIFIED TRANSACTION STATEMENT --- */}
        <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">
            Recent Cash Statement & Ledger Inflows
          </h3>
          
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center py-8 text-[#93A0A3] text-xs font-mono">No financial transactions recorded.</p>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="bg-[#14181B] border border-[#38403F]/30 p-4 rounded-2xl flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] uppercase tracking-wider ${
                        t.type === 'sale' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'
                      }`}>
                        {t.type === 'sale' ? 'INFLOW' : 'OUTFLOW'}
                      </span>
                      <p className="font-bold text-xs text-[#EDEAE3]">{t.description}</p>
                    </div>
                    <p className="text-[10px] text-[#93A0A3] font-mono">{new Date(t.date).toLocaleDateString('en-IN')} at {new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold text-sm ${
                      t.type === 'sale' ? 'text-emerald-400' : 'text-rose-455'
                    }`}>
                      {t.type === 'sale' ? '+' : '-'} ₹{t.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
