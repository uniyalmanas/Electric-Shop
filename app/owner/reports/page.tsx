'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface GstSummary {
  hsn: string;
  category: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  totalAmount: number;
}

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [salesSummary, setSalesSummary] = useState<GstSummary[]>([]);
  const [purchasesSummary, setPurchasesSummary] = useState<GstSummary[]>([]);
  
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Totals
  const [totals, setTotals] = useState({
    taxableSales: 0,
    gstCollected: 0,
    totalSales: 0,
    taxablePurchases: 0,
    gstPaid: 0,
    totalPurchases: 0,
  });

  useEffect(() => {
    // Default date range: current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
    loadData(firstDay, lastDay);
  }, []);

  async function loadData(start = startDate, end = endDate) {
    setLoading(true);
    
    // Fetch sales in range
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total_amount,
        amount_paid,
        sale_items (
          quantity,
          price,
          products (
            category,
            brand,
            name
          )
        )
      `)
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    // Fetch purchases in range that are confirmed and billed (has_bill = true)
    const { data: purchases } = await supabase
      .from('purchases')
      .select(`
        id,
        created_at,
        total_amount,
        has_bill,
        purchase_items (
          quantity,
          cost_price,
          products (
            category,
            name
          )
        )
      `)
      .eq('has_bill', true)
      .eq('status', 'confirmed')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    // Process Sales GST (18% inclusive GST standard)
    const salesHsnMap: Record<string, GstSummary> = {};
    let totalTaxableSales = 0;
    let totalGstCollected = 0;
    let totalSalesVal = 0;

    (sales || []).forEach((sale: any) => {
      sale.sale_items?.forEach((item: any) => {
        const category = item.products?.category || 'other';
        let hsn = '8500';
        if (category === 'wire' || category === 'cable') hsn = '8544';
        else if (category === 'switch' || category === 'mcb') hsn = '8536';
        else if (category === 'conduit' || category === 'fitting') hsn = '3917';

        const itemTotal = Number(item.quantity) * Number(item.price);
        const taxable = itemTotal / 1.18; // 18% inclusive
        const tax = itemTotal - taxable;
        const cgst = tax / 2;
        const sgst = tax / 2;

        totalSalesVal += itemTotal;
        totalTaxableSales += taxable;
        totalGstCollected += tax;

        if (!salesHsnMap[hsn]) {
          salesHsnMap[hsn] = { hsn, category, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, totalAmount: 0 };
        }
        salesHsnMap[hsn].taxableValue += taxable;
        salesHsnMap[hsn].cgst += cgst;
        salesHsnMap[hsn].sgst += sgst;
        salesHsnMap[hsn].totalTax += tax;
        salesHsnMap[hsn].totalAmount += itemTotal;
      });
    });

    // Process Purchases GST (18% inclusive GST standard)
    const purchasesHsnMap: Record<string, GstSummary> = {};
    let totalTaxablePurchases = 0;
    let totalGstPaid = 0;
    let totalPurchasesVal = 0;

    (purchases || []).forEach((pur: any) => {
      pur.purchase_items?.forEach((item: any) => {
        const category = item.products?.category || 'other';
        let hsn = '8500';
        if (category === 'wire' || category === 'cable') hsn = '8544';
        else if (category === 'switch' || category === 'mcb') hsn = '8536';
        else if (category === 'conduit' || category === 'fitting') hsn = '3917';

        const itemTotal = Number(item.quantity) * Number(item.cost_price);
        const taxable = itemTotal / 1.18; // 18% inclusive
        const tax = itemTotal - taxable;
        const cgst = tax / 2;
        const sgst = tax / 2;

        totalPurchasesVal += itemTotal;
        totalTaxablePurchases += taxable;
        totalGstPaid += tax;

        if (!purchasesHsnMap[hsn]) {
          purchasesHsnMap[hsn] = { hsn, category, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, totalAmount: 0 };
        }
        purchasesHsnMap[hsn].taxableValue += taxable;
        purchasesHsnMap[hsn].cgst += cgst;
        purchasesHsnMap[hsn].sgst += sgst;
        purchasesHsnMap[hsn].totalTax += tax;
        purchasesHsnMap[hsn].totalAmount += itemTotal;
      });
    });

    setSalesSummary(Object.values(salesHsnMap));
    setPurchasesSummary(Object.values(purchasesHsnMap));
    setTotals({
      taxableSales: totalTaxableSales,
      gstCollected: totalGstCollected,
      totalSales: totalSalesVal,
      taxablePurchases: totalTaxablePurchases,
      gstPaid: totalGstPaid,
      totalPurchases: totalPurchasesVal,
    });
    setLoading(false);
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  // Export CSV file ready for CA
  function exportCSV() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'GST CA-READY REPORT (Gupta Electricals)\n';
    csvContent += `Period: ${startDate} to ${endDate}\n\n`;

    // Sales Section
    csvContent += '--- OUTWARD GST SALES (GSTR-1 READY) ---\n';
    csvContent += 'HSN Code,Category,Taxable Value (₹),CGST (9%) (₹),SGST (9%) (₹),Total Tax (18%) (₹),Total Billed Amount (₹)\n';
    salesSummary.forEach((s) => {
      csvContent += `${s.hsn},${s.category},${s.taxableValue.toFixed(2)},${s.cgst.toFixed(2)},${s.sgst.toFixed(2)},${s.totalTax.toFixed(2)},${s.totalAmount.toFixed(2)}\n`;
    });
    csvContent += `TOTALS,,${totals.taxableSales.toFixed(2)},${(totals.gstCollected/2).toFixed(2)},${(totals.gstCollected/2).toFixed(2)},${totals.gstCollected.toFixed(2)},${totals.totalSales.toFixed(2)}\n\n`;

    // Purchases Section
    csvContent += '--- INWARD GST PURCHASES (ITC INPUT CLAIMABLE) ---\n';
    csvContent += 'HSN Code,Category,Taxable Value (₹),CGST (9%) (₹),SGST (9%) (₹),Total Tax Paid (₹),Total Invoice Amount (₹)\n';
    purchasesSummary.forEach((p) => {
      csvContent += `${p.hsn},${p.category},${p.taxableValue.toFixed(2)},${p.cgst.toFixed(2)},${p.sgst.toFixed(2)},${p.totalTax.toFixed(2)},${p.totalAmount.toFixed(2)}\n`;
    });
    csvContent += `TOTALS,,${totals.taxablePurchases.toFixed(2)},${(totals.gstPaid/2).toFixed(2)},${(totals.gstPaid/2).toFixed(2)},${totals.gstPaid.toFixed(2)},${totals.totalPurchases.toFixed(2)}\n\n`;

    // Profit / GST Summary
    csvContent += '--- TAX SETTLEMENT SUMMARY ---\n';
    csvContent += `Total Sales Output Tax (GST Collected),₹${totals.gstCollected.toFixed(2)}\n`;
    csvContent += `Total Purchases Input Tax (ITC Claimable),₹${totals.gstPaid.toFixed(2)}\n`;
    csvContent += `Net GST Payable to Government,₹${Math.max(0, totals.gstCollected - totals.gstPaid).toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="GST CA-Ready Reports" backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Filter & Export Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleFilter} className="bg-white dark:bg-slate-900 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-wrap md:flex-nowrap items-end gap-3 w-full md:max-w-3xl">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">From</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">To</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap active:scale-95 transition-all shadow-sm"
            >
              Filter Dates
            </button>
          </form>

          <button
            onClick={exportCSV}
            className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap"
          >
            📥 Export CSV for CA
          </button>
        </div>

        {/* Totals Summary */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">GST Sales Outflow</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">₹{totals.totalSales.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-1">Taxable: ₹{totals.taxableSales.toLocaleString()}</p>
            <p className="text-xs text-amazon-teal dark:text-cyan-400 font-bold mt-1">GST Collected: ₹{totals.gstCollected.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">GST Purchase Inflow</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">₹{totals.totalPurchases.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-1">Taxable: ₹{totals.taxablePurchases.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-450 font-bold mt-1">ITC Input Claimable: ₹{totals.gstPaid.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Estimated GST Settlement</p>
            <p className="text-2xl font-black text-amber-500 mt-2">
              ₹{Math.max(0, totals.gstCollected - totals.gstPaid).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Difference: Output Tax - Input Tax</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Net cash liability for GSTR-3B filing</p>
          </div>
        </div>

        {/* GST Breakdowns Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Compiling GST ledger sheets...</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Sales */}
            <div className="bg-white dark:bg-slate-900 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">Outward B2C/B2B Sales (GSTR-1 Ready)</h3>
              {salesSummary.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-8">No official billed sales in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">HSN</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">GST (18%) (₹)</th>
                        <th className="py-3 px-4 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                      {salesSummary.map((s) => (
                        <tr key={s.hsn} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">{s.hsn}</td>
                          <td className="py-3.5 px-4 capitalize text-slate-500 dark:text-slate-400 font-semibold">{s.category}</td>
                          <td className="py-3.5 px-4 text-right font-semibold">₹{s.taxableValue.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-semibold text-amazon-teal dark:text-cyan-400">₹{s.totalTax.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">₹{s.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Purchases */}
            <div className="bg-white dark:bg-slate-900 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">Inward GST Purchases (ITC Claimable)</h3>
              {purchasesSummary.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-8">No official billed purchases in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">HSN</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">GST (18%) (₹)</th>
                        <th className="py-3 px-4 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                      {purchasesSummary.map((p) => (
                        <tr key={p.hsn} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20">
                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">{p.hsn}</td>
                          <td className="py-3.5 px-4 capitalize text-slate-500 dark:text-slate-400 font-semibold">{p.category}</td>
                          <td className="py-3.5 px-4 text-right font-semibold">₹{p.taxableValue.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-450">₹{p.totalTax.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">₹{p.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
