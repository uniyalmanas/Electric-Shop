'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  type: 'walk_in' | 'contractor';
  credit_limit: number;
}

interface CustomerSummary extends Customer {
  totalCharges: number;
  totalPayments: number;
  balanceDue: number;
}

export default function CustomersPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<CustomerSummary | null>(null);

  // Add Customer Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custType, setCustType] = useState<'walk_in' | 'contractor'>('contractor');
  const [custCreditLimit, setCustCreditLimit] = useState('15000');

  const [shopName, setShopName] = useState<string>('ElectroStock');

  // Receive Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    // Synchronously check localStorage on the client to avoid flash
    const cached = localStorage.getItem('electrostock_shop_name');
    if (cached) {
      setShopName(cached);
    }

    async function init() {
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
            localStorage.setItem('electrostock_shop_name', name);
          }
          fetchCustomers(worker.shop_id);
        }
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchCustomers(targetShopId = shopId) {
    setLoading(true);
    const [{ data: custs }, { data: ledger }] = await Promise.all([
      supabase.from('customers').select('*').eq('shop_id', targetShopId).order('name'),
      supabase.from('customer_ledger').select('customer_id, amount, type'),
    ]);

    const summaries = (custs || []).map((c) => {
      const custLedger = (ledger || []).filter((l) => l.customer_id === c.id);
      const totalCharges = custLedger.reduce((sum, l) => sum + (l.type === 'charge' ? Number(l.amount) : 0), 0);
      const totalPayments = custLedger.reduce((sum, l) => sum + (l.type === 'payment' ? Number(l.amount) : 0), 0);
      const balanceDue = Math.max(0, totalCharges - totalPayments);

      return {
        ...c,
        totalCharges,
        totalPayments,
        balanceDue,
      };
    });

    setCustomers(summaries);
    setLoading(false);
  }

  // Handle Add Customer
  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!custName || !shopId) return;

    const { error } = await supabase.from('customers').insert({
      shop_id: shopId,
      name: custName,
      phone: custPhone || null,
      type: custType,
      credit_limit: custType === 'contractor' ? Number(custCreditLimit) : 0,
    });

    if (error) {
      alert('Error adding customer: ' + error.message);
    } else {
      setShowAddCustomer(false);
      setCustName('');
      setCustPhone('');
      setCustType('contractor');
      setCustCreditLimit('15000');
      fetchCustomers();
    }
  }

  // Handle Receive Payment
  async function handleReceivePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCustomer || !paymentAmount || !shopId) return;
    setSavingPayment(true);

    const amount = Number(paymentAmount);

    // Insert payment row in customer_ledger
    const { error: ledgerErr } = await supabase.from('customer_ledger').insert({
      shop_id: shopId,
      customer_id: activeCustomer.id,
      amount,
      type: 'payment',
    });

    if (ledgerErr) {
      alert('Payment failed: ' + ledgerErr.message);
      setSavingPayment(false);
      return;
    }

    setSavingPayment(false);
    setShowPayModal(false);
    setActiveCustomer(null);
    setPaymentAmount('');
    fetchCustomers();
    alert('✅ Payment logged and contractor balance updated!');
  }

  // Send ledger reminder over WhatsApp Click-to-Chat
  function triggerReminder(customer: CustomerSummary) {
    const textMsg = `*CREDIT BALANCE REMINDER - ${shopName.toUpperCase()}*\n\nNamaste ${customer.name} ji,\nThis is a friendly reminder that you have an outstanding credit balance of *₹${customer.balanceDue.toLocaleString()}* on your account.\n\nPlease settle the amount at the earliest.\n\nThank you!`;
    navigator.clipboard.writeText(textMsg);
    
    let phoneNum = customer.phone ? customer.phone.replace(/\D/g, '') : '';
    if (phoneNum && phoneNum.length === 10) {
      phoneNum = '91' + phoneNum;
    }
    
    const waUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  }

  const grandTotalDues = customers.reduce((sum, c) => sum + c.balanceDue, 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="Customer Ledger" backUrl="/owner" />

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-white dark:bg-slate-900 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm max-w-md w-full">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Outstanding Contractor Dues</p>
            <p className="text-3xl font-black text-amber-500 mt-1">₹{grandTotalDues.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Sum of all contractor running credit balances.</p>
          </div>

          <button
            onClick={() => setShowAddCustomer(true)}
            className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            ➕ Register New Customer / Contractor
          </button>
        </div>

        {/* List Grid/Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading contractor ledgers...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
            No registered customers found. Click **Register Customer** above to get started.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-4 px-6">Customer Details</th>
                    <th className="py-4 px-6">Account Type</th>
                    <th className="py-4 px-6 text-right">Total Charges</th>
                    <th className="py-4 px-6 text-right">Total Payments</th>
                    <th className="py-4 px-6 text-right">Balance Due</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-base">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {c.phone ? `📞 ${c.phone}` : 'No phone linked'}
                        </p>
                      </td>
                      <td className="py-4 px-6 capitalize text-slate-500 dark:text-slate-400 text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded ${
                          c.type === 'contractor' 
                            ? 'bg-amazon-teal/15 text-amazon-teal dark:text-cyan-400' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700'
                        }`}>
                          {c.type === 'contractor' ? 'Contractor' : 'Walk-In'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-600 dark:text-slate-350 text-sm">
                        ₹{c.totalCharges.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-emerald-600 dark:text-emerald-400/80 text-sm">
                        ₹{c.totalPayments.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`font-bold ${c.balanceDue > 0 ? 'text-amber-500 text-base' : 'text-slate-400'}`}>
                          ₹{c.balanceDue.toLocaleString()}
                        </span>
                        {c.type === 'contractor' && (
                          <p className="text-[9px] text-slate-500 mt-0.5">Limit: ₹{c.credit_limit.toLocaleString()}</p>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setActiveCustomer(c); setShowPayModal(true); }}
                            disabled={c.balanceDue === 0}
                            className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            Receive Payment
                          </button>
                          <button
                            onClick={() => triggerReminder(c)}
                            disabled={c.balanceDue === 0}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            title="Copy WhatsApp reminder"
                          >
                            🔔 Remind
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- ADD CUSTOMER MODAL --- */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">Register Customer / Contractor</h2>
              <button onClick={() => setShowAddCustomer(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. Ramesh Kumar (Electrician)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone Number (For WhatsApp reminders)</label>
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Account Type</label>
                <select
                  value={custType}
                  onChange={(e) => setCustType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none text-sm"
                >
                  <option value="contractor">Contractor (Running Credit Account)</option>
                  <option value="walk_in">Walk-in Customer (No Credit)</option>
                </select>
              </div>

              {custType === 'contractor' && (
                <div className="animate-in slide-in-from-top-2 duration-150">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Credit Limit Dues (₹)</label>
                  <input
                    type="number"
                    required
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RECEIVE PAYMENT MODAL --- */}
      {showPayModal && activeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">Settle Contractor Payment</h2>
              <button onClick={() => { setShowPayModal(false); setActiveCustomer(null); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleReceivePayment} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex justify-between items-center text-xs">
                <span className="text-slate-500">Current Outstanding Dues:</span>
                <span className="text-base font-bold text-amber-500">₹{activeCustomer.balanceDue.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Payment Amount Received (₹)</label>
                <input
                  type="number"
                  required
                  max={activeCustomer.balanceDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-center text-xl font-bold focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPayModal(false); setActiveCustomer(null); }}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                >
                  {savingPayment ? 'Logging...' : 'Confirm Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
