'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface StockItem {
  id: string;
  name: string;
  brand: string | null;
  rating: string | null;
  unit_type: string;
  current_stock: number;
  selling_price: number;
  category?: string;
  barcode?: string | null;
}

interface CartItem {
  product: StockItem;
  quantity: number;
  price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  type: 'walk_in' | 'contractor';
}

export default function StaffDashboard() {
  const supabase = createClient();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shopId, setShopId] = useState<string>('');
  
  // Dashboard Mode: 'adjust' vs 'billing'
  const [mode, setMode] = useState<'adjust' | 'billing'>('billing');
  
  // Search and Filtering
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // --- ADJUST MODE STATES ---
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('out');
  const [adjustReason, setAdjustReason] = useState('sale');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // --- BILLING MODE STATES ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); // null = walk-in
  const [paymentType, setPaymentType] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [lastSaleId, setLastSaleId] = useState('');
  const [lastSaleDetails, setLastSaleDetails] = useState<any>(null);

  // --- CALCULATOR HELPER STATES ---
  const [showCalc, setShowCalc] = useState(false);
  const [calcQty, setCalcQty] = useState('');
  const [calcRate, setCalcRate] = useState('');
  const [calcProduct, setCalcProduct] = useState<StockItem | null>(null);
  const [calcCustomName, setCalcCustomName] = useState('');

  // Add Customer Quick Modal in Billing
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState<'walk_in' | 'contractor'>('contractor');

  // --- VOICE BILLING STATES ---
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const [shopName, setShopName] = useState<string>('ElectroStock');
  const [workerId, setWorkerId] = useState<string>('');

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
          .select('id, shop_id, shops(name)')
          .eq('auth_id', user.id)
          .single();
        
        if (worker && worker.shop_id) {
          setShopId(worker.shop_id);
          setWorkerId(worker.id);
          if (worker.shops) {
            const name = (worker.shops as any).name;
            setShopName(name);
            localStorage.setItem('electrostock_shop_name', name);
          }
          fetchStock(worker.shop_id);
          fetchCustomers(worker.shop_id);
        }
      }
    }
    init();
  }, []);

  // --- ADDED POS IMPROVEMENTS ---
  const [suspendedCart, setSuspendedCart] = useState<{
    cart: CartItem[];
    customer: Customer | null;
    paymentType: 'cash' | 'upi' | 'credit';
    amountPaid: string;
  } | null>(null);

  // Global Barcode Scan Event
  useEffect(() => {
    let barcode = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 120) {
        barcode = '';
      }

      if (e.key === 'Enter') {
        if (barcode.length > 3) {
          e.preventDefault();
          const matched = stock.find((s) => s.barcode === barcode);
          if (matched) {
            addToCart(matched);
            alert(`Scanned: ${matched.name} (Qty +1)`);
          } else {
            alert(`Barcode scanned: "${barcode}", but no product matches in database.`);
          }
          barcode = '';
        }
      } else if (e.key.length === 1 && /\d/.test(e.key)) {
        barcode += e.key;
        lastKeyTime = currentTime;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [stock]);

  function updateCartPrice(itemId: string, price: number) {
    setCart(cart.map((c) => c.product.id === itemId ? { ...c, price } : c));
  }

  function holdCart() {
    if (cart.length === 0) return;
    setSuspendedCart({
      cart: [...cart],
      customer: selectedCustomer,
      paymentType,
      amountPaid,
    });
    setCart([]);
    setSelectedCustomer(null);
    setPaymentType('cash');
    setAmountPaid('');
    alert('Invoice billing suspended and put on hold.');
  }

  function retrieveCart() {
    if (!suspendedCart) return;
    setCart(suspendedCart.cart);
    setSelectedCustomer(suspendedCart.customer);
    setPaymentType(suspendedCart.paymentType);
    setAmountPaid(suspendedCart.amountPaid);
    setSuspendedCart(null);
    alert('Held invoice billing retrieved.');
  }

  function sendWhatsAppReceipt() {
    if (!lastSaleDetails) return;
    const phoneInput = prompt(
      'Enter customer phone number (10 digits):',
      lastSaleDetails.customer?.phone || ''
    );
    if (!phoneInput) return;
    
    const phone = phoneInput.replace(/\D/g, '');
    if (phone.length < 10) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }

    const itemsStr = lastSaleDetails.items
      .map((item: any) => `• ${item.product.name} x ${item.quantity} = ₹${(item.quantity * item.price).toLocaleString()}`)
      .join('\n');

    const message = `*${shopName.toUpperCase()}*
Invoice ID: ${lastSaleDetails.id.slice(0, 8).toUpperCase()}
Date: ${new Date().toLocaleDateString('en-IN')}
Customer: ${lastSaleDetails.customer?.name || 'Walk-In'}
Payment: ${lastSaleDetails.paymentType.toUpperCase()}
-------------------------
${itemsStr}
-------------------------
*Grand Total: ₹${Number(lastSaleDetails.total).toLocaleString()}*
Amount Paid: ₹${Number(lastSaleDetails.amountPaid).toLocaleString()}
${Number(lastSaleDetails.amountDue) > 0 ? `*Balance Due (Credit): ₹${Number(lastSaleDetails.amountDue).toLocaleString()}*` : 'Paid in Full'}

Thank you for purchasing with us!`;

    const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  }

  async function fetchStock(targetShopId = shopId) {
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, rating, unit_type, current_stock, selling_price, category, barcode')
      .order('name');
    setStock((data as any) || []);
  }

  async function fetchCustomers(targetShopId = shopId) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, type')
      .order('name');
    setCustomers((data as any) || []);
  }

  function handleBarcodeScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleaned = barcodeSearch.trim();
      if (!cleaned) return;

      const found = stock.find((p) => p.barcode === cleaned);
      if (found) {
        addToCart(found);
        setBarcodeSearch('');
      } else {
        alert(`No product found with barcode: "${cleaned}"`);
      }
    }
  }

  function handleAddCalcToCart() {
    const qty = Number(calcQty);
    const rate = Number(calcRate);
    if (qty <= 0 || rate <= 0) {
      alert('Please enter valid Quantity and Rate.');
      return;
    }

    if (calcProduct) {
      const existing = cart.find((c) => c.product.id === calcProduct.id && c.price === rate);
      if (existing) {
        setCart(cart.map((c) => (c.product.id === calcProduct.id && c.price === rate) ? { ...c, quantity: c.quantity + qty } : c));
      } else {
        setCart([...cart, { product: calcProduct, quantity: qty, price: rate }]);
      }
      alert(`Added ${qty} units of "${calcProduct.name}" at ₹${rate}/unit to cart.`);
    } else {
      const customName = calcCustomName.trim() || 'Custom Measure Item';
      const customItem: StockItem = {
        id: `custom-${Date.now()}`,
        name: customName,
        brand: 'Custom',
        rating: null,
        unit_type: 'piece',
        current_stock: 9999,
        selling_price: rate,
        category: 'other',
        barcode: null,
      };
      setCart([...cart, { product: customItem, quantity: qty, price: rate }]);
      alert(`Added custom item "${customName}" to cart.`);
    }

    // Reset fields
    setCalcQty('');
    setCalcRate('');
    setCalcCustomName('');
    setCalcProduct(null);
    setShowCalc(false);
  }

  // Start Voice Recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      recorder.start();
      setVoiceState('recording');
      setTranscriptionText('');
    } catch (err) {
      alert('Could not access microphone. Please grant permission.');
      console.error(err);
    }
  }

  // Stop Voice Recording
  function stopRecording() {
    if (mediaRecorder && voiceState === 'recording') {
      mediaRecorder.stop();
      setVoiceState('processing');
    }
  }

  // Process Recorded Audio
  async function processAudio(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');

      const res = await fetch('/api/voice-transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setVoiceState('idle');

      if (!data.success) {
        alert(data.error || 'Speech processing failed. Please try again.');
        return;
      }

      setTranscriptionText(data.transcription);
      const parsed = data.parsed;
      const prefix = data.is_mock ? '⚠️ [Mock Fallback Mode] ' : '';

      if (parsed.action === 'sale') {
        setMode('billing');
        if (parsed.customer_id) {
          const matchedCust = customers.find((c) => c.id === parsed.customer_id);
          if (matchedCust) setSelectedCustomer(matchedCust);
        } else {
          setSelectedCustomer(null);
        }

        if (parsed.payment_type) setPaymentType(parsed.payment_type);

        if (parsed.items && parsed.items.length > 0) {
          const newCartItems: CartItem[] = [];
          for (const voiceItem of parsed.items) {
            const product = stock.find((s) => s.id === voiceItem.product_id);
            if (product) {
              newCartItems.push({
                product,
                quantity: voiceItem.quantity,
                price: product.selling_price,
              });
            }
          }
          if (newCartItems.length > 0) {
            setCart(newCartItems);
            alert(`${prefix}Voice parsed: "${data.transcription}"\nItems pre-filled in cart!`);
          } else {
            alert(`${prefix}Voice parsed: "${data.transcription}"\nNo matching products found.`);
          }
        }
      } else if (parsed.action === 'adjust_in' || parsed.action === 'adjust_out') {
        setMode('adjust');
        setAdjustDirection(parsed.action === 'adjust_in' ? 'in' : 'out');
        setAdjustReason(parsed.action === 'adjust_in' ? 'purchase' : 'sale');

        if (parsed.items && parsed.items.length > 0) {
          const firstVoiceItem = parsed.items[0];
          const product = stock.find((s) => s.id === firstVoiceItem.product_id);
          if (product) {
            setSelectedAdjustItem(product);
            setAdjustQty(String(firstVoiceItem.quantity));
            alert(`${prefix}Voice parsed: "${data.transcription}"\nAdjust stock count for: ${product.name}`);
          }
        }
      } else {
        alert(`${prefix}Voice heard: "${data.transcription}"\nTry stating e.g. "Ramesh contractor ko 5 switches do".`);
      }
    } catch (err: any) {
      setVoiceState('idle');
      alert('Error processing voice: ' + err.message);
    }
  }

  // --- ADJUST MODE STOCK SUBMIT ---
  async function submitMovement() {
    if (!selectedAdjustItem || !adjustQty) return;
    setSavingAdjust(true);

    if (!workerId) {
      alert('No active worker session found.');
      setSavingAdjust(false);
      return;
    }

    const res = await fetch('/api/stock-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: selectedAdjustItem.id,
        worker_id: workerId,
        quantity: Number(adjustQty),
        direction: adjustDirection,
        reason: adjustReason,
        entry_method: 'manual',
      }),
    });

    const result = await res.json();
    setSavingAdjust(false);
    if (result.error) {
      alert(result.error);
    } else {
      setSelectedAdjustItem(null);
      setAdjustQty('');
      fetchStock();
    }
  }

  // --- BILLING MODE CART ACTIONS ---
  function addToCart(item: StockItem) {
    const existing = cart.find((c) => c.product.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.product.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product: item, quantity: 1, price: item.selling_price }]);
    }
  }

  function removeFromCart(itemId: string) {
    setCart(cart.filter((c) => c.product.id !== itemId));
  }

  function updateCartQty(itemId: string, qty: number) {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(cart.map((c) => c.product.id === itemId ? { ...c, quantity: qty } : c));
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Submit Sale Invoice
  async function checkoutSale() {
    if (cart.length === 0) return;
    if (!workerId) {
      alert('No active worker session found.');
      return;
    }
    setSavingSale(true);

    const payload = {
      customer_id: selectedCustomer?.id || null,
      worker_id: workerId,
      payment_type: paymentType,
      total_amount: cartTotal,
      amount_paid: paymentType === 'credit' ? (amountPaid ? Number(amountPaid) : 0) : cartTotal,
      items: cart.map((c) => ({
        product_id: c.product.id,
        quantity: c.quantity,
        price: c.price,
      })),
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    setSavingSale(false);

    if (result.error) {
      alert('Error: ' + result.error);
    } else {
      setLastSaleDetails({
        id: result.sale_id,
        items: [...cart],
        customer: selectedCustomer,
        paymentType,
        total: cartTotal,
        amountPaid: paymentType === 'credit' ? (amountPaid ? Number(amountPaid) : 0) : cartTotal,
        amountDue: paymentType === 'credit' ? (cartTotal - (Number(amountPaid) || 0)) : 0,
      });
      setLastSaleId(result.sale_id);
      setSaleSuccess(true);
      setCart([]);
      setSelectedCustomer(null);
      setPaymentType('cash');
      setAmountPaid('');
      fetchStock();

      // Trigger background PDF generation and WhatsApp push
      fetch(`/api/sales/${result.sale_id}/pdf`, { method: 'POST' }).catch((err) => {
        console.error('Failed to trigger background PDF invoice WhatsApp push:', err);
      });
    }
  }

  // Add Customer Quick Save
  async function saveQuickCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustName || !shopId) return;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        shop_id: shopId,
        name: newCustName,
        phone: newCustPhone || null,
        type: newCustType,
        credit_limit: newCustType === 'contractor' ? 15000 : 0,
      })
      .select()
      .single();

    if (error) {
      alert('Failed: ' + error.message);
    } else {
      await fetchCustomers();
      setSelectedCustomer(data as any);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
    }
  }

  // Filters
  const filteredStock = stock.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.brand && s.brand.toLowerCase().includes(search.toLowerCase())) ||
      (s.rating && s.rating.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'wire', 'switch', 'mcb', 'appliance', 'fitting', 'cable', 'conduit', 'other'];

  // --- BILLING SUCCESS VIEW ---
  if (saleSuccess) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-6 transition-colors duration-150">
        
        {/* Print-specific style tag override */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
            #print-area {
              display: block !important;
              width: 80mm !important;
              margin: 0 auto !important;
              padding: 5px !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 11px !important;
              color: black !important;
            }
          }
        `}} />

        {/* Regular Interactive UI Screen */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-xl no-print">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500 rounded-full flex items-center justify-center text-3xl text-emerald-600 dark:text-emerald-450 mx-auto animate-bounce">
            ✓
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Invoice Generated!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Invoice ID: {lastSaleId}</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-2">Dues and stock counts updated successfully.</p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <button
              onClick={() => window.print()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            >
              🖨️ Print Thermal Receipt (80mm)
            </button>
            <button
              onClick={sendWhatsAppReceipt}
              className="w-full bg-[#25D366] hover:bg-[#20BA56] text-white font-bold py-3.5 rounded-2xl shadow active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            >
              💬 Send WhatsApp Receipt
            </button>
            <button
              onClick={() => setSaleSuccess(false)}
              className="w-full bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold py-3.5 rounded-2xl shadow active:scale-95 transition-all text-sm"
            >
              📝 Create New Bill
            </button>
            <a
              href="/"
              className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3.5 rounded-2xl block text-center text-sm"
            >
              🏠 Portal Home
            </a>
          </div>
        </div>

        {/* --- HIDDEN THERMAL RECEIPT LAYOUT FOR PRINTING --- */}
        {lastSaleDetails && (
          <div id="print-area" className="hidden text-black bg-white p-2">
            <div className="text-center space-y-1">
              <h1 className="text-sm font-black tracking-wider uppercase">{shopName}</h1>
              <p className="text-[10px]">Electrical Equipment, MCBs & Wires</p>
              <p className="text-[9px]">Main Bazar, New Delhi · Ph: 9876543210</p>
              <p className="border-b border-dashed border-black py-0.5" />
            </div>

            <div className="text-[9px] py-2 space-y-0.5">
              <p><strong>Invoice ID:</strong> {lastSaleDetails.id.slice(0, 8).toUpperCase()}...</p>
              <p><strong>Date:</strong> {new Date().toLocaleString('en-IN')}</p>
              <p><strong>Customer:</strong> {lastSaleDetails.customer?.name || 'Walk-In Customer'}</p>
              <p><strong>Payment:</strong> {lastSaleDetails.paymentType.toUpperCase()}</p>
              <p className="border-b border-dashed border-black py-0.5" />
            </div>

            <table className="w-full text-left text-[9px] border-collapse">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="pb-1">Item Description</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Rate</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lastSaleDetails.items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-dotted border-slate-350">
                    <td className="py-1 pr-1 truncate max-w-[120px]">{item.product.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">₹{item.price.toFixed(1)}</td>
                    <td className="py-1 text-right">₹{(item.quantity * item.price).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-[9px] pt-3 space-y-1">
              <p className="border-b border-dashed border-black" />
              <div className="flex justify-between font-black text-sm">
                <span>Grand Total:</span>
                <span>₹{Number(lastSaleDetails.total).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>₹{Number(lastSaleDetails.amountPaid).toLocaleString()}</span>
              </div>
              {Number(lastSaleDetails.amountDue) > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance Due (Credit):</span>
                  <span>₹{Number(lastSaleDetails.amountDue).toLocaleString()}</span>
                </div>
              )}
              <p className="border-b border-dashed border-black pt-1" />
            </div>

            <div className="text-center pt-4 text-[8px] space-y-0.5 italic">
              <p>Thank you for purchasing with us!</p>
              <p>Please check item warranty details at counter.</p>
              <p className="font-bold">Powered by ElectraShield</p>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEAE3] dark:bg-[#14181B] text-[#14181B] dark:text-[#EDEAE3] flex flex-col transition-colors duration-150 font-sans">
      <Header title="Billing & Stock Entry" backUrl="/" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-6">
        
        {/* Voice recording Panel and Mode Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Mode Switcher */}
          <div className="bg-[#F4F1EA] dark:bg-[#1E2427] p-1 rounded-xl flex gap-1 border border-slate-300/60 dark:border-[#38403F] shadow-sm w-full md:max-w-xs">
            <button
              onClick={() => setMode('billing')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'billing' 
                  ? 'bg-[#C1793D] text-[#1a120a] shadow-sm' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              📝 Invoice Billing
            </button>
            <button
              onClick={() => setMode('adjust')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'adjust' 
                  ? 'bg-[#C1793D] text-[#1a120a] shadow-sm' 
                  : 'text-[#93A0A3] hover:text-[#EDEAE3]'
              }`}
            >
              ⚡ Quick Adjust
            </button>
          </div>

          {/* Voice Assistant Panel */}
          <div className="flex-1 w-full md:max-w-xl">
            {voiceState === 'idle' ? (
              <button
                onClick={startRecording}
                className="w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 shadow transition-all active:scale-[0.99]"
              >
                🎤 Speak Billing Command (Hindi/Hinglish)
              </button>
            ) : voiceState === 'recording' ? (
              <button
                onClick={stopRecording}
                className="w-full bg-rose-600 animate-pulse text-white rounded-2xl py-3 text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                🔴 Recording... Tap to parse order
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl py-3 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
              >
                ⚡ Processing voice command via Speech-to-Text & Gemini...
              </button>
            )}

            {transcriptionText && (
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl flex items-center gap-1.5">
                <span className="font-bold text-amazon-teal dark:text-cyan-400">Heard:</span>
                <span className="italic">"{transcriptionText}"</span>
              </div>
            )}
          </div>
        </div>

        {/* --- ADJUST MODE SCREEN --- */}
        {mode === 'adjust' && (
          <div className="space-y-4 max-w-lg mx-auto">
            {selectedAdjustItem ? (
              <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-350/50 dark:border-[#38403F] rounded-3xl p-6 space-y-6 shadow-sm">
                <button
                  onClick={() => setSelectedAdjustItem(null)}
                  className="text-xs text-[#C1793D] font-bold flex items-center gap-1 hover:underline"
                >
                  ← Back to stock catalog
                </button>
                <div>
                  <h3 className="text-lg font-bold text-[#14181B] dark:text-[#EDEAE3]">{selectedAdjustItem.name}</h3>
                  <p className="text-slate-500 dark:text-[#93A0A3] text-xs mt-0.5">
                    Stock: {selectedAdjustItem.current_stock} {selectedAdjustItem.unit_type} · Price: ₹{selectedAdjustItem.selling_price}/unit
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustDirection('out')}
                    className={`flex-1 py-3 rounded-xl font-bold border transition-all text-sm ${
                      adjustDirection === 'out' ? 'bg-[#D9584C]/15 border-[#D9584C] text-[#D9584C]' : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3]'
                    }`}
                  >
                    📤 Remove Stock
                  </button>
                  <button
                    onClick={() => setAdjustDirection('in')}
                    className={`flex-1 py-3 rounded-xl font-bold border transition-all text-sm ${
                      adjustDirection === 'in' ? 'bg-[#4FAE7A]/15 border-[#4FAE7A] text-[#4FAE7A]' : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3]'
                    }`}
                  >
                    📥 Add Stock
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Adjustment Qty ({selectedAdjustItem.unit_type})</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Adjustment Reason</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                  >
                    <option value="sale">Sale</option>
                    <option value="internal_use">Used in shop</option>
                    <option value="damage">Damaged</option>
                    <option value="return">Customer Return</option>
                  </select>
                </div>

                <button
                  onClick={submitMovement}
                  disabled={savingAdjust || !adjustQty}
                  className="w-full bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold py-4 rounded-2xl disabled:opacity-50 transition-colors shadow"
                >
                  {savingAdjust ? 'Saving...' : 'Confirm Stock Change'}
                </button>
              </div>
            ) : (
              /* Search stock adjustment list */
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search stock item to adjust..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                />

                <div className="space-y-2">
                  {filteredStock.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAdjustItem(item)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex justify-between items-center shadow-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.brand} {item.rating && `· ${item.rating}`}
                        </p>
                      </div>
                      <p className="text-base font-extrabold text-amazon-teal dark:text-cyan-400">
                        {item.current_stock} {item.unit_type}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- INVOICE BILLING MODE SCREEN --- */}
        {mode === 'billing' && (
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Steps & Product Picker */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1: Select Customer Account */}
              <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider font-mono">Step 1: Select Customer Account</h3>
                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-xs text-[#C1793D] hover:underline font-bold"
                  >
                    ➕ Register Customer
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setSelectedCustomer(null); setPaymentType('cash'); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedCustomer === null
                        ? 'bg-[#C1793D] text-[#1a120a] border-[#C1793D]'
                        : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3] hover:border-[#C1793D]'
                    }`}
                  >
                    👤 Walk-in Client
                  </button>

                  {customers
                    .filter((c) => c.type === 'contractor')
                    .slice(0, 4)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          selectedCustomer?.id === c.id
                            ? 'bg-[#C1793D] text-[#1a120a] border-[#C1793D]'
                            : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3] hover:border-[#C1793D]'
                        }`}
                      >
                        🏗️ {c.name}
                      </button>
                    ))}
                </div>

                {selectedCustomer && (
                  <div className="bg-slate-200/50 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] p-2.5 rounded-xl flex justify-between items-center text-[10px] text-[#707C7F] dark:text-[#93A0A3] font-mono">
                    <span>Active Account: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})</span>
                    <button onClick={() => setSelectedCustomer(null)} className="text-[#D9584C] font-bold hover:underline">Remove</button>
                  </div>
                )}
              </div>

              {/* Step 2: Add products */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider font-mono">Step 2: Add Products to Bill</h3>
                  <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="text-xs text-[#C1793D] font-bold flex items-center gap-1 hover:underline"
                  >
                    🖩 {showCalc ? 'Close Estimator' : 'Loose Measure Estimator'}
                  </button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Type product name to search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] focus:border-[#C1793D] rounded-xl px-4 py-3 text-[#14181B] dark:text-[#EDEAE3] placeholder-slate-400 focus:outline-none text-sm font-medium"
                    />
                  </div>
                  <div className="md:w-[200px]">
                    <input
                      type="text"
                      placeholder="🔍 Scan Barcode..."
                      value={barcodeSearch}
                      onChange={(e) => setBarcodeSearch(e.target.value)}
                      onKeyDown={handleBarcodeScan}
                      className="w-full bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] focus:border-[#C1793D] rounded-xl px-4 py-3 text-[#14181B] dark:text-[#EDEAE3] placeholder-slate-400 focus:outline-none font-bold text-center focus:ring-0 text-sm"
                    />
                  </div>
                </div>

                {/* Collapsible Calculator Helper Widget */}
                {showCalc && (
                  <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🖩 Price Estimator & Calculator</span>
                      <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">
                        Total: ₹{((Number(calcQty) || 0) * (Number(calcRate) || 0)).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      {/* Product Selector */}
                      <div className="md:col-span-5">
                        <label className="block text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-1">Target Product</label>
                        <select
                          value={calcProduct ? calcProduct.id : ''}
                          onChange={(e) => {
                            const prod = stock.find((s) => s.id === e.target.value);
                            setCalcProduct(prod || null);
                            if (prod) {
                              setCalcRate(String(prod.selling_price));
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                        >
                          <option value="">-- Custom Generic Item --</option>
                          {stock.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} (₹{s.selling_price})</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Item name input (visible if product is null) */}
                      {!calcProduct ? (
                        <div className="md:col-span-3">
                          <label className="block text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-1">Custom Item Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Cut Wires 20m"
                            value={calcCustomName}
                            onChange={(e) => setCalcCustomName(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="md:col-span-3">
                          <label className="block text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-1">Brand</label>
                          <input
                            type="text"
                            disabled
                            value={calcProduct.brand || 'Generic'}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/40 rounded-lg p-2 text-xs text-slate-400 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Quantity */}
                      <div className="md:col-span-2">
                        <label className="block text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-1">Qty/Length</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={calcQty}
                          onChange={(e) => setCalcQty(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 text-center font-bold focus:outline-none"
                        />
                      </div>

                      {/* Rate */}
                      <div className="md:col-span-2">
                        <label className="block text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-1">Rate (₹)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={calcRate}
                          onChange={(e) => setCalcRate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 text-center font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setCalcQty('');
                          setCalcRate('');
                          setCalcCustomName('');
                          setCalcProduct(null);
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:underline px-3"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCalcToCart}
                        className="bg-cyan-500 hover:bg-cyan-600 border border-cyan-500 text-white font-bold text-[10px] py-2 px-4 rounded-lg transition-all shadow-sm"
                      >
                        ➕ Add Calculated Total to Cart
                      </button>
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-350/50 dark:border-[#38403F]/60">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`pill px-3.5 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                        selectedCategory === cat
                          ? 'bg-[#C1793D] text-[#1a120a] border-[#C1793D] font-bold'
                          : 'bg-slate-200/50 dark:bg-[#1E2427] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3] hover:border-[#C1793D]'
                      }`}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Grid */}
                <div className="grid sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredStock.slice(0, 40).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="p-3 bg-[#F4F1EA] dark:bg-[#1E2427] hover:bg-[#EDEAE3] dark:hover:bg-[#2A3135] border border-slate-300/60 dark:border-[#38403F] hover:border-[#C1793D] dark:hover:border-[#C1793D] rounded-xl text-left transition-all duration-100 flex justify-between items-center group"
                    >
                      <div>
                        <p className="font-bold text-[#14181B] dark:text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors text-xs">{item.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-[#93A0A3] mt-0.5">{item.brand || 'Generic'} · ₹{item.selling_price}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#4FAE7A] bg-[#4FAE7A]/10 border border-[#4FAE7A]/25 px-2 py-0.5 rounded">
                        +{item.current_stock}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Checkout Panel */}
            <div className="bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] rounded-3xl p-5 space-y-6 h-fit shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-350/60 dark:border-[#38403F]/60 pb-3">
                <h3 className="font-bold text-sm text-[#14181B] dark:text-[#EDEAE3] font-mono uppercase tracking-wider">Checkout Cart</h3>
                <div className="flex gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={holdCart}
                      className="text-xs text-amber-600 dark:text-amber-500 font-bold hover:underline"
                    >
                      Hold
                    </button>
                  )}
                  {suspendedCart && (
                    <button
                      onClick={retrieveCart}
                      className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                    >
                      Retrieve ({suspendedCart.cart.length})
                    </button>
                  )}
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-[#D9584C] font-bold hover:underline"
                    disabled={cart.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Items */}
              {cart.length === 0 ? (
                <div className="text-center py-12 text-[#93A0A3] text-xs font-mono">
                  Invoice cart is empty. Click items to add.
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="bg-slate-200/50 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] p-3 rounded-xl space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-[#14181B] dark:text-[#EDEAE3] text-xs">{item.product.name}</p>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-[#D9584C] text-[10px] font-bold hover:underline">×</button>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 bg-slate-300 dark:bg-[#2A3135] rounded flex items-center justify-center font-black"
                          >
                            -
                          </button>
                          <span className="font-black text-[#14181B] dark:text-[#EDEAE3]">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                            className="w-6 h-6 bg-slate-300 dark:bg-[#2A3135] rounded flex items-center justify-center font-black"
                          >
                            +
                          </button>
                        </div>

                        {/* Inline custom unit price input */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">@ ₹</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateCartPrice(item.product.id, Number(e.target.value) || 0)}
                            className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1 py-0.5 text-center text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#C1793D]"
                          />
                        </div>

                        <p className="font-extrabold text-[#14181B] dark:text-[#EDEAE3]">₹{(item.quantity * item.price).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cart Total */}
              <div className="bg-slate-200/50 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] p-4 rounded-2xl flex justify-between items-center shadow-xs">
                <span className="text-[#707C7F] dark:text-[#93A0A3] text-[10px] font-bold uppercase tracking-wider font-mono">Total Amount</span>
                <span className="text-2xl font-bold text-[#E0954F] font-mono">₹{cartTotal.toLocaleString()}</span>
              </div>

              {/* Payment details */}
              {cart.length > 0 && (
                <div className="space-y-4 border-t border-slate-350/60 dark:border-[#38403F]/60 pt-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-[#707C7F] dark:text-[#93A0A3] uppercase tracking-wider font-mono">Payment Method</label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => setPaymentType('cash')}
                        className={`py-2.5 text-[10px] font-bold rounded-lg border transition-all ${
                          paymentType === 'cash' ? 'bg-[#4FAE7A]/15 border-[#4FAE7A] text-[#4FAE7A]' : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3]'
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        onClick={() => setPaymentType('upi')}
                        className={`py-2.5 text-[10px] font-bold rounded-lg border transition-all ${
                          paymentType === 'upi' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 dark:text-cyan-400' : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3]'
                        }`}
                      >
                        UPI
                      </button>
                      <button
                        disabled={!selectedCustomer}
                        onClick={() => setPaymentType('credit')}
                        className={`py-2.5 text-[10px] font-bold rounded-lg border transition-all disabled:opacity-30 ${
                          paymentType === 'credit' ? 'bg-[#F0AD3E]/15 border-[#F0AD3E] text-[#F0AD3E]' : 'bg-slate-200/50 dark:bg-[#14181B] border-slate-300/60 dark:border-[#38403F] text-[#707C7F] dark:text-[#93A0A3]'
                        }`}
                        title={!selectedCustomer ? 'Requires selecting a contractor first' : ''}
                      >
                        Credit
                      </button>
                    </div>
                  </div>

                  {paymentType === 'credit' && (
                    <div className="animate-in slide-in-from-top-2 duration-150">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Amount Paid Today (₹)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full bg-slate-200/50 dark:bg-[#14181B] border border-slate-300/60 dark:border-[#38403F] focus:border-[#C1793D] rounded-xl px-3 py-2 text-[#14181B] dark:text-[#EDEAE3] text-xs focus:outline-none"
                      />
                      <p className="text-[9px] text-slate-500 mt-1 font-mono">
                        Outstanding Dues: ₹{(cartTotal - (Number(amountPaid) || 0)).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={checkoutSale}
                    disabled={savingSale}
                    className="w-full bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-bold py-4 rounded-2xl disabled:opacity-50 transition-colors shadow text-xs active:scale-95"
                  >
                    {savingSale ? 'Generating Invoice...' : 'Generate Invoice'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- REGISTER CUSTOMER QUICK MODAL --- */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
              <div className="bg-slate-100 dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold">Register Customer / Contractor</h2>
                <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
              </div>

              <form onSubmit={saveQuickCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                    placeholder="e.g. Ramesh Kumar (Electrician)"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone Number (For WhatsApp)</label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer Type</label>
                  <select
                    value={newCustType}
                    onChange={(e) => setNewCustType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none text-xs"
                  >
                    <option value="contractor">Contractor (Running Credit Account)</option>
                    <option value="walk_in">Walk-in Customer (One-Time Sale)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(false)}
                    className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs"
                  >
                    Add Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
