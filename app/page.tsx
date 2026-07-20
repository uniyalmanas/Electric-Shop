'use client';

import React, { useEffect, useState } from 'react';

const landingTranslations = {
  en: {
    home: "Home",
    about: "About Us",
    pricing: "Pricing",
    contact: "Contact",
    login: "Sign In",
    register: "Start Free Trial",
    badge: "⚡ ElectroStock SaaS v2.0",
    heroTitle: "High-Precision Electrical Inventory & POS",
    heroDesc: "Powering modern electrical retailers and wholesalers. Track stock levels, compute WAC margins, manage contractor credits, and ingest bills with Gemini OCR.",
    ownerCardTitle: "Owner Dashboard",
    ownerCardDesc: "Analyze margins, review WAC pricing, track contractor ledgers, and compile outward GSTR spreadsheets.",
    staffCardTitle: "Staff POS Counter",
    staffCardDesc: "Check out invoices, scan barcodes, run voice Hinglish billing commands, and suspend active carts.",
    pricingTitle: "Simple, Transparent Subscriptions",
    pricingDesc: "Choose the perfect plan to streamline your electrical counter billing.",
    plans: {
      premium: {
        name: "Premium All-in-One Plan",
        price: "₹1",
        desc: "Complete, unrestricted access to all features.",
        features: [
          "Unlimited POS Billing Counters",
          "Natural Hinglish Voice Commands",
          "Gemini AI OCR Bill Ingestion",
          "Warehouse Godown Stock Transfers",
          "CA-Ready GSTR-1 & 3B Excel Sheets",
          "Contractor Udhaar Ledger Logs",
          "WhatsApp Invoice Pushes",
          "Priority 24/7 Phone Support"
        ]
      }
    },
    aboutTitle: "About ElectroStock",
    aboutDesc: "ElectroStock is a next-generation SaaS inventory and retail POS built exclusively for electrical merchants in India. We eliminate manual calculations with automated Weighted Average Costing (WAC), allow hands-free counter billing via voice commands and barcode scanners, and make supplier invoice entry instantaneous using AI bill parsing.",
    contactTitle: "Get in Touch",
    contactDesc: "Have questions? Reach out to our technical support team for onboarding assistance.",
    copyright: "© 2026 ElectroStock SaaS. All rights reserved."
  },
  hinglish: {
    home: "Home",
    about: "Hmare Baare Me",
    pricing: "Plans & Price",
    contact: "Contact Karein",
    login: "Sign In",
    register: "Free Trial Start Karein",
    badge: "⚡ ElectroStock SaaS v2.0",
    heroTitle: "Electrical Inventory aur Counter POS System",
    heroDesc: "Electrical dukandaro ke liye khas system. Stock track karein, WAC margin nikaalein, contractor credit note karein aur Gemini AI se invoices check karein.",
    ownerCardTitle: "Owner Dashboard",
    ownerCardDesc: "Dukaan ka munafa check karein, WAC rate note karein, grahak khata manage karein aur GST report banayein.",
    staffCardTitle: "Staff Billing Counter",
    staffCardDesc: "Cash counter billing karein, barcode scan karein, Hinglish aawaz me bill banayein aur carts hold karein.",
    pricingTitle: "Saste aur Simple Plans",
    pricingDesc: "Apni dukaan ke counter space ke hisab se sahi plan select karein.",
    plans: {
      premium: {
        name: "Premium All-in-One Plan",
        price: "₹1",
        desc: "Saare features ka access, koi limits nahi.",
        features: [
          "Unlimited Counter Space Billing",
          "Aawaz Se Bill Banayein (Hinglish)",
          "Gemini OCR Invoice Auto Ingestion",
          "Warehouse Godown Transfer Logs",
          "CA-Ready GSTR-1 & 3B Excel Sheets",
          "Contractor Udhaar Khata Tracker",
          "WhatsApp Receipt Push",
          "24/7 Customer Phone Support"
        ]
      }
    },
    aboutTitle: "ElectroStock kya hai?",
    aboutDesc: "ElectroStock ek modern billing aur stock management software hai jo Bharat ke electrical wholesalers aur retailers ke liye banaya gaya hai. Ye Weighted Average Costing (WAC) automatically calculate karta hai, barcode aur voice inputs se counter billing tezi se karta hai, aur AI bill parsing se naye stock ka distributor bill upload karna aasan banata hai.",
    contactTitle: "Humein Contact Karein",
    contactDesc: "Koi sawal hai? Onboarding me help ke liye hmare support team se contact karein.",
    copyright: "© 2026 ElectroStock SaaS. Saare adhikar surakshit hain."
  },
  hindi: {
    home: "मुख्य पृष्ठ",
    about: "हमारे बारे में",
    pricing: "मूल्य निर्धारण",
    contact: "संपर्क करें",
    login: "लॉग इन",
    register: "फ्री ट्रायल शुरू करें",
    badge: "⚡ इलेक्ट्रोस्टॉक सास v2.0",
    heroTitle: "हाई-प्रिसिजन इलेक्ट्रिकल इन्वेंटरी और पीओएस",
    heroDesc: "आधुनिक इलेक्ट्रिकल विक्रेताओं और थोक व्यापारियों के लिए खास। स्टॉक की जांच करें, WAC मार्जिन की गणना करें, ग्राहक खातों का प्रबंधन करें और जेमिनी एआई से चालान स्कैन करें।",
    ownerCardTitle: "मालिक डैशबोर्ड",
    ownerCardDesc: "मुनाफा मार्जिन देखें, सप्लायर बिलों का मिलान करें, ठेकेदार का खाता प्रबंधित करें और जीएसटी रिपोर्ट निकालें।",
    staffCardTitle: "कर्मचारी बिलिंग काउंटर",
    staffCardDesc: "बिल जनरेट करें, बारकोड स्कैन करें, हिंग्लिश वॉयस कमांड से एंट्री करें और बिल होल्ड पर रखें।",
    pricingTitle: "सरल और पारदर्शी प्लान",
    pricingDesc: "अपने बिलिंग काउंटर की संख्या और आवश्यकता के अनुसार सही प्लान चुनें।",
    plans: {
      premium: {
        name: "प्रीमियम ऑल-इन-वन प्लान",
        price: "₹1",
        desc: "सभी फीचर्स का असीमित एक्सेस बिना किसी सीमा के।",
        features: [
          "असीमित बिलिंग काउंटर",
          "वॉयस बिलिंग (हिंग्लिश)",
          "जेमिनी ओसीआर बिल अपलोड",
          "गोदाम स्टॉक ट्रांसफर",
          "सीए-रेडी जीएसटी एक्सेल शीट",
          "ठेकेदार बहीखाता ट्रैकिंग",
          "व्हाट्सएप चालान रसीद",
          "24/7 प्राथमिकता फोन सहायता"
        ]
      }
    },
    aboutTitle: "इलेक्ट्रोस्टॉक के बारे में",
    aboutDesc: "इलेक्ट्रोस्टॉक भारत में इलेक्ट्रिकल व्यापारियों के लिए विशेष रूप से निर्मित एक आधुनिक बिलिंग सॉफ्टवेयर है। यह भारित औसत लागत (WAC) की गणना स्वचालित करता है, बारकोड स्कैनर और वॉयस इनपुट के साथ काउंटर बिलिंग को तेज करता है, और जेमिनी एआई के उपयोग से वितरक बिलों को केवल एक फोटो से सिस्टम में अपलोड करता है।",
    contactTitle: "संपर्क में रहें",
    contactDesc: "कोई सवाल है? आसान शुरुआत और सहायता के लिए हमारी ऑनबोर्डिंग टीम से संपर्क करें।",
    copyright: "© 2026 इलेक्ट्रोस्टॉक सास। सर्वाधिकार सुरक्षित।"
  }
};

export default function Home() {
  const [lang, setLang] = useState<'en' | 'hinglish' | 'hindi'>('en');

  useEffect(() => {
    const cached = localStorage.getItem('electrostock_language') as 'en' | 'hinglish' | 'hindi';
    if (cached) setLang(cached);
  }, []);

  const toggleLanguage = () => {
    let nextLang: 'en' | 'hinglish' | 'hindi' = 'en';
    if (lang === 'en') {
      nextLang = 'hinglish';
    } else if (lang === 'hinglish') {
      nextLang = 'hindi';
    } else {
      nextLang = 'en';
    }
    setLang(nextLang);
    localStorage.setItem('electrostock_language', nextLang);
    window.dispatchEvent(new Event('languageChange'));
  };

  const t = landingTranslations[lang];

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-x-hidden selection:bg-[#C1793D]/30 selection:text-[#EDEAE3]">
      
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-gradient-to-b from-[#C1793D]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-gradient-to-t from-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* --- PROFESSIONAL FIXED HEADER --- */}
      <header className="sticky top-0 z-50 w-full bg-[#1E2427]/80 backdrop-blur-md border-b border-[#38403F]/60 px-6 py-4 flex justify-between items-center shadow-lg transition-colors duration-150">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#EDEAE3] via-[#E0954F] to-[#C1793D] font-mono">
            ELECTROSTOCK
          </span>
        </div>

        {/* Desktop Navbar Menu Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-[#93A0A3]">
          <a href="#home" className="hover:text-[#EDEAE3] transition-colors">{t.home}</a>
          <a href="#about" className="hover:text-[#EDEAE3] transition-colors">{t.about}</a>
          <a href="#pricing" className="hover:text-[#EDEAE3] transition-colors">{t.pricing}</a>
          <a href="#contact" className="hover:text-[#EDEAE3] transition-colors">{t.contact}</a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          {/* Language Selector Button */}
          <button
            onClick={toggleLanguage}
            className="px-3 h-9 rounded-xl bg-[#2A3135] border border-[#38403F] hover:border-[#C1793D] flex items-center gap-1.5 text-xs font-bold text-[#EDEAE3] transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Toggle Language"
          >
            <span>🌐</span>
            <span>{lang === 'en' ? 'EN' : lang === 'hinglish' ? 'HINGLISH' : 'हिंदी'}</span>
          </button>

          {/* Nav Buttons */}
          <a
            href="/login"
            className="text-xs font-bold uppercase tracking-wider text-[#EDEAE3] hover:text-[#E0954F] transition-colors px-3 py-2 hidden sm:inline-block"
          >
            {t.login}
          </a>
          <a
            href="/signup?mode=trial"
            className="bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider"
          >
            {t.register}
          </a>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section id="home" className="relative flex flex-col items-center justify-center py-20 px-6 z-10 text-center space-y-8 max-w-4xl mx-auto">
        {/* Version Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#C1793D]/10 border border-[#C1793D]/25 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-[#E0954F] shadow-inner font-mono">
          {t.badge}
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none text-[#EDEAE3]">
          {t.heroTitle.split(' ').slice(0, 2).join(' ')} <br className="hidden md:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#C1793D] via-[#E0954F] to-[#EDEAE3]">
            {t.heroTitle.split(' ').slice(2).join(' ')}
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-sm md:text-base text-[#93A0A3] max-w-2xl leading-relaxed font-medium">
          {t.heroDesc}
        </p>

        {/* Quick Dashboard Cards Access */}
        <div className="grid md:grid-cols-2 gap-6 w-full mt-10 text-left">
          
          {/* Owner Dashboard link */}
          <a
            href="/owner"
            className="group relative rounded-3xl bg-[#1E2427] border border-[#38403F] p-8 shadow-2xl hover:border-[#C1793D] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#C1793D]/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#C1793D]/10 border border-[#C1793D]/30 flex items-center justify-center text-xl text-[#E0954F] group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-xl font-bold text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">
                {t.ownerCardTitle}
              </h3>
              <p className="text-[#93A0A3] text-xs leading-relaxed font-medium">
                {t.ownerCardDesc}
              </p>
              <div className="flex items-center gap-1 text-[#C1793D] text-[10px] font-bold font-mono tracking-widest pt-2">
                ENTER DASHBOARD <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </a>

          {/* Staff POS link */}
          <a
            href="/staff"
            className="group relative rounded-3xl bg-[#1E2427] border border-[#38403F] p-8 shadow-2xl hover:border-[#C1793D] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#C1793D]/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#C1793D]/10 border border-[#C1793D]/30 flex items-center justify-center text-xl text-[#E0954F] group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">
                {t.staffCardTitle}
              </h3>
              <p className="text-[#93A0A3] text-xs leading-relaxed font-medium">
                {t.staffCardDesc}
              </p>
              <div className="flex items-center gap-1 text-[#C1793D] text-[10px] font-bold font-mono tracking-widest pt-2">
                ENTER COUNTER <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="border-t border-[#38403F]/50 bg-[#1E2427]/30 py-24 px-6 z-10">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{t.pricingTitle}</h2>
            <p className="text-[#93A0A3] text-xs md:text-sm font-semibold max-w-lg mx-auto">{t.pricingDesc}</p>
          </div>

          <div className="max-w-md mx-auto">
            {/* Premium All-in-One Plan */}
            <div className="bg-[#1E2427] border-2 border-[#C1793D] rounded-3xl p-8 space-y-6 shadow-2xl relative hover:-translate-y-1 transition-all">
              <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 bg-[#C1793D] text-[#1a120a] text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-full font-mono">
                ALL-IN-ONE PREMIUM
              </div>

              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold text-[#E0954F]">{t.plans.premium.name}</h3>
                <p className="text-[#93A0A3] text-xs font-semibold">{t.plans.premium.desc}</p>
              </div>

              <div className="flex justify-center items-baseline gap-1 py-4 border-b border-[#38403F]/50">
                <span className="text-4xl font-black text-[#EDEAE3]">{t.plans.premium.price}</span>
                <span className="text-xs text-[#93A0A3] font-bold font-mono">/ MONTH</span>
              </div>

              <ul className="space-y-3.5 text-xs text-[#EDEAE3] font-medium">
                {t.plans.premium.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[#C1793D]">✔</span> {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 mt-6">
                <a
                  href="/signup?mode=trial"
                  className="block text-center w-full bg-[#2A3135] hover:bg-[#38403F] border border-[#38403F] text-[#EDEAE3] font-extrabold py-3.5 rounded-xl transition-all shadow-md text-xs font-mono tracking-wider"
                >
                  🚀 START 7-DAY FREE TRIAL
                </a>
                <a
                  href="/signup?mode=pay"
                  className="block text-center w-full bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-extrabold py-3.5 rounded-xl transition-all shadow-md text-xs font-mono tracking-wider"
                >
                  💳 PAY & OWN PORTAL (₹1)
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- ABOUT US & SYSTEM CAPABILITIES (Vibrant & Colorful) --- */}
      <section id="about" className="border-t border-[#38403F]/50 py-24 px-6 z-10 max-w-6xl mx-auto space-y-16">
        
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="font-mono text-[9px] tracking-widest text-[#E0954F] uppercase bg-[#C1793D]/10 border border-[#C1793D]/25 px-3 py-1 rounded-full">
            Ecosystem Core
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            About <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#C1793D] via-[#E0954F] to-[#4FAE7A]">ElectroStock</span>
          </h2>
          <p className="text-sm md:text-base text-[#93A0A3] leading-relaxed font-medium">
            ElectroStock is a next-generation SaaS inventory and retail POS built exclusively for electrical merchants. We eliminate manual calculations with automated Weighted Average Costing (WAC), allow hands-free counter billing via voice commands and barcode scanners, and make supplier invoice entry instantaneous using AI bill parsing.
          </p>
        </div>

        {/* Feature Grid with Vibrant Colorful accents */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="group relative bg-gradient-to-br from-[#C1793D]/5 to-amber-500/5 border border-[#38403F] hover:border-[#C1793D]/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-[#E0954F] bg-[#C1793D]/10 border border-[#C1793D]/25 px-2 py-0.5 rounded-full font-mono">CORE WAC</span>
            <div className="w-10 h-10 rounded-xl bg-[#C1793D]/10 border border-[#C1793D]/30 flex items-center justify-center text-lg text-[#E0954F] mb-4">📦</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-[#E0954F] transition-colors">Precise SKU Inventory</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">Dynamic category separation (wires, switches, MCBs) with automatic WAC margin calculators.</p>
          </div>

          <div className="group relative bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-[#38403F] hover:border-emerald-500/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-emerald-450 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full font-mono">GEMINI NLP</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg text-emerald-400 mb-4">🎙️</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-emerald-450 transition-colors">Hinglish Voice POS</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">Check out orders hands-free in mixed Hinglish. Transcribes, resolves contractors, and loads carts instantly.</p>
          </div>

          <div className="group relative bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-[#38403F] hover:border-indigo-500/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-full font-mono">AI OCR</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-lg text-indigo-400 mb-4">🧾</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-indigo-400 transition-colors">AI Invoice Ingestion</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">Scan distributor invoices with Gemini AI. Automatically matches items, resolution rules, and logs payables.</p>
          </div>

          <div className="group relative bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-[#38403F] hover:border-blue-500/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 rounded-full font-mono">FINANCE CONTROL</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-lg text-blue-400 mb-4">💰</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-blue-400 transition-colors">Portal Finance Hub</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">A unified treasury panel logging sales inflows, supplier debts, contractor credit, and net operating profit margins.</p>
          </div>

          <div className="group relative bg-gradient-to-br from-rose-500/5 to-red-500/5 border border-[#38403F] hover:border-rose-500/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-rose-455 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-full font-mono">SECURITY LOCK</span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-lg text-rose-455 mb-4">👥</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-rose-455 transition-colors">Active Roster Locks</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">Instantly terminate staff counter access when deactivated. Purges session cookies and blocks access globally.</p>
          </div>

          <div className="group relative bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border border-[#38403F] hover:border-amber-500/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg text-left">
            <span className="absolute top-3 right-3 text-[8px] font-extrabold tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full font-mono">MANUAL UPI</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg text-amber-500 mb-4">📱</div>
            <h4 className="font-bold text-[#EDEAE3] group-hover:text-amber-500 transition-colors">UPI QR & Receipts</h4>
            <p className="text-xs text-[#93A0A3] leading-relaxed mt-1 font-medium">Scan QR to subscribe, submit transaction UTRs for master review, and download print-ready receipts.</p>
          </div>

        </div>

        {/* Detailed Architecture Panel */}
        <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden text-left">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C1793D]" />
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#EDEAE3]">System Architecture & Foundation Registry</h3>
            <p className="text-xs text-[#93A0A3]">Every built component conforms to high-precision engineering guidelines:</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 text-xs text-[#EDEAE3] leading-relaxed">
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">📄</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">schema.sql</strong>
                  <span className="text-[#93A0A3] text-[11px]">Full Postgres multi-tenant schema with row level security.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">👥</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Owner/Staff Separation</strong>
                  <span className="text-[#93A0A3] text-[11px]">Enforced via Database RLS rules and Next.js Router Middleware.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">💻</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Double-Screen POS Interface</strong>
                  <span className="text-[#93A0A3] text-[11px]">Optimized product directory grid leading to quantity checkout.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">🔄</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Stock Movements Log</strong>
                  <span className="text-[#93A0A3] text-[11px]">Historical logs for every sale, damages, and return audits.</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">🔍</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Physical Stock Reconciliation</strong>
                  <span className="text-[#93A0A3] text-[11px]">Audit and reconcile physical catalog checks with database counts.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">🔐</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Dual-Credential Login</strong>
                  <span className="text-[#93A0A3] text-[11px]">Authenticate via 10-digit phone number or registered email.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">💬</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">WhatsApp Receipt Pushes</strong>
                  <span className="text-[#93A0A3] text-[11px]">Direct receipt generation opening direct wa.me communication API.</span>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#C1793D] font-bold text-sm">🛎️</span>
                <div>
                  <strong className="block text-[#EDEAE3] font-bold">Bill Suspend (Hold/Retrieve)</strong>
                  <span className="text-[#93A0A3] text-[11px]">Freeze checkout carts temporarily to process other customers.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* --- CONTACT SECTION --- */}
      <section id="contact" className="border-t border-[#38403F]/50 bg-[#1E2427]/40 py-20 px-6 z-10 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">{t.contactTitle}</h2>
          <p className="text-[#93A0A3] text-xs md:text-sm font-semibold">{t.contactDesc}</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-8 pt-4 text-xs font-mono font-bold text-[#E0954F]">
          <div>✉️ support@electrostock.in</div>
          <div className="hidden sm:block text-[#38403F]">|</div>
          <div>📞 +91 98765 43210</div>
          <div className="hidden sm:block text-[#38403F]">|</div>
          <div>🏢 New Delhi, India</div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-[#38403F]/50 bg-[#14181B] py-8 text-center text-[10px] text-[#93A0A3] font-bold font-mono tracking-wider z-10">
        {t.copyright}
      </footer>
    </div>
  );
}
