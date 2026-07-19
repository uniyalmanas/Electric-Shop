'use client';

import React from 'react';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#EDEAE3] dark:bg-[#14181B] text-[#14181B] dark:text-[#EDEAE3] flex flex-col transition-colors duration-200 grid-bg relative overflow-hidden font-sans">
      
      {/* Top radial copper glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-gradient-to-b from-[#C1793D]/10 to-transparent blur-3xl pointer-events-none z-0" />

      <Header title="Management Portal" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">
        
        <div className="w-full max-w-4xl text-center space-y-12 py-16 animate-slide-up">
          {/* Main Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#C1793D]/10 border border-[#C1793D]/30 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-[#E0954F] mx-auto shadow-sm font-mono">
            ⚡ ElectroStock System v2.0
          </div>

          {/* Title and Intro */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#14181B] dark:text-[#EDEAE3] leading-none">
              High-Precision <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#C1793D] via-[#E0954F] to-[#F0AD3E]">
                Electrical Inventory & POS.
              </span>
            </h1>
            <p className="text-sm md:text-base text-slate-650 dark:text-[#93A0A3] max-w-2xl mx-auto font-medium leading-relaxed">
              Log transactions, calculate dynamic WAC pricing, track contractor credits, verify monthly operating statements, and scan shelf invoices using Gemini AI.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid md:grid-cols-2 gap-6 mt-12 text-left">
            
            {/* Owner Card */}
            <a
              href="/owner"
              className="group relative rounded-2xl bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] p-8 shadow-sm hover:border-[#C1793D] dark:hover:border-[#C1793D] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Highlight card gradient */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#C1793D]/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#C1793D]/10 border border-[#C1793D]/30 flex items-center justify-center text-xl text-[#E0954F] group-hover:scale-110 transition-transform">
                  📊
                </div>
                <h3 className="text-xl font-bold text-[#14181B] dark:text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">
                  Owner Dashboard
                </h3>
                <p className="text-[#707C7F] dark:text-[#93A0A3] text-xs leading-relaxed font-medium">
                  Review shop revenue margins, dynamic WAC costs, logged supplier invoice items, contractor ledger dues, active worker records, and generate GSTR spreadsheet exports.
                </p>
                <div className="flex items-center gap-1.5 text-[#C1793D] dark:text-[#E0954F] text-xs font-bold pt-4 font-mono">
                  ENTER DASHBOARD <span className="group-hover:translate-x-1.5 transition-transform duration-150">→</span>
                </div>
              </div>
            </a>

            {/* Staff Card */}
            <a
              href="/staff"
              className="group relative rounded-2xl bg-[#F4F1EA] dark:bg-[#1E2427] border border-slate-300/60 dark:border-[#38403F] p-8 shadow-sm hover:border-[#C1793D] dark:hover:border-[#C1793D] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Highlight card gradient */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#C1793D]/5 to-transparent rounded-bl-full pointer-events-none" />

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#C1793D]/10 border border-[#C1793D]/30 flex items-center justify-center text-xl text-[#E0954F] group-hover:scale-110 transition-transform">
                  ⚡
                </div>
                <h3 className="text-xl font-bold text-[#14181B] dark:text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">
                  Staff Billing Counter
                </h3>
                <p className="text-[#707C7F] dark:text-[#93A0A3] text-xs leading-relaxed font-medium">
                  Checkout customer invoices, scan item barcodes, process Cash/UPI/Credit payments, run natural Hinglish voice statements, and print thermal receipt paper drafts.
                </p>
                <div className="flex items-center gap-1.5 text-[#C1793D] dark:text-[#E0954F] text-xs font-bold pt-4 font-mono">
                  ENTER COUNTER <span className="group-hover:translate-x-1.5 transition-transform duration-150">→</span>
                </div>
              </div>
            </a>
          </div>

          {/* SaaS CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
            <a
              href="/signup"
              className="bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-extrabold px-6 py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
            >
              🚀 REGISTER NEW SHOP (1-WEEK FREE TRIAL)
            </a>
            <a
              href="/login"
              className="bg-[#1E2427]/80 hover:bg-[#1E2427] border border-[#38403F] text-[#EDEAE3] font-extrabold px-6 py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
            >
              🔑 PORTAL SIGN IN
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
