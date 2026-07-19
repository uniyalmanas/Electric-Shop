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
  box_quantity: number | null;
  has_warranty: boolean;
  warranty_months: number | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_threshold: number;
  parent_product_id: string | null;
  barcode: string | null;
}

interface ReconciliationLog {
  id: string;
  physical_qty: number;
  system_qty: number;
  discrepancy: number;
  notes: string;
  created_at: string;
  products: { name: string } | null;
  workers: { name: string } | null;
}

export default function InventoryPage() {
  const supabase = createClient();
  
  // Navigation tabs: 'inventory' | 'reorder' | 'audit' | 'locations'
  const [activeTab, setActiveTab] = useState<'inventory' | 'reorder' | 'audit' | 'locations'>('inventory');

  const [products, setProducts] = useState<Product[]>([]);
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortMode, setSortMode] = useState('name');

  // Starred / Most Used items set stored in localStorage
  const [starredItems, setStarredItems] = useState<Set<string>>(new Set());

  // Reconciliation logs
  const [reconciliationLogs, setReconciliationLogs] = useState<ReconciliationLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedAuditProduct, setSelectedAuditProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  // Locations / Godowns management states
  const [locations, setLocations] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [productStocks, setProductStocks] = useState<{ id: string; product_id: string; location_id: string; current_stock: number }[]>([]);
  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('');
  const [newLocationName, setNewLocationName] = useState('');
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  // Transfer stock states
  const [transferData, setTransferData] = useState({
    product_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: '',
  });
  const [isTransferring, setIsTransferring] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: 'wire',
    unit_type: 'piece',
    brand: '',
    rating: '',
    box_quantity: '',
    has_warranty: false,
    warranty_months: '',
    cost_price: '',
    selling_price: '',
    current_stock: '0',
    reorder_threshold: '0',
    parent_product_id: '',
    barcode: '',
  });

  const [adjustData, setAdjustData] = useState({
    quantity: '',
    direction: 'in' as 'in' | 'out',
    reason: 'reconciliation_adjustment',
  });

  useEffect(() => {
    // Read starred list from localStorage on mount
    const saved = localStorage.getItem('electrostock_starred_v1');
    if (saved) {
      try {
        setStarredItems(new Set(JSON.parse(saved)));
      } catch (_) {}
    }

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
          fetchProducts(worker.shop_id);
          
          // Fetch locations and stocks on init
          const { data: locs } = await supabase
            .from('locations')
            .select('*')
            .eq('shop_id', worker.shop_id)
            .order('name');
          setLocations(locs || []);
          if (locs && locs.length > 0) {
            setSelectedLocFilter(locs[0].id);
          }

          const { data: stocks } = await supabase
            .from('product_stocks')
            .select('*')
            .eq('shop_id', worker.shop_id);
          setProductStocks(stocks || []);
        }
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchLocations() {
    if (!shopId) return;
    const { data: locs } = await supabase
      .from('locations')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');
    setLocations(locs || []);
    if (locs && locs.length > 0 && !selectedLocFilter) {
      setSelectedLocFilter(locs[0].id);
    }
  }

  async function fetchProductStocks() {
    if (!shopId) return;
    const { data: stocks } = await supabase
      .from('product_stocks')
      .select('*')
      .eq('shop_id', shopId);
    setProductStocks(stocks || []);
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLocationName.trim() || !shopId) return;

    setIsAddingLocation(true);
    const { data, error } = await supabase
      .from('locations')
      .insert({
        shop_id: shopId,
        name: newLocationName.trim(),
        is_default: false,
      })
      .select()
      .single();

    setIsAddingLocation(false);
    if (error) {
      alert('Error creating location: ' + error.message);
    } else {
      setNewLocationName('');
      alert('✅ Location registered successfully!');
      fetchLocations();
    }
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferData.product_id || !transferData.from_location_id || !transferData.to_location_id || !transferData.quantity) {
      alert('Please fill out all fields.');
      return;
    }
    const qty = Number(transferData.quantity);
    if (qty <= 0) {
      alert('Quantity must be greater than zero.');
      return;
    }
    if (transferData.from_location_id === transferData.to_location_id) {
      alert('Source and destination locations must be different.');
      return;
    }

    const { data: workers } = await supabase.from('workers').select('id').limit(1);
    if (!workers || workers.length === 0) {
      alert('No staff worker registered in database to attribute log entry.');
      return;
    }
    const workerId = workers[0].id;

    setIsTransferring(true);

    const res = await fetch('/api/stock-movements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: transferData.product_id,
        worker_id: workerId,
        quantity: qty,
        direction: 'out',
        reason: 'transfer',
        location_id: transferData.from_location_id,
        to_location_id: transferData.to_location_id,
      }),
    });

    const result = await res.json();
    setIsTransferring(false);

    if (result.error) {
      alert('Transfer failed: ' + result.error);
    } else {
      alert('✅ Stock successfully transferred between locations!');
      setTransferData({
        product_id: '',
        from_location_id: '',
        to_location_id: '',
        quantity: '',
      });
      fetchProducts();
      fetchProductStocks();
    }
  }

  async function fetchProducts(targetShopId = shopId) {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', targetShopId)
      .order('name');
    setProducts((data as any) || []);
    setLoading(false);
  }

  async function fetchReconciliationLogs() {
    setLoadingAudit(true);
    const { data } = await supabase
      .from('reconciliation_logs')
      .select(`
        id,
        physical_qty,
        system_qty,
        discrepancy,
        notes,
        created_at,
        products (name),
        workers (name)
      `)
      .order('created_at', { ascending: false });
    setReconciliationLogs((data as any) || []);
    setLoadingAudit(false);
  }

  // Toggle Star / Bulb status
  function toggleStar(prodId: string) {
    const next = new Set(starredItems);
    if (next.has(prodId)) {
      next.delete(prodId);
    } else {
      next.add(prodId);
    }
    setStarredItems(next);
    localStorage.setItem('electrostock_starred_v1', JSON.stringify(Array.from(next)));
  }

  // Handle Add Product
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;

    const payload = {
      shop_id: shopId,
      name: formData.name,
      category: formData.category,
      unit_type: formData.unit_type,
      brand: formData.brand || null,
      rating: formData.rating || null,
      box_quantity: formData.box_quantity ? Number(formData.box_quantity) : null,
      has_warranty: formData.has_warranty,
      warranty_months: formData.has_warranty && formData.warranty_months ? Number(formData.warranty_months) : null,
      cost_price: Number(formData.cost_price) || 0,
      selling_price: Number(formData.selling_price) || 0,
      current_stock: Number(formData.current_stock) || 0,
      reorder_threshold: Number(formData.reorder_threshold) || 0,
      parent_product_id: formData.parent_product_id || null,
      barcode: formData.barcode || null,
    };

    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      if (payload.current_stock > 0 && data) {
        const { data: workers } = await supabase.from('workers').select('id').limit(1);
        if (workers && workers.length > 0) {
          await supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id: data.id,
            worker_id: workers[0].id,
            quantity: payload.current_stock,
            direction: 'in',
            reason: 'reconciliation_adjustment',
            entry_method: 'manual',
          });
        }
      }
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    }
  }

  // Handle Edit Product
  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProduct) return;

    const payload = {
      name: formData.name,
      category: formData.category,
      unit_type: formData.unit_type,
      brand: formData.brand || null,
      rating: formData.rating || null,
      box_quantity: formData.box_quantity ? Number(formData.box_quantity) : null,
      has_warranty: formData.has_warranty,
      warranty_months: formData.has_warranty && formData.warranty_months ? Number(formData.warranty_months) : null,
      cost_price: Number(formData.cost_price) || 0,
      selling_price: Number(formData.selling_price) || 0,
      reorder_threshold: Number(formData.reorder_threshold) || 0,
      parent_product_id: formData.parent_product_id || null,
      barcode: formData.barcode || null,
    };

    const { error } = await supabase.from('products').update(payload).eq('id', activeProduct.id);
    if (error) {
      alert('Error updating product: ' + error.message);
    } else {
      setShowEditModal(false);
      resetForm();
      fetchProducts();
    }
  }

  // Handle Stock adjustment modal submit
  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProduct || !adjustData.quantity) return;

    const qty = Number(adjustData.quantity);
    const newStock = adjustData.direction === 'in' 
      ? activeProduct.current_stock + qty 
      : Math.max(0, activeProduct.current_stock - qty);

    const { data: workers } = await supabase.from('workers').select('id').limit(1);
    if (!workers || workers.length === 0) {
      alert('No staff worker registered in database to credit log entry.');
      return;
    }
    const workerId = workers[0].id;

    const [{ error: updateErr }] = await Promise.all([
      supabase.from('products').update({ current_stock: newStock }).eq('id', activeProduct.id),
      supabase.from('stock_movements').insert({
        shop_id: shopId,
        product_id: activeProduct.id,
        worker_id: workerId,
        quantity: qty,
        direction: adjustData.direction,
        reason: adjustData.reason,
        entry_method: 'manual',
      }),
    ]);

    if (updateErr) {
      alert('Failed adjustment: ' + updateErr.message);
    } else {
      setShowAdjustModal(false);
      setAdjustData({ quantity: '', direction: 'in', reason: 'reconciliation_adjustment' });
      fetchProducts();
    }
  }

  // Handle Manual Physical Audit Submit
  async function handleAuditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAuditProduct || !physicalCount) return;

    const physical = Number(physicalCount);
    const current = selectedAuditProduct.current_stock;
    const diff = physical - current;

    if (diff === 0) {
      alert('Physical count matches system count exactly. No adjustment logs written.');
      setSelectedAuditProduct(null);
      setPhysicalCount('');
      return;
    }

    const { data: workers } = await supabase.from('workers').select('id').limit(1);
    const workerId = workers?.[0]?.id;

    if (!workerId) {
      alert('Must have at least one worker created to link count audits.');
      return;
    }

    // 1. Log discrepancy in reconciliation_logs
    const { error: logErr } = await supabase.from('reconciliation_logs').insert({
      shop_id: shopId,
      product_id: selectedAuditProduct.id,
      worker_id: workerId,
      physical_qty: physical,
      system_qty: current,
      discrepancy: diff,
      notes: auditNotes || 'Routine shelf stock reconciliation check',
    });

    if (logErr) {
      alert('Failed to log audit log: ' + logErr.message);
      return;
    }

    // 2. Update product stock count
    await supabase.from('products').update({ current_stock: physical }).eq('id', selectedAuditProduct.id);

    // 3. Record stock movement audit trail
    await supabase.from('stock_movements').insert({
      shop_id: shopId,
      product_id: selectedAuditProduct.id,
      worker_id: workerId,
      quantity: Math.abs(diff),
      direction: diff >= 0 ? 'in' : 'out',
      reason: 'reconciliation_adjustment',
      entry_method: 'manual',
    });

    alert('✅ Physical Count updated! Discrepancy successfully logged.');
    setSelectedAuditProduct(null);
    setPhysicalCount('');
    setAuditNotes('');
    fetchProducts();
    fetchReconciliationLogs();
  }

  // Handle Delete
  async function handleDeleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Delete failed: ' + error.message);
    else fetchProducts();
  }

  function openEdit(product: Product) {
    setActiveProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      unit_type: product.unit_type,
      brand: product.brand || '',
      rating: product.rating || '',
      box_quantity: product.box_quantity ? String(product.box_quantity) : '',
      has_warranty: product.has_warranty,
      warranty_months: product.warranty_months ? String(product.warranty_months) : '',
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      current_stock: String(product.current_stock),
      reorder_threshold: String(product.reorder_threshold),
      parent_product_id: product.parent_product_id || '',
      barcode: product.barcode || '',
    });
    setShowEditModal(true);
  }

  function openAdjust(product: Product) {
    setActiveProduct(product);
    setShowAdjustModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      category: 'wire',
      unit_type: 'piece',
      brand: '',
      rating: '',
      box_quantity: '',
      has_warranty: false,
      warranty_months: '',
      cost_price: '',
      selling_price: '',
      current_stock: '0',
      reorder_threshold: '0',
      parent_product_id: '',
      barcode: '',
    });
    setActiveProduct(null);
  }

  // Filter & Sort Logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.rating && p.rating.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesLowStock = !lowStockOnly || p.current_stock < p.reorder_threshold;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortMode === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'stock-low') {
      return a.current_stock - b.current_stock;
    }
    if (sortMode === 'price-low') {
      return a.selling_price - b.selling_price;
    }
    if (sortMode === 'price-high') {
      return b.selling_price - a.selling_price;
    }
    if (sortMode === 'starred') {
      const aStarred = starredItems.has(a.id) ? 1 : 0;
      const bStarred = starredItems.has(b.id) ? 1 : 0;
      return bStarred - aStarred;
    }
    return 0;
  });

  const lowStockProducts = products.filter((p) => p.current_stock < p.reorder_threshold);

  // Group Low Stock items by Brand/Supplier
  const reorderGroups: Record<string, Product[]> = {};
  lowStockProducts.forEach((p) => {
    const brand = p.brand || 'Generic';
    if (!reorderGroups[brand]) reorderGroups[brand] = [];
    reorderGroups[brand].push(p);
  });

  // Unique list of categories in database
  const categoriesList = ['all', 'wire', 'switch', 'mcb', 'appliance', 'fitting', 'cable', 'conduit', 'other'];

  // Starred / Most Used items
  const starredList = products.filter((p) => starredItems.has(p.id));

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased transition-colors duration-200">
      
      {/* Decorative radial top glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />

      <Header title="ElectroStock Manager" backUrl="/owner" />

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6 z-10 animate-slide-up">
        
        {/* --- BUSBAR HEADER BANNER --- */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#1E2427] to-[#2A3135] border border-[#38403F] rounded-2xl p-6 pl-8 flex justify-between items-center shadow-md">
          {/* Copper Busbar Strip */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[repeating-linear-gradient(180deg,#C1793D_0px,#C1793D_10px,#F0AD3E_10px,#F0AD3E_20px)] opacity-80" />
          
          <div>
            <span className="font-mono text-[9px] tracking-widest text-[#93A0A3] uppercase">Inventory · Electrical Retail</span>
            <h1 className="text-2xl font-bold tracking-tight mt-1 text-[#EDEAE3]">
              Electro<span className="text-[#E0954F]">Stock</span>
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-5 font-mono text-[11px] text-[#93A0A3]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4FAE7A] animate-pulse shadow-[0_0_6px_#4FAE7A]" />
              Live Catalog
            </span>
            <span>·</span>
            <span>{products.length} registered items</span>
          </div>
        </div>

        {/* Tab Switcher & Quick Add Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-[#1E2427] p-1 rounded-xl flex gap-1 border border-[#38403F] shadow-sm w-full md:max-w-3xl">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'inventory' 
                  ? 'bg-[#C1793D] text-[#1a120a]' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              📦 Live SKU Catalog
            </button>
            <button
              onClick={() => setActiveTab('reorder')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'reorder' 
                  ? 'bg-[#C1793D] text-[#1a120a]' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              📋 Auto PO Sheets ({lowStockProducts.length})
            </button>
            <button
              onClick={() => { setActiveTab('audit'); fetchReconciliationLogs(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'audit' 
                  ? 'bg-[#C1793D] text-[#1a120a]' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              🔍 Physical Audit Logs
            </button>
            <button
              onClick={() => { setActiveTab('locations'); fetchLocations(); fetchProductStocks(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'locations' 
                  ? 'bg-[#C1793D] text-[#1a120a]' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              🏢 Godowns & Transfers
            </button>
          </div>

          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap"
          >
            ➕ Register New SKU
          </button>
        </div>

        {/* --- TAB 1: ALL SKUS CATALOG --- */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            
            {/* Quick Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1E2427] border border-[#38403F] rounded-2xl p-4 shadow-sm border-l-4 border-l-[#C1793D]">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest">Total SKUs</p>
                <p className="text-xl font-bold mt-1 text-[#EDEAE3]">{products.length}</p>
              </div>
              <div className="bg-[#1E2427] border border-[#38403F] rounded-2xl p-4 shadow-sm border-l-4 border-l-[#F0AD3E]">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest">Low Stock</p>
                <p className="text-xl font-bold mt-1 text-[#F0AD3E]">{lowStockProducts.length}</p>
              </div>
              <div className="bg-[#1E2427] border border-[#38403F] rounded-2xl p-4 shadow-sm border-l-4 border-l-[#D9584C]">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest">Out of Stock</p>
                <p className="text-xl font-bold mt-1 text-[#D9584C]">
                  {products.filter(p => p.current_stock === 0).length}
                </p>
              </div>
              <div className="bg-[#1E2427] border border-[#38403F] rounded-2xl p-4 shadow-sm border-l-4 border-l-[#4FAE7A]">
                <p className="text-[#93A0A3] text-[9px] font-bold uppercase tracking-widest">Valuation (Cost)</p>
                <p className="text-xl font-bold mt-1 text-[#4FAE7A]">
                  ₹{products.reduce((sum, p) => sum + (p.cost_price * p.current_stock), 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Controls panel */}
            <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search */}
                <div className="flex-1 w-full relative">
                  <input
                    type="text"
                    placeholder="Search wire, MCB, switch, brand, or rating..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 pl-10 text-[#EDEAE3] placeholder-[#93A0A3] text-sm focus:outline-none focus:border-[#C1793D]"
                  />
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93A0A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Sort */}
                <div className="w-full md:w-auto flex gap-3 items-center">
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value)}
                    className="bg-[#14181B] border border-[#38403F] rounded-xl p-3 text-xs font-mono text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] w-full md:w-auto"
                  >
                    <option value="name">SORT: NAME A–Z</option>
                    <option value="stock-low">SORT: STOCK (LOW FIRST)</option>
                    <option value="price-low">SORT: PRICE (LOW FIRST)</option>
                    <option value="price-high">SORT: PRICE (HIGH FIRST)</option>
                    <option value="starred">SORT: STARRED FIRST</option>
                  </select>

                  <label className="flex items-center gap-2 cursor-pointer text-[#93A0A3] text-xs font-bold select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={lowStockOnly}
                      onChange={(e) => setLowStockOnly(e.target.checked)}
                      className="w-4.5 h-4.5 rounded bg-[#14181B] border-[#38403F] text-[#C1793D] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    Low Stock Only
                  </label>
                </div>
              </div>

              {/* Categories breaker switches layout */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-[#38403F]">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`pill flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#C1793D] text-[#1a120a] border-[#C1793D] font-bold'
                        : 'bg-[#1E2427] border-[#38403F] text-[#93A0A3] hover:border-[#C1793D] hover:text-[#EDEAE3]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedCategory === cat ? 'bg-[#1a120a]' : 'bg-[#38403F]'}`} />
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* --- STARRED MOST USED STRIP --- */}
            {starredList.length > 0 && (
              <section className="bg-gradient-to-r from-[#F0AD3E]/5 to-transparent border border-[#F0AD3E]/25 rounded-2xl p-4 space-y-3">
                <h2 className="font-mono text-[10px] text-[#F0AD3E] uppercase tracking-widest font-bold flex items-center gap-1.5">
                  ⭐ Your Most Used Items ({starredList.length})
                </h2>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                  {starredList.map((item) => (
                    <div key={item.id} className="flex-none bg-[#1E2427] border border-[#38403F] px-3.5 py-2 rounded-full text-xs flex items-center gap-2 hover:border-[#C1793D] transition-colors">
                      <span className="text-[#EDEAE3] font-bold">{item.name}</span>
                      <span className="font-mono text-[10px] text-[#93A0A3]">{item.current_stock} {item.unit_type}s</span>
                      <button onClick={() => toggleStar(item.id)} className="text-[#F0AD3E] hover:text-red-400 font-bold ml-1 text-xs">×</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Catalog Grid */}
            {loading ? (
              <div className="text-center py-12 text-[#93A0A3] font-mono">Loading catalog inventory...</div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-16 bg-[#1E2427] border border-[#38403F] rounded-3xl text-[#93A0A3] font-mono text-xs">
                No items match selected filters. Register new product above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedProducts.map((p) => {
                  const isLow = p.current_stock < p.reorder_threshold;
                  const isCritical = p.current_stock === 0;
                  const starred = starredItems.has(p.id);

                  return (
                    <div key={p.id} className="bg-[#1E2427] border border-[#38403F] rounded-2xl p-5 hover:border-[#C1793D] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm group">
                      
                      <div className="space-y-2">
                        {/* Top Line */}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-[9px] text-[#E0954F] font-bold uppercase tracking-wider">{p.category}</span>
                          
                          {/* Bulb Button */}
                          <button
                            onClick={() => toggleStar(p.id)}
                            className="text-[#93A0A3] hover:text-[#F0AD3E] transition-colors"
                            title={starred ? "Starred (most used)" : "Click to star"}
                          >
                            <svg className={`w-5 h-5 transition-all ${starred ? 'text-[#F0AD3E] fill-[#F0AD3E]/30 drop-shadow-[0_0_4px_#F0AD3E]' : 'stroke-current fill-none'}`} viewBox="0 0 24 24">
                              <path strokeWidth="1.8" strokeLinecap="round" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.15 1.1 1.95V16h5v-.25c0-.8.5-1.5 1.1-1.95A6 6 0 0 0 12 3Z"/>
                            </svg>
                          </button>
                        </div>

                        {/* Name & specs */}
                        <div>
                          <h4 className="font-bold text-base text-[#EDEAE3] leading-snug group-hover:text-[#E0954F] transition-colors">{p.name}</h4>
                          <p className="text-xs text-[#93A0A3] mt-1 font-medium">{p.brand || 'Generic'} {p.rating && `· ${p.rating}`}</p>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {p.barcode && (
                            <span className="font-mono text-[8px] border border-[#38403F] px-1.5 py-0.5 rounded text-[#93A0A3]">
                              🏷️ {p.barcode}
                            </span>
                          )}
                          {p.has_warranty && (
                            <span className="font-mono text-[8px] bg-[#C1793D]/10 border border-[#C1793D]/20 text-[#E0954F] px-1.5 py-0.5 rounded">
                              🛡️ {p.warranty_months}M Warranty
                            </span>
                          )}
                          {p.parent_product_id && (
                            <span className="font-mono text-[8px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                              📦 Linked
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Line */}
                      <div className="border-t border-[#38403F]/60 pt-4 flex justify-between items-end gap-2">
                        {/* Price */}
                        <div>
                          <span className="font-mono text-[14px] font-bold text-[#EDEAE3]">₹{p.selling_price}</span>
                          <span className="font-mono text-[10px] text-[#93A0A3] block">per {p.unit_type}</span>
                        </div>

                        {/* Stock Level and Meter */}
                        <div className="w-[100px] space-y-1">
                          <div className="flex justify-between font-mono text-[9px] text-[#93A0A3]">
                            <span>Stock:</span>
                            <span className={isCritical ? 'text-[#D9584C] font-bold' : isLow ? 'text-[#F0AD3E] font-bold' : 'text-[#4FAE7A]'}>
                              {p.current_stock}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-[#2A3135] h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              isCritical ? 'bg-[#D9584C]' : isLow ? 'bg-[#F0AD3E]' : 'bg-[#4FAE7A]'
                            }`} style={{ width: `${Math.min(100, (p.current_stock / (p.reorder_threshold || 1)) * 50)}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex gap-2 pt-2 border-t border-[#38403F]/40 justify-end">
                        <button
                          onClick={() => openAdjust(p)}
                          className="bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Adjust Stock
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="bg-[#C1793D]/10 hover:bg-[#C1793D]/25 border border-[#C1793D]/30 text-[#E0954F] font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-[#D9584C] hover:bg-[#D9584C]/10 p-2 rounded-lg transition-colors text-xs"
                          title="Delete Product"
                        >
                          🗑️
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: SUPPLIER REORDER PO SHEETS --- */}
        {activeTab === 'reorder' && (
          <div className="space-y-6">
            <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#EDEAE3]">Supplier Order Placement Panel</h3>
              <p className="text-[#93A0A3] text-xs mt-1 leading-relaxed">
                Purchase Order (PO) lists are generated by grouping low-stock items by their registered Brand/Supplier. Copy the message to quickly dispatch order requests over WhatsApp.
              </p>
            </div>

            {Object.keys(reorderGroups).length === 0 ? (
              <div className="text-center py-16 bg-[#1E2427] border border-[#38403F] rounded-2xl text-[#93A0A3] font-mono text-xs">
                🎉 All products are stocked above reorder thresholds!
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(reorderGroups).map(([brand, items]) => (
                  <div key={brand} className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm">
                    <div>
                      <div className="flex justify-between items-center border-b border-[#38403F] pb-3">
                        <h4 className="font-bold text-base text-[#EDEAE3]">🏭 Distributor: {brand}</h4>
                        <span className="text-[10px] bg-[#D9584C]/15 border border-[#D9584C]/30 text-[#D9584C] font-bold px-2.5 py-1 rounded-full">
                          {items.length} item{items.length !== 1 && 's'} low
                        </span>
                      </div>

                      <div className="space-y-3 mt-4">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-[#EDEAE3]">{item.name}</p>
                              <p className="text-[10px] text-[#93A0A3] mt-0.5">Stock: {item.current_stock} · Min limit: {item.reorder_threshold}</p>
                            </div>
                            <span className="font-bold text-[#D9584C] bg-[#D9584C]/10 px-2 py-1 rounded text-[10px]">
                              +{Math.max(10, Math.ceil(item.reorder_threshold * 2 - item.current_stock))} {item.unit_type}s
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#38403F] flex gap-2">
                      <button
                        onClick={() => {
                          const poText = `PO Request for ${brand}:\n` + items.map(item => `- ${item.name}: Qty ${Math.max(10, Math.ceil(item.reorder_threshold * 2 - item.current_stock))} ${item.unit_type}s`).join('\n');
                          navigator.clipboard.writeText(poText);
                          alert('✅ Purchase Order copied to clipboard!');
                        }}
                        className="flex-1 bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-2.5 rounded-xl text-xs transition-colors"
                      >
                        📋 Copy PO Text
                      </button>
                      
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `PO Request for ${brand}:\n` + items.map(item => `- ${item.name}: Qty ${Math.max(10, Math.ceil(item.reorder_threshold * 2 - item.current_stock))} ${item.unit_type}s`).join('\n')
                        )}`}
                        target="_blank"
                        className="flex-1 bg-[#4FAE7A] hover:bg-[#4FAE7A]/90 text-white font-bold py-2.5 rounded-xl text-xs text-center transition-colors flex items-center justify-center gap-1.5"
                      >
                        💬 Send WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: RECONCILIATION AUDIT LOGS --- */}
        {activeTab === 'audit' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel: Record Audit Form */}
            <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 h-fit space-y-4 shadow-sm">
              <div>
                <h3 className="font-bold text-base text-[#EDEAE3]">Verify Physical Stock</h3>
                <p className="text-[#93A0A3] text-xs mt-1">Audit physical inventory counts on shelves. Discrepancies are logged for accountant margins verification.</p>
              </div>

              <form onSubmit={handleAuditSubmit} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Select Catalog Item</label>
                  <select
                    value={selectedAuditProduct ? selectedAuditProduct.id : ''}
                    onChange={(e) => {
                      const p = products.find((prod) => prod.id === e.target.value);
                      setSelectedAuditProduct(p || null);
                    }}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-xs focus:outline-none"
                  >
                    <option value="">-- Choose Product SKU --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.brand || 'Generic'})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAuditProduct && (
                  <div className="bg-[#14181B] border border-[#38403F] p-3.5 rounded-xl space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-[#93A0A3]">System Stock:</span>
                      <span className="font-bold text-[#EDEAE3]">{selectedAuditProduct.current_stock} {selectedAuditProduct.unit_type}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#93A0A3]">Stock Valuation:</span>
                      <span className="font-bold text-[#4FAE7A]">₹{(selectedAuditProduct.cost_price * selectedAuditProduct.current_stock).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Actual Physical Count</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(e.target.value)}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-center text-xl font-bold focus:outline-none"
                    placeholder="Shelf count"
                    disabled={!selectedAuditProduct}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Reconciliation Notes</label>
                  <textarea
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-2 text-[#EDEAE3] text-xs focus:outline-none h-16"
                    placeholder="e.g. Found 2 pieces damaged"
                    disabled={!selectedAuditProduct}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedAuditProduct || !physicalCount}
                  className="w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold py-3.5 rounded-xl disabled:opacity-40 transition-colors text-xs active:scale-95 shadow-sm"
                >
                  Log Count & Correct Stock
                </button>
              </form>
            </div>

            {/* Reconciliation Logs Table */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="font-bold text-xs text-[#93A0A3] uppercase tracking-widest">Physical count reconciliation logs</h4>
              {loadingAudit ? (
                <p className="text-[#93A0A3] text-xs">Loading audit logs...</p>
              ) : reconciliationLogs.length === 0 ? (
                <p className="text-[#93A0A3] text-xs py-8 text-center bg-[#1E2427] border border-[#38403F] rounded-2xl">No stock audits recorded.</p>
              ) : (
                <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase tracking-wider border-b border-[#38403F]">
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Product</th>
                          <th className="py-3.5 px-4 text-center">System Qty</th>
                          <th className="py-3.5 px-4 text-center">Physical Qty</th>
                          <th className="py-3.5 px-4 text-center">Discrepancy</th>
                          <th className="py-3.5 px-4">Worker</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#38403F]/60">
                        {reconciliationLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#14181B]/40 transition-colors">
                            <td className="py-3 px-4 text-[10px] text-[#93A0A3]">
                              {new Date(log.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-[#EDEAE3]">{log.products?.name}</p>
                              {log.notes && <p className="text-[10px] text-[#F0AD3E] italic mt-0.5">"{log.notes}"</p>}
                            </td>
                            <td className="py-3 px-4 text-center font-mono">{log.system_qty}</td>
                            <td className="py-3 px-4 text-center font-mono">{log.physical_qty}</td>
                            <td className={`py-3 px-4 text-center font-bold font-mono ${
                              log.discrepancy >= 0 ? 'text-[#4FAE7A]' : 'text-[#D9584C]'
                            }`}>
                              {log.discrepancy > 0 ? `+${log.discrepancy}` : log.discrepancy}
                            </td>
                            <td className="py-3 px-4 font-bold text-[#93A0A3]">{log.workers?.name || 'Admin'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 4: GODOWN LOCATIONS & TRANSFERS --- */}
        {activeTab === 'locations' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel: Register & Transfer */}
            <div className="space-y-6">
              {/* Stock Transfer Form */}
              <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C1793D]" />
                <div>
                  <h3 className="font-bold text-base text-[#EDEAE3]">Transfer Stock</h3>
                  <p className="text-[#93A0A3] text-xs mt-1">Move products between your retail counter and warehouse godowns.</p>
                </div>

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Select Item</label>
                    <select
                      value={transferData.product_id}
                      onChange={(e) => setTransferData({ ...transferData, product_id: e.target.value })}
                      className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-xs focus:outline-none focus:border-[#C1793D]"
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.brand || 'Generic'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {transferData.product_id && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">From Location</label>
                        <select
                          value={transferData.from_location_id}
                          onChange={(e) => setTransferData({ ...transferData, from_location_id: e.target.value })}
                          className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-xs focus:outline-none focus:border-[#C1793D]"
                          required
                        >
                          <option value="">-- Source --</option>
                          {locations.map((loc) => {
                            const stockRow = productStocks.find(s => s.product_id === transferData.product_id && s.location_id === loc.id);
                            const currentLocStock = stockRow ? Number(stockRow.current_stock) : 0;
                            return (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({currentLocStock} available)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">To Location</label>
                        <select
                          value={transferData.to_location_id}
                          onChange={(e) => setTransferData({ ...transferData, to_location_id: e.target.value })}
                          className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-xs focus:outline-none focus:border-[#C1793D]"
                          required
                        >
                          <option value="">-- Destination --</option>
                          {locations
                            .filter(loc => loc.id !== transferData.from_location_id)
                            .map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Transfer Quantity</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={transferData.quantity}
                      onChange={(e) => setTransferData({ ...transferData, quantity: e.target.value })}
                      className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-center text-xl font-bold focus:outline-none focus:border-[#C1793D]"
                      placeholder="0"
                      disabled={!transferData.product_id}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTransferring || !transferData.product_id || !transferData.quantity}
                    className="w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold py-3.5 rounded-xl disabled:opacity-40 transition-colors text-xs active:scale-95 shadow-sm"
                  >
                    {isTransferring ? 'Processing...' : 'Confirm Transfer'}
                  </button>
                </form>
              </div>

              {/* Add Location Form */}
              <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4FAE7A]" />
                <div>
                  <h3 className="font-bold text-base text-[#EDEAE3]">Register New Location</h3>
                  <p className="text-[#93A0A3] text-xs mt-1">Create a new godown, warehouse, or retail counter location.</p>
                </div>

                <form onSubmit={handleAddLocation} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Location Name</label>
                    <input
                      type="text"
                      required
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-3 py-3 text-[#EDEAE3] text-xs focus:outline-none focus:border-[#C1793D]"
                      placeholder="e.g. Godown B, Warehouse 2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingLocation || !newLocationName.trim()}
                    className="w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-3 rounded-xl disabled:opacity-40 transition-colors text-xs active:scale-95 shadow-sm"
                  >
                    {isAddingLocation ? 'Creating...' : 'Register Location'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Panel: Location Stock List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h4 className="font-bold text-xs text-[#93A0A3] uppercase tracking-widest">Godown Location Inventory Stocks</h4>
                
                {/* Location selector tabs */}
                <div className="flex flex-wrap gap-1.5 bg-[#14181B] p-1 rounded-xl border border-[#38403F]">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLocFilter(loc.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedLocFilter === loc.id
                          ? 'bg-[#C1793D] text-[#1a120a]'
                          : 'text-[#93A0A3] hover:text-[#EDEAE3]'
                      }`}
                    >
                      {loc.name} {loc.is_default && '⭐️'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock inventory table */}
              <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase tracking-wider border-b border-[#38403F]">
                        <th className="py-3.5 px-4">Brand</th>
                        <th className="py-3.5 px-4">Product Name</th>
                        <th className="py-3.5 px-4 text-center">Local Stock</th>
                        <th className="py-3.5 px-4 text-center">Global Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#38403F]/60">
                      {products.map((p) => {
                        const stockRow = productStocks.find(s => s.product_id === p.id && s.location_id === selectedLocFilter);
                        const localStock = stockRow ? Number(stockRow.current_stock) : 0;
                        const isLow = localStock < p.reorder_threshold;

                        return (
                          <tr key={p.id} className="hover:bg-[#14181B]/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-[#E0954F] font-mono text-[10px]">
                              {p.brand || 'Generic'}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-[#EDEAE3]">{p.name}</p>
                              {p.rating && <p className="text-[10px] text-[#93A0A3] mt-0.5">{p.rating}</p>}
                            </td>
                            <td className={`py-3 px-4 text-center font-mono font-bold ${
                              localStock === 0 ? 'text-[#D9584C]' : isLow ? 'text-[#F0AD3E]' : 'text-[#4FAE7A]'
                            }`}>
                              {localStock} {p.unit_type}s
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[#93A0A3]">
                              {p.current_stock} {p.unit_type}s
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- ADD SKU PRODUCT MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-[#EDEAE3]">
            <div className="bg-[#14181B] p-6 border-b border-[#38403F] flex justify-between items-center">
              <h2 className="text-xl font-bold">Register New SKU / Catalog Product</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#93A0A3] hover:text-[#EDEAE3] text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleAddProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="e.g. Havells 2.5sqmm 3-core Cable"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="wire">Wire</option>
                    <option value="switch">Switch</option>
                    <option value="mcb">MCB</option>
                    <option value="appliance">Appliance</option>
                    <option value="fitting">Fitting</option>
                    <option value="cable">Cable</option>
                    <option value="conduit">Conduit</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Unit Type</label>
                  <select
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="meter">Meter</option>
                    <option value="piece">Piece</option>
                    <option value="box">Box</option>
                    <option value="roll">Roll</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="e.g. Havells, Finolex"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Rating / Gauge</label>
                  <input
                    type="text"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="e.g. 16A, 2.5 sq mm"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Box Quantity</label>
                  <input
                    type="number"
                    value={formData.box_quantity}
                    onChange={(e) => setFormData({ ...formData, box_quantity: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="Units per box"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    value={formData.reorder_threshold}
                    onChange={(e) => setFormData({ ...formData, reorder_threshold: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Initial Stock Count</label>
                  <input
                    type="number"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Barcode / UPC Number</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="e.g. 8901058002315"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Link to Parent Box SKU (Unboxing conversion)</label>
                  <select
                    value={formData.parent_product_id}
                    onChange={(e) => setFormData({ ...formData, parent_product_id: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="">-- No link (Independent Item) --</option>
                    {products
                      .filter(p => p.unit_type === 'box')
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.brand || 'Generic'})</option>
                      ))}
                  </select>
                </div>

                <div className="col-span-2 border-t border-[#38403F] pt-4 flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.has_warranty}
                      onChange={(e) => setFormData({ ...formData, has_warranty: e.target.checked })}
                      className="w-5 h-5 rounded bg-[#14181B] border-[#38403F] text-[#C1793D] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#EDEAE3]">Product carries customer replacement warranty</span>
                  </label>

                  {formData.has_warranty && (
                    <div className="max-w-[200px] animate-in slide-in-from-top-2 duration-150">
                      <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Warranty Months</label>
                      <input
                        type="number"
                        required
                        value={formData.warranty_months}
                        onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                        className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                        placeholder="Months"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#38403F] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-[#2A3135] hover:bg-[#38403F] text-[#EDEAE3] font-bold px-5 py-3 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-6 py-3 rounded-xl text-xs shadow"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT SKU PRODUCT MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-[#EDEAE3]">
            <div className="bg-[#14181B] p-6 border-b border-[#38403F] flex justify-between items-center">
              <h2 className="text-xl font-bold">Edit Product: {activeProduct?.name}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-[#93A0A3] hover:text-[#EDEAE3] text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleEditProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="wire">Wire</option>
                    <option value="switch">Switch</option>
                    <option value="mcb">MCB</option>
                    <option value="appliance">Appliance</option>
                    <option value="fitting">Fitting</option>
                    <option value="cable">Cable</option>
                    <option value="conduit">Conduit</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Unit Type</label>
                  <select
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="meter">Meter</option>
                    <option value="piece">Piece</option>
                    <option value="box">Box</option>
                    <option value="roll">Roll</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Rating / Gauge</label>
                  <input
                    type="text"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Box Quantity</label>
                  <input
                    type="number"
                    value={formData.box_quantity}
                    onChange={(e) => setFormData({ ...formData, box_quantity: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    value={formData.reorder_threshold}
                    onChange={(e) => setFormData({ ...formData, reorder_threshold: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Barcode / UPC Number</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                    placeholder="e.g. 8901058002315"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Link to Parent Box SKU (Unboxing conversion)</label>
                  <select
                    value={formData.parent_product_id}
                    onChange={(e) => setFormData({ ...formData, parent_product_id: e.target.value })}
                    className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                  >
                    <option value="">-- No link (Independent Item) --</option>
                    {products
                      .filter(p => p.unit_type === 'box' && (!activeProduct || p.id !== activeProduct.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.brand || 'Generic'})</option>
                      ))}
                  </select>
                </div>

                <div className="col-span-2 border-t border-[#38403F] pt-4 flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.has_warranty}
                      onChange={(e) => setFormData({ ...formData, has_warranty: e.target.checked })}
                      className="w-5 h-5 rounded bg-[#14181B] border-[#38403F] text-[#C1793D] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#EDEAE3]">Product carries customer replacement warranty</span>
                  </label>

                  {formData.has_warranty && (
                    <div className="max-w-[200px] animate-in slide-in-from-top-2 duration-150">
                      <label className="block text-[9px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">Warranty Months</label>
                      <input
                        type="number"
                        required
                        value={formData.warranty_months}
                        onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                        className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] focus:outline-none"
                        placeholder="Months"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#38403F] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-[#2A3135] hover:bg-[#38403F] text-[#EDEAE3] font-bold px-5 py-3 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-6 py-3 rounded-xl text-xs shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADJUST QUICK STOCK COUNT MODAL --- */}
      {showAdjustModal && activeProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-[#EDEAE3]">
            <div className="bg-[#14181B] p-6 border-b border-[#38403F] flex justify-between items-center">
              <h2 className="text-base font-bold">Quick Stock Adjustment</h2>
              <button onClick={() => setShowAdjustModal(false)} className="text-[#93A0A3] hover:text-[#EDEAE3] text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#EDEAE3]">{activeProduct.name}</h3>
                <p className="text-[11px] text-[#93A0A3] mt-0.5">
                  Current Stock: {activeProduct.current_stock} {activeProduct.unit_type}s
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustData({ ...adjustData, direction: 'out' })}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                    adjustData.direction === 'out' 
                      ? 'bg-[#D9584C]/15 border-[#D9584C] text-[#D9584C]' 
                      : 'bg-[#14181B] border-[#38403F] text-[#93A0A3]'
                  }`}
                >
                  📤 Remove / Sold
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustData({ ...adjustData, direction: 'in' })}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                    adjustData.direction === 'in' 
                      ? 'bg-[#4FAE7A]/15 border-[#4FAE7A] text-[#4FAE7A]' 
                      : 'bg-[#14181B] border-[#38403F] text-[#93A0A3]'
                  }`}
                >
                  📥 Add / Restock
                </button>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Adjustment Qty ({activeProduct.unit_type})</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-center text-xl font-bold text-[#EDEAE3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[#93A0A3] uppercase tracking-wider mb-2">Adjustment Reason</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-[#EDEAE3] text-xs focus:outline-none"
                >
                  <option value="reconciliation_adjustment">Audit Reconciliation</option>
                  <option value="sale">Manual Counter Sale</option>
                  <option value="internal_use">Shop Internal Use</option>
                  <option value="damage">Damaged Stock</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#38403F] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="bg-[#2A3135] hover:bg-[#38403F] text-[#EDEAE3] font-bold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-5 py-2.5 rounded-xl text-xs shadow"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
