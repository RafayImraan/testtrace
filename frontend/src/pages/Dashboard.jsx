import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

export default function Dashboard() {
  const { projectId } = useAuth();
  const [stats, setStats] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCycles = async () => {
    try { const { data } = await api.get(`/cycles?projectId=${projectId}`); setCycles(data.data || []); } catch { /* cycle filter is optional */ }
  };

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCycle) params.set('cycleId', selectedCycle); else params.set('projectId', projectId);
      const { data } = await api.get(`/dashboard/stats?${params}`);
      setStats(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCycles(); }, [projectId]);
  useEffect(() => { load(); const s = getSocket(); const h = () => load(); s.on('dashboard:refresh', h); s.on('cycle_test:updated', h); s.on('automation:run', h); return () => { s.off('dashboard:refresh', h); s.off('cycle_test:updated', h); s.off('automation:run', h); }; }, [projectId, selectedCycle]);

  if (loading) return <div className="p-8">Loading dashboard...</div>;
  if (!stats) return <div className="p-6">No data</div>;

  const cards = stats.cards;
  const doughnutData = {
    labels: ['Pending','In Progress','Passed','Failed','Blocked'],
    datasets: [{ data: [cards.pending, cards.in_progress, cards.passed, cards.failed, cards.blocked], backgroundColor: ['#cbd5e1','#93c5fd','#86efac','#fca5a5','#fde68a'] }],
  };
  const barData = {
    labels: (stats.perModule || []).map(m=>m.module),
    datasets: [
      { label: 'Passed', data: (stats.perModule||[]).map(m=>m.passed), backgroundColor: '#86efac' },
      { label: 'Failed', data: (stats.perModule||[]).map(m=>m.failed), backgroundColor: '#fca5a5' },
      { label: 'Blocked', data: (stats.perModule||[]).map(m=>m.blocked), backgroundColor: '#fde68a' },
    ],
  };
  const lineData = {
    labels: (stats.trend||[]).map(t=> new Date(t.day).toISOString().slice(5,10)),
    datasets: [
      { label: 'Total', data: (stats.trend||[]).map(t=>t.total), borderColor: '#6366f1', tension: 0.3 },
      { label: 'Passed', data: (stats.trend||[]).map(t=>t.passed), borderColor: '#22c55e', tension: 0.3 },
      { label: 'Failed', data: (stats.trend||[]).map(t=>t.failed), borderColor: '#ef4444', tension: 0.3 },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <select value={selectedCycle} onChange={e=>setSelectedCycle(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">All cycles (project)</option>
            {cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 rounded text-sm">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{cards.total}</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Executed %</div><div className="text-2xl font-bold">{cards.executedPct}%</div><div className="text-xs text-slate-400">{cards.executed}/{cards.total}</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Pass rate</div><div className="text-2xl font-bold text-green-600">{cards.passRate}%</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Failed</div><div className="text-2xl font-bold text-red-600">{cards.failed}</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Blocked</div><div className="text-2xl font-bold text-amber-600">{cards.blocked}</div></div>
        <div className="bg-white p-4 rounded-xl border"><div className="text-xs text-slate-500">Overdue</div><div className="text-2xl font-bold text-orange-600">{cards.overdue}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl border"><h3 className="font-semibold mb-3">Status distribution</h3><Doughnut data={doughnutData} /></div>
        <div className="bg-white p-4 rounded-xl border lg:col-span-2"><h3 className="font-semibold mb-3">Pass/Fail per module</h3><Bar data={barData} /></div>
      </div>

      <div className="bg-white p-4 rounded-xl border"><h3 className="font-semibold mb-3">Execution trend (14 days)</h3><Line data={lineData} /></div>

      <div className="bg-white p-4 rounded-xl border">
        <h3 className="font-semibold mb-3">Recent executions</h3>
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Test</th><th className="p-2">Status</th><th className="p-2">Type</th><th className="p-2">By</th></tr></thead>
          <tbody>{(stats.recent||[]).map(r=><tr key={r.id} className="border-t"><td className="p-2 text-xs">{new Date(r.created_at).toLocaleString()}</td><td className="p-2">{r.code} – {r.title?.slice(0,40)}</td><td className="p-2"><span className={`badge badge-${r.status}`}>{r.status}</span></td><td className="p-2 text-xs">{r.execution_type}</td><td className="p-2 text-xs">{r.executed_by_name}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
