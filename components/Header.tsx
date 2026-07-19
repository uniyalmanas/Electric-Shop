'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function Header({ title, backUrl }: { title: string; backUrl?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [shopName, setShopName] = useState<string>('ElectroStock');
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null);
  const [lang, setLang] = useState<'en' | 'hinglish'>('en');
  const supabase = createClient();

  useEffect(() => {
    // Sync state with HTML class
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }

    // Synchronously check localStorage on the client to avoid flash
    const cached = localStorage.getItem('electrostock_shop_name');
    if (cached) {
      setShopName(cached);
    }

    const cachedLang = localStorage.getItem('electrostock_language') as 'en' | 'hinglish';
    if (cachedLang) {
      setLang(cachedLang);
    }

    async function loadShop() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: worker } = await supabase
            .from('workers')
            .select('name, role, shop_id, shops(name)')
            .eq('auth_id', user.id)
            .single();
          
          if (worker) {
            setUserProfile({ name: worker.name, role: worker.role });
            if (worker.shops) {
              const name = (worker.shops as any).name;
              setShopName(name);
              localStorage.setItem('electrostock_shop_name', name);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching shop name in header:', err);
      }
    }
    loadShop();
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setTheme('light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setTheme('dark');
    }
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'hinglish' : 'en';
    setLang(nextLang);
    localStorage.setItem('electrostock_language', nextLang);
    window.dispatchEvent(new Event('languageChange'));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Split shopName into first word and remaining words for logo styling
  const words = shopName.split(' ');
  const firstWord = words[0] || '';
  const remainingWords = words.slice(1).join(' ').toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#1E2427] border-b border-[#38403F] px-6 py-4 flex justify-between items-center text-[#EDEAE3] shadow-md transition-colors duration-150 font-sans">
      <div className="flex items-center gap-4">
        {backUrl && (
          <a href={backUrl} className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#2A3135] border border-[#38403F] hover:border-[#C1793D] text-[#93A0A3] hover:text-[#EDEAE3] transition-all text-xs font-black">
            ←
          </a>
        )}
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span className="text-[#EDEAE3] font-sans">{firstWord}</span>
            {remainingWords ? (
              <span className="text-[#1a120a] font-extrabold border border-[#C1793D] px-2 py-0.5 rounded text-[10px] bg-[#C1793D] tracking-widest font-mono">
                {remainingWords}
              </span>
            ) : (
              <span className="text-[#1a120a] font-extrabold border border-[#C1793D] px-2 py-0.5 rounded text-[10px] bg-[#C1793D] tracking-widest font-mono">
                SYSTEM
              </span>
            )}
          </h1>
          <p className="text-[9px] text-[#93A0A3] font-bold uppercase tracking-wider mt-0.5">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Profile Info Badge */}
        {userProfile && (
          <div className="flex items-center gap-3 bg-[#2A3135] border border-[#38403F] px-3.5 py-1.5 rounded-2xl shadow-inner">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-[#EDEAE3] leading-none">{userProfile.name}</p>
              <span className={`text-[8px] font-bold uppercase tracking-wider font-mono ${
                userProfile.role === 'owner' ? 'text-[#E0954F]' : 'text-[#93A0A3]'
              }`}>
                {userProfile.role}
              </span>
            </div>
            
            <div className="w-px h-5 bg-[#38403F]/50 hidden md:block" />

            <button
              onClick={handleSignOut}
              className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D9584C] hover:text-rose-400 hover:underline transition-colors focus:outline-none cursor-pointer"
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        )}

        {/* Language Selector Button */}
        <button
          onClick={toggleLanguage}
          className="px-3 h-9 rounded-xl bg-[#2A3135] border border-[#38403F] hover:border-[#C1793D] flex items-center gap-1.5 text-xs font-bold text-[#EDEAE3] transition-all active:scale-95 shadow-sm cursor-pointer"
          title="Toggle Language"
        >
          <span>🌐</span>
          <span>{lang === 'en' ? 'EN' : 'HINGLISH'}</span>
        </button>

        {/* Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl bg-[#2A3135] border border-[#38403F] hover:border-[#C1793D] flex items-center justify-center text-sm transition-all active:scale-95 shadow-sm"
          title="Toggle Light/Dark Mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
