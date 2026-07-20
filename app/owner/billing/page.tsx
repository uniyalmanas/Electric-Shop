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

export default function BillingPage() {
  const supabase = createClient();
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [owner, setOwner] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
      } catch (err) {
        console.error('Error loading billing:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBillingDetails();
  }, []);

  const handleCheckout = async (plan: 'basic' | 'pro' | 'premium', price: number) => {
    if (!shop || !owner) return;
    setSubmitting(true);

    const isTestMode = !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    if (isTestMode) {
      // Direct local simulation if Razorpay key is missing, makes testing painless!
      const confirmTest = window.confirm(`[TEST ENVIRONMENT] Simulate subscription activation for the ${plan.toUpperCase()} plan (₹${price}/mo)?`);
      if (confirmTest) {
        try {
          const res = await fetch('/api/billing/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: 'pay_test_simulated_id',
              shopId: shop.id,
              plan
            })
          });

          if (res.ok) {
            alert(`Test payment successful! Your ${plan.toUpperCase()} subscription is now active.`);
            window.location.href = '/owner';
          } else {
            alert('Simulation failed. Please try again.');
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

    // Production Razorpay Trigger
    try {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: price * 100, // in paise
        currency: 'INR',
        name: 'ElectroStock SaaS',
        description: `${plan.toUpperCase()} Monthly Subscription Plan`,
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
            alert(`Payment verified! Your ${plan.toUpperCase()} subscription is now active.`);
            window.location.href = '/owner';
          } else {
            alert('Failed to verify payment with the server. Contact support.');
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
      
      {/* Dynamic script for Razorpay Payment Gateway */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Top copper glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none" />

      <Header title="Billing & Subscriptions" />

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-8 z-10">
        
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

        {/* --- SUBSCRIPTION PLANS GRID --- */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-extrabold">Select Your Subscription Tier</h3>
            <p className="text-[#93A0A3] text-xs font-semibold">Flexible, transparent monthly plans designed for Indian electrical shops.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Basic Plan */}
            <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 flex flex-col justify-between shadow-xl relative hover:border-[#C1793D]/30 transition-all">
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-[#EDEAE3] text-base">Basic Plan</h4>
                  <p className="text-[10px] text-[#93A0A3] font-medium mt-1">Perfect for small neighborhood counters.</p>
                </div>
                <div className="flex items-baseline gap-0.5 border-b border-[#38403F]/40 pb-4">
                  <span className="text-3xl font-black text-[#EDEAE3]">₹399</span>
                  <span className="text-[10px] text-[#93A0A3] font-bold font-mono">/ MONTH</span>
                </div>
                <ul className="space-y-3 text-xs text-[#93A0A3] font-medium">
                  <li className="flex items-center gap-2">✔ 1 Billing Counter POS</li>
                  <li className="flex items-center gap-2">✔ Unlimited Stock Ingestion</li>
                  <li className="flex items-center gap-2">✔ WhatsApp & Thermal Bills</li>
                  <li className="flex items-center gap-2">✔ Contractor Udhaar Ledgers</li>
                </ul>
              </div>
              <button
                onClick={() => handleCheckout('basic', 399)}
                disabled={submitting}
                className="mt-6 w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-2.5 rounded-xl text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                SELECT BASIC
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#1E2427] border-2 border-[#C1793D] rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative hover:scale-102 transition-all">
              <div className="absolute top-[-11px] left-1/2 -translate-x-1/2 bg-[#C1793D] text-[#1a120a] text-[8px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full font-mono">
                RECOMMENDED
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-[#E0954F] text-base">Pro Plan</h4>
                  <p className="text-[10px] text-[#93A0A3] font-medium mt-1">Best for busy retail outlets.</p>
                </div>
                <div className="flex items-baseline gap-0.5 border-b border-[#38403F]/40 pb-4">
                  <span className="text-3xl font-black text-[#EDEAE3]">₹799</span>
                  <span className="text-[10px] text-[#93A0A3] font-bold font-mono">/ MONTH</span>
                </div>
                <ul className="space-y-3 text-xs text-[#EDEAE3] font-medium">
                  <li className="flex items-center gap-2">✔ 3 Billing Counter POS</li>
                  <li className="flex items-center gap-2">✔ Voice-billing in Hinglish</li>
                  <li className="flex items-center gap-2">✔ Gemini OCR Distributor Bills</li>
                  <li className="flex items-center gap-2">✔ Loss Audit Reconciliation</li>
                </ul>
              </div>
              <button
                onClick={() => handleCheckout('pro', 799)}
                disabled={submitting}
                className="mt-6 w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold py-2.5 rounded-xl text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                SUBSCRIBE PRO
              </button>
            </div>

            {/* Premium Plan */}
            <div className="bg-[#1E2427] border border-[#38403F]/60 rounded-3xl p-6 flex flex-col justify-between shadow-xl relative hover:border-[#C1793D]/30 transition-all">
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-[#EDEAE3] text-base">Premium Plan</h4>
                  <p className="text-[10px] text-[#93A0A3] font-medium mt-1">Designed for wholesale distributors.</p>
                </div>
                <div className="flex items-baseline gap-0.5 border-b border-[#38403F]/40 pb-4">
                  <span className="text-3xl font-black text-[#EDEAE3]">₹1299</span>
                  <span className="text-[10px] text-[#93A0A3] font-bold font-mono">/ MONTH</span>
                </div>
                <ul className="space-y-3 text-xs text-[#93A0A3] font-medium">
                  <li className="flex items-center gap-2">✔ Unlimited Billing POS</li>
                  <li className="flex items-center gap-2">✔ Multi-Location Godown transfers</li>
                  <li className="flex items-center gap-2">✔ CA-ready GST Exports</li>
                  <li className="flex items-center gap-2">✔ Priority 24/7 Phone Support</li>
                </ul>
              </div>
              <button
                onClick={() => handleCheckout('premium', 1299)}
                disabled={submitting}
                className="mt-6 w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-bold py-2.5 rounded-xl text-xs font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                SELECT PREMIUM
              </button>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
