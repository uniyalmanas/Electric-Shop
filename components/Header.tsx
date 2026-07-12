import React, { useEffect, useState } from 'react';

export default function Header({ title, backUrl }: { title: string; backUrl?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Sync state with HTML class
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
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
            <span className="text-[#EDEAE3] font-sans">Gupta</span>
            <span className="text-[#1a120a] font-extrabold border border-[#C1793D] px-2 py-0.5 rounded text-[10px] bg-[#C1793D] tracking-widest font-mono">ELECTRICALS</span>
          </h1>
          <p className="text-[9px] text-[#93A0A3] font-bold uppercase tracking-wider mt-0.5">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
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
