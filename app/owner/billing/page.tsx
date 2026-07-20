'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import Script from 'next/script';

interface ShopDetails {
  id: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string;
  is_suspended: boolean;
}

interface LocalTransaction {
  id: string;
  amount: number;
  plan: string;
  payment_method: string;
  transaction_ref: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function BillingPage() {
  const supabase = createClient();
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [owner, setOwner] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment Logs
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [checkoutMode, setCheckoutMode] = useState<'options' | 'razorpay' | 'upi'>('options');
  const [utrNumber, setUtrNumber] = useState('');
  const [submitError, setSubmitError] = useState('');

  async function loadBillingDetails() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch owner worker profile
      const { data: worker } = await supabase
        .from('workers')
        .select('name, email, phone, shop_id, role')
        .eq('auth_id', user.id)
        .single();

      if (worker) {
        setOwner({
          name: worker.name,
          email: worker.email || '',
          phone: worker.phone || ''
        });

        // Fetch shop subscription status
        const { data: shopData } = await supabase
          .from('shops')
          .select('id, name, subscription_status, trial_ends_at, is_suspended')
          .eq('id', worker.shop_id)
          .single();

        if (shopData) {
          setShop(shopData);
        }
      }

      // Fetch transaction history
      const tRes = await fetch('/api/billing/transactions');
      const tData = await tRes.json();
      if (tRes.ok) {
        setTransactions(tData.transactions || []);
      }
    } catch (err) {
      console.error('Error loading billing:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBillingDetails();
  }, []);

  // Razorpay triggers
  const handleRazorpayCheckout = async (plan: 'premium', price: number) => {
    if (!shop || !owner) return;
    setSubmitting(true);

    const isTestMode = !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    if (isTestMode) {
      const confirmTest = window.confirm(`[TEST ENVIRONMENT] Simulate Razorpay subscription activation for the Premium plan (₹${price}/mo)?`);
      if (confirmTest) {
        try {
          const res = await fetch('/api/billing/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: 'pay_test_' + Math.random().toString(36).substring(7),
              shopId: shop.id,
              plan
            })
          });

          if (res.ok) {
            alert(`Simulated Razorpay success! Subscription activated.`);
            loadBillingDetails();
            setCheckoutMode('options');
          } else {
            alert('Simulation failed.');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSubmitting(false);
        }
      } else {
        setSubmitting(false);
      }
      return;
    }

    try {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: price * 100, // in paise
        currency: 'INR',
        name: 'ElectroStock SaaS',
        description: 'Premium Monthly Subscription Plan',
        image: 'https://electrical-shop-app.vercel.app/favicon.ico',
        handler: async function (response: any) {
          const res = await fetch('/api/billing/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: response.razorpay_payment_id,
              shopId: shop.id,
              plan
            })
          });

          if (res.ok) {
            alert(`Payment verified! Subscription is active.`);
            loadBillingDetails();
            setCheckoutMode('options');
          } else {
            alert('Failed to verify payment. Contact support.');
          }
        },
        prefill: {
          name: owner.name,
          email: owner.email,
          contact: owner.phone
        },
        theme: {
          color: '#C1793D'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert('Error initializing checkout: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit manual UPI UTR Reference ID
  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (utrNumber.trim().length < 8) {
      setSubmitError('UTR/Transaction Reference ID must be at least 8 digits long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/billing/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1, // UPI is Rs 1
          plan: 'premium',
          payment_method: 'upi',
          transaction_ref: utrNumber.trim()
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('UPI Transaction submitted successfully! Master Admin will verify it shortly.');
        setUtrNumber('');
        setCheckoutMode('options');
        loadBillingDetails();
      } else {
        setSubmitError(data.error || 'Failed to submit transaction.');
      }
    } catch (err: any) {
      setSubmitError('Network error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Print invoice receipt
  const handlePrintReceipt = (t: LocalTransaction) => {
    if (!shop || !owner) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt — ElectroStock</title>
          <style>
            body { font-family: monospace; color: #111; padding: 40px; line-height: 1.6; }
            .receipt-header { border-bottom: 2px dashed #000; padding-bottom: 20px; text-align: center; }
            .logo { font-size: 20px; font-weight: bold; }
            .info-grid { display: grid; grid-template-cols: 150px 1fr; margin-top: 30px; gap: 10px 0; }
            .label { font-weight: bold; text-transform: uppercase; color: #555; }
            .total-row { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 15px 0; margin-top: 30px; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #777; }
            .status-badge { font-weight: bold; background: #eee; padding: 2px 8px; border-radius: 4px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="logo">⚡ ELECTROSTOCK SAAS</div>
            <div>Dehradun Grid Platform Billing System</div>
            <div>Date: ${new Date(t.created_at).toLocaleString('en-IN')}</div>
          </div>
          
          <div class="info-grid">
            <div class="label">Receipt ID:</div>
            <div>${t.id}</div>
            
            <div class="label">Shop Name:</div>
            <div>${shop.name}</div>
            
            <div class="label">Owner Name:</div>
            <div>${owner.name}</div>
            
            <div class="label">Mobile:</div>
            <div>${owner.phone}</div>

            <div class="label">Plan Details:</div>
            <div>Premium All-in-One Plan</div>

            <div class="label">Gateway:</div>
            <div>${t.payment_method.toUpperCase()}</div>

            <div class="label">Ref ID / UTR:</div>
            <div>${t.transaction_ref}</div>

            <div class="label">Payment Status:</div>
            <div><span class="status-badge">${t.status.toUpperCase()}</span></div>
          </div>

          <div class="total-row" style="display: flex; justify-content: space-between;">
            <span>TOTAL AMOUNT PAID:</span>
            <span>₹${t.amount}.00</span>
          </div>

          <div class="footer">
            <p>Thank you for subscribing to the ElectroStock retail ecosystem!</p>
            <p>Generated automatically on behalf of uniyalmanas@oksbi</p>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex items-center justify-center font-mono">
        Loading Billing details...
      </div>
    );
  }

  const isTrial = shop?.subscription_status === 'trial';
  const isExpired = shop?.subscription_status === 'expired' || 
    (isTrial && new Date(shop?.trial_ends_at || '') < new Date());

  const daysRemaining = shop?.trial_ends_at 
    ? Math.max(0, Math.ceil((new Date(shop.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-hidden">
      
      {/* Script for Razorpay */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Top copper glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />

      <Header title="Billing & Subscriptions" />

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8 z-10">
        
        {/* --- STATUS HEADER CARDS --- */}
        <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1793D]" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-[10px] text-[#93A0A3] uppercase font-mono tracking-widest">Active Store Context</p>
              <h2 className="text-xl font-bold mt-1 text-[#EDEAE3]">{shop?.name}</h2>
              
              <div className="mt-2.5 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] uppercase tracking-wider ${
                  isExpired 
                    ? 'bg-rose-500/10 text-rose-455' 
                    : 'bg-emerald-500/10 text-emerald-450'
                }`}>
                  {isExpired ? 'Trial Expired / Suspended' : `Active Tier: ${shop?.subscription_status?.toUpperCase()}`}
                </span>
                
                {isTrial && !isExpired && (
                  <span className="text-[11px] text-[#93A0A3] font-medium">
                    ({daysRemaining} trial days remaining)
                  </span>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-xs text-[#93A0A3] space-y-1">
              <p>Owner: <span className="text-[#EDEAE3] font-bold">{owner?.name}</span></p>
              <p>Trial Ends: <span className="text-[#EDEAE3] font-bold">{shop?.trial_ends_at ? new Date(shop.trial_ends_at).toLocaleDateString('en-IN') : 'N/A'}</span></p>
            </div>
          </div>
        </div>

        {/* --- PAYWALL BLOCKED WARNING --- */}
        {isExpired && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 px-5 py-4 rounded-2xl flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-xs font-semibold">
              <span className="font-extrabold uppercase block tracking-wider mb-0.5">Subscription Required</span>
              Your trial period has ended. Select a billing plan below to unlock your POS counter and business records.
            </div>
          </div>
        )}

        {/* --- DUAL METHOD PAYMENT SYSTEM --- */}
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-extrabold">All-in-One Premium Subscription</h3>
            <p className="text-[#93A0A3] text-xs font-semibold">Get complete, unrestricted access to all ElectroStock features.</p>
          </div>

          <div className="bg-[#1E2427] border-2 border-[#C1793D] rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative">
            <div className="absolute top-[-11px] left-1/2 -translate-x-1/2 bg-[#C1793D] text-[#1a120a] text-[8px] font-black uppercase tracking-wider px-4 py-0.5 rounded-full font-mono">
              PREMIUM ALL-IN-ONE
            </div>

            {checkoutMode === 'options' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-[#E0954F] text-lg text-center">Complete Platform Access</h4>
                  <p className="text-[10px] text-[#93A0A3] font-medium mt-1 text-center">Unlocks all voice estimation, AI ingestion, and tax export modules.</p>
                </div>
                <div className="flex justify-center items-baseline gap-0.5 border-b border-[#38403F]/40 pb-5">
                  <span className="text-4xl font-black text-[#EDEAE3]">₹1</span>
                  <span className="text-[10px] text-[#93A0A3] font-bold font-mono">/ MONTH</span>
                </div>
                <ul className="space-y-2.5 text-xs text-[#EDEAE3] font-medium pt-1">
                  <li className="flex items-center gap-2">✔ Unlimited Billing Counter POS</li>
                  <li className="flex items-center gap-2">✔ Natural Hinglish Voice Commands</li>
                  <li className="flex items-center gap-2">✔ Gemini AI OCR Invoice Ingestion</li>
                  <li className="flex items-center gap-2">✔ Warehouse Godown Transfer Logs</li>
                  <li className="flex items-center gap-2">✔ CA-Ready GST GSTR-1/3B Exports</li>
                </ul>

                <div className="space-y-3 pt-4">
                  <button
                    onClick={() => setCheckoutMode('upi')}
                    className="w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-extrabold py-3.5 rounded-xl text-xs font-mono tracking-wider transition-colors cursor-pointer shadow-md text-center block"
                  >
                    📱 PAY VIA UPI QR SCAN (₹1)
                  </button>
                  <button
                    onClick={() => handleRazorpayCheckout('premium', 1)}
                    disabled={submitting}
                    className="w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-3 rounded-xl text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer text-center block"
                  >
                    💳 PAY VIA CARD / NETBANKING (₹1)
                  </button>
                </div>
              </div>
            )}

            {/* UPI QR SCAN PAYMENT MODE */}
            {checkoutMode === 'upi' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#38403F]/40 pb-3">
                  <h4 className="font-bold text-[#E0954F] text-sm">UPI QR Scan Verification</h4>
                  <button onClick={() => setCheckoutMode('options')} className="text-[#93A0A3] hover:text-[#EDEAE3] font-bold text-lg">×</button>
                </div>

                <div className="text-center space-y-3">
                  <p className="text-xs text-[#93A0A3]">Scan using any UPI App (GPay/PhonePe/Paytm)</p>
                  
                  {/* UPI QR Image display */}
                  <div className="bg-white p-3 rounded-2xl inline-block shadow-lg border-2 border-[#C1793D]">
                    <img src="/UPI.jpeg" alt="UPI QR Code" className="w-48 h-48 object-contain mx-auto" />
                  </div>

                  <p className="font-mono text-xs font-bold text-[#EDEAE3] select-all bg-[#14181B] py-1.5 px-3 rounded-lg border border-[#38403F] inline-block">
                    UPI ID: uniyalmanas@oksbi
                  </p>
                </div>

                <form onSubmit={handleUtrSubmit} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">
                      UPI Reference Number (UTR / Transaction ID)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="12-digit number (e.g. 3062...)"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="w-full bg-[#14181B] border border-[#38403F] rounded-lg px-3 py-2 text-xs text-[#EDEAE3] placeholder-slate-600 focus:outline-none focus:border-[#C1793D]"
                    />
                  </div>

                  {submitError && (
                    <p className="text-rose-455 text-[10px] font-semibold">{submitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#1a120a] font-extrabold py-3 rounded-xl text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'SUBMITTING UTR...' : 'SUBMIT TRANSACTION REF'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* --- TRANSACTIONS & RECEIPTS HISTORY LOG --- */}
        <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-xs font-bold text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F]/40 pb-2">
            Payment History & Receipts
          </h3>
          
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-[#93A0A3] text-xs font-mono">No subscription transactions logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase border-b border-[#38403F]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference ID / UTR</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#38403F]/20 font-mono text-[11px]">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[#14181B]/20">
                      <td className="py-3 px-3">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-3 uppercase">{t.payment_method}</td>
                      <td className="py-3 px-3 text-[#93A0A3]">{t.transaction_ref}</td>
                      <td className="py-3 px-3 font-bold">₹{t.amount}</td>
                      <td className="py-3 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          t.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          t.status === 'rejected' ? 'bg-rose-500/10 text-rose-455' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {t.status === 'approved' ? (
                          <button
                            onClick={() => handlePrintReceipt(t)}
                            className="bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold px-2 py-1 rounded text-[9px] cursor-pointer"
                          >
                            Print Receipt 🖨️
                          </button>
                        ) : (
                          <span className="text-[#93A0A3] italic text-[9px]">Verified on Approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
