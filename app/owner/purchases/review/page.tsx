'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface PendingItem {
  id: string;
  raw_name: string | null;
  quantity: number;
  cost_price: number;
  product_id: string | null;
}

interface PendingPurchase {
  id: string;
  supplier_invoice_number: string | null;
  total_amount: number;
  created_at: string;
  suppliers: { name: string } | null;
  purchase_items: PendingItem[];
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
}

export default function PurchasesReviewPage() {
  const supabase = createClient();
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePurchase, setActivePurchase] = useState<PendingPurchase | null>(null);
  const [approving, setApproving] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Mapped item product IDs state
  const [mappings, setMappings] = useState<Record<string, string>>({});
  // Quantities and cost prices state (for edits)
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [costPrices, setCostPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    // 1. Fetch pending review purchases
    const [{ data: purRes }, { data: prodRes }] = await Promise.all([
      supabase
        .from('purchases')
        .select(`
          id,
          supplier_invoice_number,
          total_amount,
          created_at,
          suppliers (name),
          purchase_items (id, raw_name, quantity, cost_price, product_id)
        `)
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, brand').order('name'),
    ]);

    const finalPurchases = (purRes as any) || [];
    setPurchases(finalPurchases);
    setProducts((prodRes as any) || []);

    if (finalPurchases.length > 0) {
      selectPurchase(finalPurchases[0]);
    } else {
      setActivePurchase(null);
    }
    setLoading(false);
  }

  function selectPurchase(pur: PendingPurchase) {
    setActivePurchase(pur);
    
    const initialMap: Record<string, string> = {};
    const initialQty: Record<string, string> = {};
    const initialCost: Record<string, string> = {};

    pur.purchase_items.forEach((item) => {
      initialMap[item.id] = item.product_id || '';
      initialQty[item.id] = String(item.quantity);
      initialCost[item.id] = String(item.cost_price);
    });

    setMappings(initialMap);
    setQuantities(initialQty);
    setCostPrices(initialCost);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/purchases/parse-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: file.name,
            fileType: file.type,
          }),
        });
        const result = await res.json();
        if (result.error) {
          alert('OCR Error: ' + result.error);
        } else {
          alert('✅ Bill parsed successfully! Review extracted items below.');
          loadData();
        }
      } catch (err: any) {
        alert('Upload failed: ' + err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleApprove() {
    if (!activePurchase) return;

    const itemsPayload = activePurchase.purchase_items.map((item) => ({
      item_id: item.id,
      product_id: mappings[item.id],
      quantity: Number(quantities[item.id]) || 0,
      cost_price: Number(costPrices[item.id]) || 0,
    }));

    if (itemsPayload.some((item) => !item.product_id)) {
      alert('Please match all raw invoice items to a catalog product first.');
      return;
    }

    setApproving(true);
    const res = await fetch('/api/purchases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_id: activePurchase.id,
        items: itemsPayload,
      }),
    });

    const result = await res.json();
    setApproving(false);

    if (result.error) {
      alert('Approval failed: ' + result.error);
    } else {
      alert('✅ Purchase confirmed! Stock counts and WAC prices updated.');
      loadData();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="Supplier Invoices Ingestion" backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Upload Invoice Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Gemini OCR Invoice Scanner</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Upload a PDF or image (PNG/JPEG) invoice. Gemini will parse line items into the ingestion queue.</p>
          </div>
          <div>
            {parsing ? (
              <span className="text-xs font-bold text-amber-500 animate-pulse">⚡ Gemini is parsing invoice layout...</span>
            ) : (
              <label className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap cursor-pointer">
                📂 Choose Bill PDF / Image
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading pending supplier invoices...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500">
            🎉 All supplier invoices are processed! No pending reviews.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column: Pending List */}
            <div className="space-y-4">
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Invoices ({purchases.length})</h3>
              
              <div className="space-y-2">
                {purchases.map((pur) => (
                  <button
                    key={pur.id}
                    onClick={() => selectPurchase(pur)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      activePurchase?.id === pur.id
                        ? 'bg-amazon-navy text-white border-amazon-navy shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-white/20'
                    }`}
                  >
                    <p className="font-bold text-sm">{pur.suppliers?.name || 'Unknown Supplier'}</p>
                    <div className="flex justify-between items-center text-[10px] mt-2 opacity-80">
                      <span>Inv: #{pur.supplier_invoice_number || 'N/A'}</span>
                      <span>Total: ₹{Number(pur.total_amount).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Columns: Active Ingestion Grid */}
            {activePurchase && (
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      Invoice Review: {activePurchase.suppliers?.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Logged Date: {new Date(activePurchase.created_at).toLocaleDateString('en-IN')} · Invoice Total: ₹{Number(activePurchase.total_amount).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3 rounded-xl transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap"
                  >
                    {approving ? 'Ingesting...' : 'Approve & Ingest Stock'}
                  </button>
                </div>

                {/* Line Items Grid */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoice items mapping</h4>
                  
                  <div className="space-y-3">
                    {activePurchase.purchase_items.map((item) => (
                      <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl grid md:grid-cols-12 gap-3 items-center">
                        
                        {/* Raw name */}
                        <div className="md:col-span-4">
                          <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Raw Name Extracted</label>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs italic">
                            "{item.raw_name || 'Generic Item'}"
                          </p>
                        </div>

                        {/* Catalog match */}
                        <div className="md:col-span-4">
                          <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Match to Product</label>
                          <select
                            value={mappings[item.id] || ''}
                            onChange={(e) => setMappings({ ...mappings, [item.id]: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-100 text-xs focus:outline-none"
                          >
                            <option value="">-- Choose Product SKU --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.brand || 'Generic'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                          <input
                            type="number"
                            value={quantities[item.id] || ''}
                            onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 text-xs text-center focus:outline-none font-bold"
                          />
                        </div>

                        {/* Cost Price */}
                        <div className="md:col-span-2">
                          <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                          <input
                            type="number"
                            value={costPrices[item.id] || ''}
                            onChange={(e) => setCostPrices({ ...costPrices, [item.id]: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 text-xs text-center focus:outline-none font-bold"
                          />
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
