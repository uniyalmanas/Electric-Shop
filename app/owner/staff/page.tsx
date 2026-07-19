'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import { translations } from '@/lib/translations';

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: 'owner' | 'staff';
  active: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  quantity: number;
  direction: 'in' | 'out';
  reason: string;
  created_at: string;
  products: { name: string } | null;
  workers: { name: string } | null;
}

export default function StaffManagementPage() {
  const supabase = createClient();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'hinglish'>('en');

  // Add Worker Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerRole, setWorkerRole] = useState<'owner' | 'staff'>('staff');
  const [workerPassword, setWorkerPassword] = useState('');
  const [submittingWorker, setSubmittingWorker] = useState(false);

  useEffect(() => {
    const cachedLang = localStorage.getItem('electrostock_language') as 'en' | 'hinglish';
    if (cachedLang) setLang(cachedLang);

    const handleLangChange = () => {
      const nextLang = localStorage.getItem('electrostock_language') as 'en' | 'hinglish';
      if (nextLang) setLang(nextLang);
    };

    window.addEventListener('languageChange', handleLangChange);

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
          fetchData(worker.shop_id);
        }
      } else {
        setLoading(false);
      }
    }
    init();

    return () => {
      window.removeEventListener('languageChange', handleLangChange);
    };
  }, []);

  async function fetchData(targetShopId = shopId) {
    setLoading(true);
    const [{ data: wRes }, { data: aRes }] = await Promise.all([
      supabase.from('workers').select('*').eq('shop_id', targetShopId).order('name'),
      supabase
        .from('stock_movements')
        .select(`
          id,
          quantity,
          direction,
          reason,
          created_at,
          products (name),
          workers (name)
        `)
        .eq('shop_id', targetShopId)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    setWorkers((wRes as any) || []);
    setAuditLogs((aRes as any) || []);
    setLoading(false);
  }

  // Handle Add Worker
  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!workerName || !workerPhone || !workerPassword || !shopId) {
      alert('Please fill out all fields.');
      return;
    }

    setSubmittingWorker(true);
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workerName,
          phone: workerPhone,
          email: workerEmail || undefined, // Send if entered, otherwise undefined for phone-only fallback
          password: workerPassword,
          role: workerRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert('Error registering worker: ' + data.error);
      } else {
        setShowAddModal(false);
        setWorkerName('');
        setWorkerPhone('');
        setWorkerEmail('');
        setWorkerPassword('');
        setWorkerRole('staff');
        fetchData();
      }
    } catch (err: any) {
      alert('Error registering worker: ' + err.message);
    } finally {
      setSubmittingWorker(false);
    }
  }

  // Handle Toggle Active/Inactive
  async function toggleWorkerActive(worker: Worker) {
    const { error } = await supabase
      .from('workers')
      .update({ active: !worker.active })
      .eq('id', worker.id);

    if (error) {
      alert('Failed: ' + error.message);
    } else {
      fetchData();
    }
  }

  return (
    <div className="min-h-screen bg-[#14181B] text-[#EDEAE3] flex flex-col font-sans antialiased relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-to-b from-[#C1793D]/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-to-t from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      <Header title={translations[lang].registerStaff} backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6 z-10">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl p-5 shadow-lg max-w-xs w-full">
            <p className="text-[#93A0A3] text-[10px] font-bold uppercase tracking-wider">{translations[lang].activeStaff}</p>
            <p className="text-3xl font-black text-[#EDEAE3] mt-1">
              {workers.filter(w => w.active).length}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#C1793D] hover:bg-[#E0954F] border border-[#C1793D] text-[#1a120a] font-extrabold px-5 py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-mono tracking-wider whitespace-nowrap"
          >
            ➕ {translations[lang].registerStaff}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#93A0A3] font-mono">{translations[lang].loadingStaff}</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Panel: Workers List */}
            <div className="lg:col-span-1 bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 space-y-4 shadow-xl h-fit">
              <h3 className="font-bold text-xs text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F] pb-2">
                {translations[lang].registeredWorkers}
              </h3>

              <div className="space-y-3">
                {workers.map((w) => (
                  <div key={w.id} className="bg-[#14181B] border border-[#38403F] p-4 rounded-2xl flex flex-col gap-2 justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-[#EDEAE3]">{w.name}</p>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                          w.role === 'owner' ? 'bg-[#C1793D]/10 text-[#E0954F]' : 'bg-[#93A0A3]/10 text-[#93A0A3]'
                        }`}>
                          {w.role.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#93A0A3] mt-1">
                        {w.phone ? `📞 +91 ${w.phone}` : 'No phone linked'}
                      </p>
                      {w.email && (
                        <p className="text-[10px] text-[#93A0A3] mt-0.5 truncate">
                          ✉️ {w.email}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-[#38403F]/30 pt-2.5 mt-1">
                      <span className={`text-[9px] font-bold ${w.active ? 'text-emerald-450' : 'text-rose-450'}`}>
                        {w.active ? '● ' + translations[lang].activeStatus : '● ' + translations[lang].inactiveStatus}
                      </span>
                      <button
                        onClick={() => toggleWorkerActive(w)}
                        className="text-[10px] font-bold hover:underline text-[#E0954F]"
                      >
                        {w.active ? translations[lang].deactivate : translations[lang].activate}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Recent Audit Logs */}
            <div className="lg:col-span-2 bg-[#1E2427] border border-[#38403F] rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-xs text-[#93A0A3] uppercase tracking-wider border-b border-[#38403F] pb-2">
                {translations[lang].recentStockMovements}
              </h3>

              {auditLogs.length === 0 ? (
                <p className="text-[#93A0A3] text-xs py-8 text-center">{translations[lang].noStockMovements}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#14181B] text-[#93A0A3] font-bold uppercase tracking-wider border-b border-[#38403F]">
                        <th className="py-3 px-4">{translations[lang].time}</th>
                        <th className="py-3 px-4">{translations[lang].staff}</th>
                        <th className="py-3 px-4">{translations[lang].product}</th>
                        <th className="py-3 px-4 text-center">{translations[lang].qty}</th>
                        <th className="py-3 px-4 text-center">{translations[lang].direction}</th>
                        <th className="py-3 px-4">{translations[lang].reason}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#38403F]/20">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#14181B]/30 transition-colors">
                          <td className="py-3 px-4 text-[#93A0A3] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#EDEAE3]">{log.workers?.name || 'Generic'}</td>
                          <td className="py-3 px-4 text-[#EDEAE3] font-semibold">{log.products?.name || 'Deleted Product'}</td>
                          <td className="py-3 px-4 text-center font-bold text-[#EDEAE3]">{log.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] ${
                              log.direction === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-455'
                            }`}>
                              {log.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#93A0A3] capitalize font-medium">{log.reason.replace(/_/g, ' ')}</td>
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

      {/* --- REGISTER WORKER MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E2427] border border-[#38403F] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative text-[#EDEAE3] animate-scale-in">
            {/* Modal copper edge decoration */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C1793D]" />
            
            <div className="p-6 border-b border-[#38403F] flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#EDEAE3]">{translations[lang].registerStaff}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#93A0A3] hover:text-[#EDEAE3] text-2xl font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddWorker} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">{translations[lang].staffName}</label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="e.g. Anil Kumar (Sales counter)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">{translations[lang].phoneLogin}</label>
                <input
                  type="tel"
                  required
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">{translations[lang].emailOptional}</label>
                <input
                  type="email"
                  value={workerEmail}
                  onChange={(e) => setWorkerEmail(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="e.g. staff@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">{translations[lang].loginPassword}</label>
                <input
                  type="text"
                  required
                  value={workerPassword}
                  onChange={(e) => setWorkerPassword(e.target.value)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-sm text-[#EDEAE3] placeholder-slate-650 focus:outline-none focus:border-[#C1793D] transition-colors"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#93A0A3] uppercase tracking-wider mb-1">{translations[lang].shopRole}</label>
                <select
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value as any)}
                  className="w-full bg-[#14181B] border border-[#38403F] rounded-xl px-4 py-3 text-xs text-[#EDEAE3] focus:outline-none focus:border-[#C1793D] transition-colors"
                >
                  <option value="staff" className="bg-[#1E2427]">{translations[lang].staffRoleOpt}</option>
                  <option value="owner" className="bg-[#1E2427]">{translations[lang].ownerRoleOpt}</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#38403F] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-transparent hover:bg-[#38403F]/20 text-[#EDEAE3] border border-[#38403F] font-bold px-4 py-2.5 rounded-xl text-xs uppercase font-mono tracking-wider transition-colors"
                >
                  {translations[lang].cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  className="bg-[#C1793D] hover:bg-[#E0954F] text-[#1a120a] font-bold px-5 py-2.5 rounded-xl text-xs uppercase font-mono tracking-wider transition-colors disabled:opacity-50"
                >
                  {submittingWorker ? 'Registering...' : translations[lang].registerBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
