'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  cost_price: number;
}

interface SupplierSummary extends Supplier {
  totalPayable: number;
  totalPaid: number;
  balanceDue: number;
}

export default function SuppliersPage() {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Add Supplier Modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supTerms, setSupTerms] = useState('30');

  // Purchase Logger Modal
  const [showLogPurchase, setShowLogPurchase] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [hasBill, setHasBill] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{ product_id: string; quantity: string; cost_price: string }[]>([
    { product_id: '', quantity: '', cost_price: '' }
  ]);
  const [purPaymentType, setPurPaymentType] = useState<'cash' | 'credit'>('credit');
  const [purAmountPaid, setPurAmountPaid] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);

  // Pay Supplier Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState<SupplierSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: shops } = await supabase.from('shops').select('id').limit(1);
      if (shops && shops.length > 0) {
        setShopId(shops[0].id);
        fetchSuppliers(shops[0].id);
        fetchProducts();
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('id, name, brand, cost_price').order('name');
    setProducts((data as any) || []);
  }

  async function fetchSuppliers(targetShopId = shopId) {
    setLoading(true);
    const [{ data: sups }, { data: ledger }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('shop_id', targetShopId).order('name'),
      supabase.from('supplier_ledger').select('supplier_id, amount, type'),
    ]);

    const summaries = (sups || []).map((s) => {
      const supLedger = (ledger || []).filter((l) => l.supplier_id === s.id);
      const totalPayable = supLedger.reduce((sum, l) => sum + (l.type === 'payable' ? Number(l.amount) : 0), 0);
      const totalPaid = supLedger.reduce((sum, l) => sum + (l.type === 'payment' ? Number(l.amount) : 0), 0);
      const balanceDue = Math.max(0, totalPayable - totalPaid);

      return {
        ...s,
        totalPayable,
        totalPaid,
        balanceDue,
      };
    });

    setSuppliers(summaries);
    setLoading(false);
  }

  // Create Supplier
  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supName || !shopId) return;

    const { error } = await supabase.from('suppliers').insert({
      shop_id: shopId,
      name: supName,
      phone: supPhone || null,
      email: supEmail || null,
      payment_terms_days: Number(supTerms) || 30,
    });

    if (error) {
      alert('Error creating supplier: ' + error.message);
    } else {
      setShowAddSupplier(false);
      setSupName('');
      setSupPhone('');
      setSupEmail('');
      setSupTerms('30');
      fetchSuppliers();
    }
  }

  // Log Supplier Purchase
  function handleAddPurchaseRow() {
    setPurchaseItems([...purchaseItems, { product_id: '', quantity: '', cost_price: '' }]);
  }

  function handleRemovePurchaseRow(index: number) {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  }

  function handlePurchaseItemChange(index: number, field: string, value: string) {
    const updated = purchaseItems.map((item, i) => {
      if (i !== index) return item;
      if (field === 'product_id') {
        const prod = products.find((p) => p.id === value);
        return {
          ...item,
          product_id: value,
          cost_price: prod ? String(prod.cost_price) : '',
        };
      }
      return { ...item, [field]: value };
    });
    setPurchaseItems(updated);
  }

  const purchaseTotal = purchaseItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.cost_price) || 0),
    0
  );

  async function handleLogPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId || purchaseItems.some((item) => !item.product_id || !item.quantity || !item.cost_price)) {
      alert('Please fill out all product rows completely.');
      return;
    }
    setSavingPurchase(true);

    const payload = {
      supplier_id: selectedSupplierId,
      has_bill: hasBill,
      supplier_invoice_number: invoiceNo || null,
      total_amount: purchaseTotal,
      amount_paid: purPaymentType === 'cash' ? purchaseTotal : Number(purAmountPaid) || 0,
      items: purchaseItems.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        cost_price: Number(item.cost_price),
      })),
    };

    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    setSavingPurchase(false);

    if (result.error) {
      alert('Failed: ' + result.error);
    } else {
      setShowLogPurchase(false);
      setSelectedSupplierId('');
      setInvoiceNo('');
      setPurchaseItems([{ product_id: '', quantity: '', cost_price: '' }]);
      setPurPaymentType('credit');
      setPurAmountPaid('');
      fetchSuppliers();
    }
  }

  // Pay Supplier dues
  async function handleSettlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingSupplier || !paymentAmount || !shopId) return;
    setSavingPayment(true);

    const amount = Number(paymentAmount);
    const { error } = await supabase.from('supplier_ledger').insert({
      shop_id: shopId,
      supplier_id: payingSupplier.id,
      amount,
      type: 'payment',
    });

    setSavingPayment(false);
    if (error) {
      alert('Error recording payment: ' + error.message);
    } else {
      setShowPayModal(false);
      setPayingSupplier(null);
      setPaymentAmount('');
      fetchSuppliers();
    }
  }

  const grandTotalDues = suppliers.reduce((sum, s) => sum + s.balanceDue, 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="Supplier Ledgers" backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-white dark:bg-slate-900 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm max-w-md w-full">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Supplier Payables</p>
            <p className="text-3xl font-black text-amber-500 mt-1">₹{grandTotalDues.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Outstanding dues awaiting settlement.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddSupplier(true)}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs"
            >
              ➕ Register Supplier
            </button>
            <button
              onClick={() => setShowLogPurchase(true)}
              className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs"
            >
              📥 Log Purchase Invoice
            </button>
          </div>
        </div>

        {/* Suppliers List Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading supplier statements...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
            No registered suppliers found. Click **Register Supplier** above to get started.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-4 px-6">Supplier Details</th>
                    <th className="py-4 px-6 text-right">Total Purchases</th>
                    <th className="py-4 px-6 text-right">Total Paid</th>
                    <th className="py-4 px-6 text-right">Balance Due</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-base">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {s.phone && `📞 ${s.phone}`} {s.email && ` · ✉️ ${s.email}`} · Terms: {s.payment_terms_days} days
                        </p>
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-600 dark:text-slate-350 text-sm">
                        ₹{s.totalPayable.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-emerald-600 dark:text-emerald-400/80 text-sm">
                        ₹{s.totalPaid.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`font-bold ${s.balanceDue > 0 ? 'text-amber-500 text-base' : 'text-slate-400'}`}>
                          ₹{s.balanceDue.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => { setPayingSupplier(s); setShowPayModal(true); }}
                          disabled={s.balanceDue === 0}
                          className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          Settle Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- REGISTER SUPPLIER MODAL --- */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">Register Supplier / Distributor</h2>
              <button onClick={() => setShowAddSupplier(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. Havells Regional Distributor"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. sales@distributor.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Payment Credit Terms (Days)</label>
                <input
                  type="number"
                  required
                  value={supTerms}
                  onChange={(e) => setSupTerms(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="30"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG PURCHASE MODAL --- */}
      {showLogPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">Log Supplier Purchase Invoice</h2>
              <button onClick={() => setShowLogPurchase(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleLogPurchase} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Select Supplier</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none text-xs"
                    required
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Invoice Number (If GST)</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                    placeholder="e.g. GST-49021"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={hasBill}
                      onChange={(e) => setHasBill(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-amazon-teal focus:ring-0 focus:ring-offset-0"
                    />
                    Contains Tax Invoice (GST Bill)
                  </label>
                </div>
              </div>

              {/* Purchase Items List */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 dark:border-slate-800/60">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Purchase Items</h3>
                  <button
                    type="button"
                    onClick={handleAddPurchaseRow}
                    className="text-xs text-amazon-teal dark:text-cyan-400 font-bold"
                  >
                    ➕ Add Item Row
                  </button>
                </div>

                {purchaseItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                    <div className="col-span-6">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Product</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => handlePurchaseItemChange(index, 'product_id', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                        required
                      >
                        <option value="">-- Select Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.brand || 'Generic'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handlePurchaseItemChange(index, 'quantity', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100 text-xs text-center focus:outline-none"
                        placeholder="0"
                        required
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Cost Price (₹)</label>
                      <input
                        type="number"
                        value={item.cost_price}
                        onChange={(e) => handlePurchaseItemChange(index, 'cost_price', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100 text-xs text-center focus:outline-none"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseRow(index)}
                        disabled={purchaseItems.length === 1}
                        className="text-rose-500 text-sm font-bold p-2 disabled:opacity-30"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Card */}
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Purchase Total</span>
                <span className="text-2xl font-black text-amber-500">₹{purchaseTotal.toLocaleString()}</span>
              </div>

              {/* Payment Details */}
              <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800 dark:border-slate-800/60">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Payment Class</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPurPaymentType('cash')}
                      className={`py-3 rounded-xl font-bold border transition-all text-xs ${
                        purPaymentType === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Paid in Full (Cash/Bank)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurPaymentType('credit')}
                      className={`py-3 rounded-xl font-bold border transition-all text-xs ${
                        purPaymentType === 'credit' ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-450' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Credit Account (Pay Later)
                    </button>
                  </div>
                </div>

                {purPaymentType === 'credit' && (
                  <div className="animate-in slide-in-from-top-2 duration-150">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Amount Paid Today (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={purAmountPaid}
                      onChange={(e) => setPurAmountPaid(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Outstanding Payable: ₹{(purchaseTotal - (Number(purAmountPaid) || 0)).toLocaleString()}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPurchase}
                  className="w-full bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold py-4 rounded-2xl disabled:opacity-50 transition-colors shadow text-xs"
                >
                  {savingPurchase ? 'Logging Purchase Stock...' : 'Log Purchase Stock & update WAC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SETTLE SUPPLIER PAYMENT MODAL --- */}
      {showPayModal && payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">Settle Dues: {payingSupplier.name}</h2>
              <button onClick={() => { setShowPayModal(false); setPayingSupplier(null); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleSettlePayment} className="p-6 space-y-4">
              <div className="bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex justify-between items-center text-xs">
                <span className="text-slate-500">Current Balance Due:</span>
                <span className="text-base font-bold text-amber-500">₹{payingSupplier.balanceDue.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  max={payingSupplier.balanceDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-center text-xl font-bold focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPayModal(false); setPayingSupplier(null); }}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                >
                  {savingPayment ? 'Logging...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
