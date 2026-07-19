'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Product {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  brand: string | null;
  rating: string | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_threshold: number;
}

interface Location {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProductStock {
  product_id: string;
  location_id: string;
  current_stock: number;
}

interface Worker {
  id: string;
  name: string;
  role: string;
}

interface ReconciliationLog {
  id: string;
  physical_qty: number;
  system_qty: number;
  discrepancy: number;
  notes: string;
  created_at: string;
  products: {
    name: string;
    brand: string | null;
    rating: string | null;
    cost_price: number;
    unit_type: string;
  } | null;
  workers: {
    name: string;
  } | null;
}

export default function ReconciliationPage() {
  const supabase = createClient();
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [reconciliationLogs, setReconciliationLogs] = useState<ReconciliationLog[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDiscrepancy, setFilterDiscrepancy] = useState('all'); // 'all', 'discrepancy', 'shrinkage', 'overage', 'perfect'

  // New Audit form states
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [physicalCountInput, setPhysicalCountInput] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Initialize page data
  useEffect(() => {
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
          await Promise.all([
            fetchProducts(worker.shop_id),
            fetchLocations(worker.shop_id),
            fetchProductStocks(worker.shop_id),
            fetchWorkers(worker.shop_id),
            fetchReconciliationLogs()
          ]);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  async function fetchProducts(targetShopId = shopId) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', targetShopId)
      .order('name');
    setProducts(data || []);
  }

  async function fetchLocations(targetShopId = shopId) {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('shop_id', targetShopId)
      .order('name');
    setLocations(data || []);
    if (data && data.length > 0) {
      // Find default location and pre-select
      const defaultLoc = data.find(l => l.is_default);
      setSelectedLocationId(defaultLoc ? defaultLoc.id : data[0].id);
    }
  }

  async function fetchProductStocks(targetShopId = shopId) {
    const { data } = await supabase
      .from('product_stocks')
      .select('product_id, location_id, current_stock')
      .eq('shop_id', targetShopId);
    setProductStocks(data || []);
  }

  async function fetchWorkers(targetShopId = shopId) {
    const { data } = await supabase
      .from('workers')
      .select('id, name, role')
      .eq('shop_id', targetShopId)
      .eq('active', true)
      .order('name');
    setWorkers(data || []);
    if (data && data.length > 0) {
      setSelectedWorkerId(data[0].id);
    }
  }

  async function fetchReconciliationLogs() {
    const { data } = await supabase
      .from('reconciliation_logs')
      .select(`
        id,
        physical_qty,
        system_qty,
        discrepancy,
        notes,
        created_at,
        products (name, brand, rating, cost_price, unit_type),
        workers (name)
      `)
      .order('created_at', { ascending: false });
    setReconciliationLogs((data as any) || []);
  }

  // Live calculation helpers
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  
  // Find current stock at selected location
  const locationStockValue = selectedProduct && selectedLocation
    ? productStocks.find(
        s => s.product_id === selectedProduct.id && s.location_id === selectedLocation.id
      )?.current_stock ?? 0
    : 0;

  const inputPhysicalCount = physicalCountInput !== '' ? Number(physicalCountInput) : 0;
  const calculatedDiscrepancy = selectedProductId ? inputPhysicalCount - locationStockValue : 0;
  const calculatedFinancialImpact = selectedProduct ? calculatedDiscrepancy * selectedProduct.cost_price : 0;

  // Handle manual physical audit submit
  async function handleAuditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId || !selectedProductId || !selectedLocationId || !physicalCountInput || !selectedWorkerId) {
      alert('Please fill out all required fields.');
      return;
    }

    setSubmittingAudit(true);
    const physical = Number(physicalCountInput);
    const current = locationStockValue;
    const diff = physical - current;

    try {
      // 1. Log discrepancy in reconciliation_logs
      // Add details about location in notes since table does not have location_id
      const locationText = selectedLocation ? `[Location: ${selectedLocation.name}]` : '';
      const notes = `${locationText} ${auditNotes || 'Routine shelf stock reconciliation check'}`.trim();

      const { error: logErr } = await supabase.from('reconciliation_logs').insert({
        shop_id: shopId,
        product_id: selectedProductId,
        worker_id: selectedWorkerId,
        physical_qty: physical,
        system_qty: current,
        discrepancy: diff,
        notes: notes,
      });

      if (logErr) throw new Error('Failed logging discrepancy: ' + logErr.message);

      // 2. Update stock count at location
      const { error: stockErr } = await supabase
        .from('product_stocks')
        .upsert({
          shop_id: shopId,
          product_id: selectedProductId,
          location_id: selectedLocationId,
          current_stock: physical,
        }, { onConflict: 'product_id, location_id' });

      if (stockErr) throw new Error('Failed updating location stock: ' + stockErr.message);

      // 3. Record stock movement audit trail
      if (diff !== 0) {
        const { error: moveErr } = await supabase.from('stock_movements').insert({
          shop_id: shopId,
          product_id: selectedProductId,
          worker_id: selectedWorkerId,
          quantity: Math.abs(diff),
          direction: diff >= 0 ? 'in' : 'out',
          reason: 'reconciliation_adjustment',
          location_id: selectedLocationId,
          entry_method: 'manual',
        });

        if (moveErr) console.error('Failed to log stock movement audit trail:', moveErr);
      }

      // Success
      alert('✅ Stock reconciliation committed successfully!');
      
      // Reset form states
      setSelectedProductId('');
      setPhysicalCountInput('');
      setAuditNotes('');
      setShowAuditModal(false);

      // Refresh page data
      await Promise.all([
        fetchProducts(),
        fetchProductStocks(),
        fetchReconciliationLogs()
      ]);

    } catch (err: any) {
      alert('Error during reconciliation: ' + err.message);
    } finally {
      setSubmittingAudit(false);
    }
  }

  // CSV Export utility
  function handleExportCSV() {
    if (reconciliationLogs.length === 0) {
      alert('No logs available to export.');
      return;
    }

    const headers = ['Date', 'Product', 'Brand', 'Rating', 'Worker', 'System Qty', 'Physical Qty', 'Discrepancy', 'Unit Cost', 'Financial Impact (INR)', 'Notes'];
    const csvRows = [headers.join(',')];

    reconciliationLogs.forEach(log => {
      const p = log.products;
      const date = new Date(log.created_at).toLocaleDateString('en-IN');
      const prodName = `"${(p?.name || 'Deleted Product').replace(/"/g, '""')}"`;
      const brand = `"${(p?.brand || '').replace(/"/g, '""')}"`;
      const rating = `"${(p?.rating || '').replace(/"/g, '""')}"`;
      const workerName = `"${(log.workers?.name || 'Admin').replace(/"/g, '""')}"`;
      const sysQty = log.system_qty;
      const physQty = log.physical_qty;
      const discrepancy = log.discrepancy;
      const cost = p?.cost_price || 0;
      const impact = discrepancy * cost;
      const notes = `"${(log.notes || '').replace(/"/g, '""')}"`;

      csvRows.push([
        date,
        prodName,
        brand,
        rating,
        workerName,
        sysQty,
        physQty,
        discrepancy,
        cost,
        impact,
        notes
      ].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `electrostock_reconciliation_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filter reconciliation logs based on controls
  const filteredLogs = reconciliationLogs.filter(log => {
    const p = log.products;
    const matchSearch = 
      !searchTerm ||
      p?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p?.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory =
      filterCategory === 'all' ||
      products.find(prod => prod.id === log.products?.name)?.category === filterCategory; // rough check (products list name lookup or standard category match)

    // Actually, in `reconciliation_logs` join we don't return category directly. Let's match by product mapping:
    let itemCategory = 'other';
    const matchProd = products.find(pr => pr.name === p?.name);
    if (matchProd) itemCategory = matchProd.category;

    const categoryMatch = filterCategory === 'all' || itemCategory === filterCategory;

    let discrepancyMatch = true;
    if (filterDiscrepancy === 'discrepancy') {
      discrepancyMatch = log.discrepancy !== 0;
    } else if (filterDiscrepancy === 'shrinkage') {
      discrepancyMatch = log.discrepancy < 0;
    } else if (filterDiscrepancy === 'overage') {
      discrepancyMatch = log.discrepancy > 0;
    } else if (filterDiscrepancy === 'perfect') {
      discrepancyMatch = log.discrepancy === 0;
    }

    return matchSearch && categoryMatch && discrepancyMatch;
  });

  // Calculate high level KPIs
  const totalShrinkageValuation = reconciliationLogs
    .filter(log => log.discrepancy < 0)
    .reduce((sum, log) => sum + Math.abs(log.discrepancy) * (log.products?.cost_price || 0), 0);

  const totalOverageValuation = reconciliationLogs
    .filter(log => log.discrepancy > 0)
    .reduce((sum, log) => sum + log.discrepancy * (log.products?.cost_price || 0), 0);

  const netImpact = totalOverageValuation - totalShrinkageValuation;

  // Audit coverage: unique products audited at least once / total products
  const uniqueProductsAudited = new Set(reconciliationLogs.map(log => log.products?.name)).size;
  const auditCoveragePercent = products.length > 0 
    ? Math.round((uniqueProductsAudited / products.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#EDEAE3] dark:bg-[#14181B] text-[#14181B] dark:text-[#EDEAE3] flex flex-col transition-colors duration-200 grid-bg relative overflow-hidden font-sans">
      
      {/* Decorative copper glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none z-0" />

      <Header title="Stock Reconciliation" backUrl="/owner" />

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 z-10 animate-slide-up relative">
        
        {/* Top bar with page title and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-300/40 dark:border-[#38403F]/60 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#14181B] dark:text-[#EDEAE3] tracking-tight">Physical Stock Reconciliation</h2>
            <p className="text-xs text-[#707C7F] dark:text-[#93A0A3] font-medium mt-1">
              Verify actual inventory levels on shelves, compute valuation losses (shrinkage), and sync system metrics.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="bg-transparent hover:bg-slate-200 dark:hover:bg-[#1E2427] border border-slate-350 dark:border-[#38403F] text-slate-700 dark:text-[#EDEAE3] font-bold px-4 py-2.5 rounded-xl transition-all text-xs font-mono tracking-wider active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              📥 EXPORT REPORT (.CSV)
            </button>
            <button
              onClick={() => setShowAuditModal(true)}
              className="bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider flex items-center gap-1.5"
            >
              ⚡ NEW SHELF AUDIT
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-24 text-[#93A0A3] font-medium font-mono">
            Analyzing database ledgers & audit tracks...
          </div>
        ) : (
          <>
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Net Discrepancy Impact */}
              <div className="rounded-2xl border border-slate-300/60 dark:border-[#38403F] bg-[#F4F1EA] dark:bg-[#1E2427] p-5 shadow-sm border-l-4 border-l-[#C1793D] relative overflow-hidden">
                <div className="flex justify-between items-center text-[#707C7F] dark:text-[#93A0A3] text-[9px] font-extrabold tracking-widest uppercase mb-2 font-mono">
                  <span>Net Valuation Impact</span>
                  <span>⚖️</span>
                </div>
                <p className={`text-2xl font-bold tracking-tight ${netImpact >= 0 ? 'text-[#4FAE7A]' : 'text-[#D9584C]'}`}>
                  {netImpact >= 0 ? '+' : ''}₹{netImpact.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-medium mt-1.5">
                  Difference between asset gains & losses.
                </p>
              </div>

              {/* Shrinkage Value */}
              <div className="rounded-2xl border border-slate-300/60 dark:border-[#38403F] bg-[#F4F1EA] dark:bg-[#1E2427] p-5 shadow-sm border-l-4 border-l-[#D9584C]">
                <div className="flex justify-between items-center text-[#707C7F] dark:text-[#93A0A3] text-[9px] font-extrabold tracking-widest uppercase mb-2 font-mono">
                  <span>Total Shrinkage (Loss)</span>
                  <span>📉</span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-[#D9584C]">
                  -₹{totalShrinkageValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-medium mt-1.5">
                  Missing/damaged items evaluated at WAC.
                </p>
              </div>

              {/* Overage Value */}
              <div className="rounded-2xl border border-slate-300/60 dark:border-[#38403F] bg-[#F4F1EA] dark:bg-[#1E2427] p-5 shadow-sm border-l-4 border-l-[#4FAE7A]">
                <div className="flex justify-between items-center text-[#707C7F] dark:text-[#93A0A3] text-[9px] font-extrabold tracking-widest uppercase mb-2 font-mono">
                  <span>Total Overage (Gain)</span>
                  <span>📈</span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-[#4FAE7A]">
                  +₹{totalOverageValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-medium mt-1.5">
                  Surplus units discovered on shelves.
                </p>
              </div>

              {/* Audit Coverage Progress */}
              <div className="rounded-2xl border border-slate-300/60 dark:border-[#38403F] bg-[#F4F1EA] dark:bg-[#1E2427] p-5 shadow-sm border-l-4 border-l-[#E0954F]">
                <div className="flex justify-between items-center text-[#707C7F] dark:text-[#93A0A3] text-[9px] font-extrabold tracking-widest uppercase mb-2 font-mono">
                  <span>Catalog Audit Coverage</span>
                  <span>🛡️</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{auditCoveragePercent}%</span>
                  <span className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-mono">({uniqueProductsAudited}/{products.length} SKUs)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-[#14181B] h-2 rounded-full overflow-hidden border border-slate-300/10 dark:border-slate-800/30 mt-3">
                  <div className="bg-gradient-to-r from-[#C1793D] to-[#E0954F] h-full rounded-full" style={{ width: `${auditCoveragePercent}%` }} />
                </div>
              </div>

            </div>

            {/* Filter controls and logs history */}
            <div className="space-y-4">
              
              {/* Filter controls panel */}
              <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                
                {/* Search field */}
                <div className="w-full md:w-1/3 relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#707C7F] dark:text-[#93A0A3] select-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search by product name, brand, or notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#EDEAE3]/60 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                  />
                </div>

                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center ml-auto">
                  
                  {/* Category Filter */}
                  <div className="w-full sm:w-auto flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider whitespace-nowrap">Category:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full bg-[#EDEAE3]/60 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-2.5 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none"
                    >
                      <option value="all">All Categories</option>
                      <option value="wire">Wires</option>
                      <option value="switch">Switches</option>
                      <option value="mcb">MCB & Switchgears</option>
                      <option value="appliance">Appliances</option>
                      <option value="fitting">Fittings</option>
                      <option value="cable">Cables</option>
                      <option value="conduit">Conduits</option>
                      <option value="other">Others</option>
                    </select>
                  </div>

                  {/* Discrepancy filter */}
                  <div className="w-full sm:w-auto flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider whitespace-nowrap">Discrepancy:</span>
                    <select
                      value={filterDiscrepancy}
                      onChange={(e) => setFilterDiscrepancy(e.target.value)}
                      className="w-full bg-[#EDEAE3]/60 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-2.5 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none"
                    >
                      <option value="all">Show All Audits</option>
                      <option value="discrepancy">Discrepancies Only</option>
                      <option value="shrinkage">Only Shrinkage (Loss)</option>
                      <option value="overage">Only Overages (Gain)</option>
                      <option value="perfect">Perfect Matches</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Logs Table */}
              <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#EDEAE3]/40 dark:bg-[#14181B] text-[#707C7F] dark:text-[#93A0A3] font-bold uppercase tracking-wider border-b border-slate-300/40 dark:border-[#38403F]">
                        <th className="py-4 px-5">Date</th>
                        <th className="py-4 px-5">Product SKU</th>
                        <th className="py-4 px-5 text-right">System Stock</th>
                        <th className="py-4 px-5 text-right">Physical Count</th>
                        <th className="py-4 px-5 text-center">Discrepancy</th>
                        <th className="py-4 px-5 text-right">Valuation Impact</th>
                        <th className="py-4 px-5">Operator</th>
                        <th className="py-4 px-5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300/30 dark:divide-[#38403F]/60">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[#707C7F] dark:text-[#93A0A3] font-medium font-mono">
                            No reconciliation entries match current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const p = log.products;
                          const financialImpact = log.discrepancy * (p?.cost_price || 0);

                          return (
                            <tr key={log.id} className="hover:bg-slate-200/20 dark:hover:bg-[#14181B]/40 transition-colors">
                              {/* Date */}
                              <td className="py-4 px-5 text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-mono">
                                {new Date(log.created_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              
                              {/* Product SKU */}
                              <td className="py-4 px-5">
                                <div className="font-bold text-[#14181B] dark:text-[#EDEAE3]">
                                  {p?.name || 'Deleted Product'}
                                </div>
                                <div className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] mt-0.5 font-medium">
                                  {p?.brand || 'Generic'} {p?.rating ? `· ${p.rating}` : ''}
                                </div>
                              </td>
                              
                              {/* System Stock */}
                              <td className="py-4 px-5 text-right font-mono text-[#707C7F] dark:text-[#93A0A3]">
                                {log.system_qty} {p?.unit_type || 'pcs'}s
                              </td>
                              
                              {/* Physical Count */}
                              <td className="py-4 px-5 text-right font-mono font-bold text-[#14181B] dark:text-white">
                                {log.physical_qty} {p?.unit_type || 'pcs'}s
                              </td>
                              
                              {/* Discrepancy */}
                              <td className="py-4 px-5 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                                  log.discrepancy > 0 
                                    ? 'bg-[#4FAE7A]/10 text-[#4FAE7A] border border-[#4FAE7A]/20'
                                    : log.discrepancy < 0
                                    ? 'bg-[#D9584C]/10 text-[#D9584C] border border-[#D9584C]/20'
                                    : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                }`}>
                                  {log.discrepancy > 0 ? `+${log.discrepancy}` : log.discrepancy}
                                </span>
                              </td>
                              
                              {/* Valuation Impact */}
                              <td className={`py-4 px-5 text-right font-mono font-bold ${
                                financialImpact > 0 
                                  ? 'text-[#4FAE7A]' 
                                  : financialImpact < 0
                                  ? 'text-[#D9584C]'
                                  : 'text-[#707C7F] dark:text-[#93A0A3]'
                              }`}>
                                {financialImpact > 0 ? '+' : ''}
                                ₹{financialImpact.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Operator */}
                              <td className="py-4 px-5 font-semibold text-xs text-[#707C7F] dark:text-[#93A0A3]">
                                {log.workers?.name || 'Admin'}
                              </td>

                              {/* Notes */}
                              <td className="py-4 px-5 text-[11px] text-[#707C7F] dark:text-[#93A0A3] max-w-xs truncate italic" title={log.notes}>
                                {log.notes ? `"${log.notes}"` : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </>
        )}

      </div>

      {/* NEW AUDIT DIALOG MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          
          <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-350/60 dark:border-[#38403F] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-slide-up">
            
            {/* Modal Header */}
            <div className="bg-[#EDEAE3] dark:bg-[#14181B] px-6 py-4 flex justify-between items-center border-b border-slate-300/40 dark:border-[#38403F]/60">
              <div>
                <h3 className="font-bold text-base text-[#14181B] dark:text-[#EDEAE3] flex items-center gap-1.5">
                  <span>🔍</span> New Physical Count Audit
                </h3>
                <p className="text-[10px] text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mt-0.5">
                  Shelf-vs-System Reconciliation
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAuditModal(false);
                  setSelectedProductId('');
                  setPhysicalCountInput('');
                  setAuditNotes('');
                }}
                className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#2A3135] border border-slate-300/40 dark:border-[#38403F] hover:border-[#C1793D] flex items-center justify-center text-xs font-black transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleAuditSubmit} className="p-6 space-y-4">
              
              {/* Product SKU Selector */}
              <div>
                <label className="block text-[9px] font-extrabold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mb-2">
                  Select Product Catalog SKU *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-[#EDEAE3] dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-3 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                >
                  <option value="">-- Choose Item SKU --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.brand ? `(${p.brand})` : ''} {p.rating ? `· ${p.rating}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Select & Worker Select Row */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Location (Godown) */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mb-2">
                    Storage Location *
                  </label>
                  <select
                    required
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full bg-[#EDEAE3] dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-3 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D]"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator/Worker */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mb-2">
                    Audited By *
                  </label>
                  <select
                    required
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full bg-[#EDEAE3] dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-3 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D]"
                  >
                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} ({worker.role})
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Selected SKU Current Stock Stats */}
              {selectedProduct && (
                <div className="bg-[#EDEAE3]/60 dark:bg-[#14181B] border border-slate-300/40 dark:border-[#38403F] rounded-xl p-3.5 space-y-2 text-[10px] font-medium font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#707C7F] dark:text-[#93A0A3]">Base Unit Price (Cost):</span>
                    <span className="font-bold text-[#14181B] dark:text-white">₹{selectedProduct.cost_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#707C7F] dark:text-[#93A0A3]">System Stock (At Location):</span>
                    <span className="font-bold text-[#C1793D]">{locationStockValue} {selectedProduct.unit_type}s</span>
                  </div>
                </div>
              )}

              {/* Physical Count Input */}
              <div>
                <label className="block text-[9px] font-extrabold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mb-2">
                  Actual Physical Quantity on Shelf *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Enter physical count"
                    value={physicalCountInput}
                    onChange={(e) => setPhysicalCountInput(e.target.value)}
                    className="w-full bg-[#EDEAE3] dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-4 py-3 text-center text-2xl font-bold font-mono text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] placeholder-slate-400"
                    disabled={!selectedProductId}
                  />
                  {selectedProduct && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase">
                      {selectedProduct.unit_type}s
                    </span>
                  )}
                </div>
              </div>

              {/* Real-time discrepancy preview */}
              {selectedProductId && physicalCountInput !== '' && (
                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 transition-colors duration-150 ${
                  calculatedDiscrepancy === 0
                    ? 'bg-slate-500/5 border-slate-500/20 text-slate-500'
                    : calculatedDiscrepancy > 0
                    ? 'bg-[#4FAE7A]/5 border-[#4FAE7A]/20 text-[#4FAE7A]'
                    : 'bg-[#D9584C]/5 border-[#D9584C]/20 text-[#D9584C]'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Calculated Discrepancy Preview</span>
                  
                  <div className="text-xl font-bold font-mono">
                    {calculatedDiscrepancy > 0 ? `+${calculatedDiscrepancy}` : calculatedDiscrepancy} {selectedProduct?.unit_type}s
                  </div>
                  
                  <div className="text-[11px] font-bold">
                    {calculatedDiscrepancy === 0 ? (
                      '✓ Shelf count matches system stock exactly. No valuation change.'
                    ) : calculatedDiscrepancy > 0 ? (
                      `📈 Financial Overage Gain: +₹${calculatedFinancialImpact.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    ) : (
                      `⚠️ Financial Shrinkage Loss: -₹${Math.abs(calculatedFinancialImpact).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[9px] font-extrabold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider mb-2">
                  Reconciliation Notes / Reason
                </label>
                <textarea
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full bg-[#EDEAE3] dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] rounded-xl px-3 py-2.5 text-xs text-[#14181B] dark:text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] h-20 placeholder-slate-400"
                  placeholder="e.g. Found 2 wire rolls water-damaged behind bottom rack"
                  disabled={!selectedProductId}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingAudit || !selectedProductId || !physicalCountInput}
                className="w-full bg-[#C1793D] hover:bg-[#E0954F] disabled:opacity-40 text-[#1a120a] font-extrabold py-4 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
              >
                {submittingAudit ? 'SYNCHRONIZING SYSTEM LEDGERS...' : 'COMMIT AUDIT ADJUSTMENT'}
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
