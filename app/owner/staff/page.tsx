'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';

interface Worker {
  id: string;
  name: string;
  phone: string | null;
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

  // Add Worker Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerRole, setWorkerRole] = useState<'owner' | 'staff'>('staff');
  const [workerPassword, setWorkerPassword] = useState('');
  const [submittingWorker, setSubmittingWorker] = useState(false);

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
          fetchData(worker.shop_id);
        }
      } else {
        setLoading(false);
      }
    }
    init();
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
    <div className="min-h-screen bg-slate-100 dark:bg-amazon-black text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header title="Manage Workers & Audits" backUrl="/owner" />

      {/* Main Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm max-w-xs w-full">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Staff Members</p>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {workers.filter(w => w.active).length}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 text-xs whitespace-nowrap"
          >
            ➕ Register Staff Member
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading staff statements...</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Panel: Workers List */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm h-fit">
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                Registered Workers
              </h3>

              <div className="space-y-3">
                {workers.map((w) => (
                  <div key={w.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col gap-2 justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{w.name}</p>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                          w.role === 'owner' ? 'bg-amazon-orange/15 text-amazon-orange' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {w.role.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {w.phone ? `📞 ${w.phone}` : 'No phone linked'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2.5 mt-1">
                      <span className={`text-[9px] font-bold ${w.active ? 'text-emerald-555 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {w.active ? '● Active' : '● Inactive'}
                      </span>
                      <button
                        onClick={() => toggleWorkerActive(w)}
                        className="text-[10px] font-bold hover:underline text-amazon-teal dark:text-cyan-400"
                      >
                        {w.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Recent Audit Logs */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                Recent Stock movements audit log (Top 25)
              </h3>

              {auditLogs.length === 0 ? (
                <p className="text-slate-400 text-xs py-8 text-center">No stock movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-100 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Staff</th>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        <th className="py-3 px-4 text-center">Direction</th>
                        <th className="py-3 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/10 dark:divide-slate-850">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{log.workers?.name || 'Generic'}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">{log.products?.name || 'Deleted Product'}</td>
                          <td className="py-3 px-4 text-center font-bold">{log.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] ${
                              log.direction === 'in' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {log.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-450 capitalize font-medium">{log.reason.replace(/_/g, ' ')}</td>
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-850 p-6 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center">
              <h2 className="text-xl font-bold">Register Staff / Worker</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={handleAddWorker} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Staff Name</label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. Anil Kumar (Sales counter)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone Number (For Login)</label>
                <input
                  type="tel"
                  required
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Login Password</label>
                <input
                  type="text"
                  required
                  value={workerPassword}
                  onChange={(e) => setWorkerPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Shop Role</label>
                <select
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none text-xs"
                >
                  <option value="staff">Staff Member (Counter access only)</option>
                  <option value="owner">Co-Owner (Full access)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  className="bg-amazon-yellow hover:bg-amazon-yellow/90 border border-amazon-yellow text-amazon-black font-bold px-5 py-2.5 rounded-xl shadow text-xs disabled:opacity-50"
                >
                  {submittingWorker ? 'Registering...' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
