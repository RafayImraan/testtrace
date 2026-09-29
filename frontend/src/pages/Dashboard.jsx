import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const Card = ({ icon, tone, label, value, sub }) => (
  <div className="card card-hover p-4 relative overflow-hidden">
    <div className={`absolute inset-x-0 top-0 h-[3px] ${tone.line}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        <div className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
        {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
      </div>
      <span className={`icon-chip ${tone.chip}`}>{icon}</span>
    </div>
  </div>
);

const ChipIcon = ({ path, className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className || 'w-[18px] h-[18px]'}>{path}</svg>
);

const ChartBox = ({ title, subtitle, children, className = '' }) => (
  <div className={`card p-5 ${className}`}>
    <div className="flex items-baseline justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

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

  const header = (
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Quality snapshot across your active cycle</p>
      </div>
      <div className="flex gap-2 items-center">
        <select value={selectedCycle} onChange={e=>setSelectedCycle(e.target.value)} className="input !w-auto !py-2 text-sm">
          <option value="">All cycles (project)</option>
          {cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={load} className="btn btn-soft">Refresh</button>
      </div>
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-7 w-20" />
              <div className="skeleton h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 space-y-4"><div className="skeleton h-4 w-36" /><div className="skeleton h-52" /></div>
          <div className="card p-5 space-y-4 lg:col-span-2"><div className="skeleton h-4 w-44" /><div className="skeleton h-52" /></div>
        </div>
      </div>
    );
  }
  if (!stats) return <div className="card p-10 text-center text-slate-500">No dashboard data yet.</div>;

  const cards = stats.cards;
  const doughnutData = {
    labels: ['Pending','In Progress','Passed','Failed','Blocked'],
    datasets: [{ data: [cards.pending, cards.in_progress, cards.passed, cards.failed, cards.blocked],
      backgroundColor: ['#cbd5e1','#3b82f6','#10b981','#f43f5e','#f59e0b'],
      borderWidth: 0, hoverOffset: 8 }],
  };
  const barData = {
    labels: (stats.perModule || []).map(m=>m.module),
    datasets: [
      { label: 'Passed', data: (stats.perModule||[]).map(m=>m.passed), backgroundColor: '#10b981', borderRadius: 5, barPercentage: .65 },
      { label: 'Failed', data: (stats.perModule||[]).map(m=>m.failed), backgroundColor: '#f43f5e', borderRadius: 5, barPercentage: .65 },
      { label: 'Blocked', data: (stats.perModule||[]).map(m=>m.blocked), backgroundColor: '#f59e0b', borderRadius: 5, barPercentage: .65 },
    ],
  };
  const lineData = {
    labels: (stats.trend||[]).map(t=> new Date(t.day).toISOString().slice(5,10)),
    datasets: [
      { label: 'Total', data: (stats.trend||[]).map(t=>t.total), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.10)', fill: true, tension: .4, pointRadius: 2, borderWidth: 2 },
      { label: 'Passed', data: (stats.trend||[]).map(t=>t.passed), borderColor: '#10b981', backgroundColor: 'transparent', tension: .4, pointRadius: 2, borderWidth: 2 },
      { label: 'Failed', data: (stats.trend||[]).map(t=>t.failed), borderColor: '#f43f5e', backgroundColor: 'transparent', tension: .4, pointRadius: 2, borderWidth: 2 },
    ],
  };
  const gridColor = '#eef2f7';
  const tickColor = '#94a3b8';
  const axis = { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } } };
  const legend = { labels: { color: '#64748b', boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } };

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card label="Total tests" value={cards.total} sub={`${cards.executed} executed`} tone={{ chip: 'bg-indigo-50 text-indigo-600', line: 'bg-gradient-to-r from-indigo-500 to-indigo-400' }}
          icon={<ChipIcon path={<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12.4l2.6 2.6L16.2 9.4" /></>} />} />
        <Card label="Executed" value={`${cards.executedPct}%`} sub={`${cards.executed}/${cards.total} done`} tone={{ chip: 'bg-sky-50 text-sky-600', line: 'bg-gradient-to-r from-sky-500 to-sky-400' }}
          icon={<ChipIcon path={<><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>} />} />
        <Card label="Pass rate" value={`${cards.passRate}%`} sub="of executed" tone={{ chip: 'bg-emerald-50 text-emerald-600', line: 'bg-gradient-to-r from-emerald-500 to-emerald-400' }}
          icon={<ChipIcon path={<><path d="M4.5 12.5l5 5L19.5 7" /></>} />} />
        <Card label="Failed" value={cards.failed} sub="needs attention" tone={{ chip: 'bg-rose-50 text-rose-600', line: 'bg-gradient-to-r from-rose-500 to-rose-400' }}
          icon={<ChipIcon path={<><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16h.01" /></>} />} />
        <Card label="Blocked" value={cards.blocked} sub="waiting on deps" tone={{ chip: 'bg-amber-50 text-amber-600', line: 'bg-gradient-to-r from-amber-500 to-amber-400' }}
          icon={<ChipIcon path={<><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>} />} />
        <Card label="Overdue" value={cards.overdue} sub="past due date" tone={{ chip: 'bg-orange-50 text-orange-600', line: 'bg-gradient-to-r from-orange-500 to-orange-400' }}
          icon={<ChipIcon path={<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></>} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartBox title="Status distribution" subtitle="Across current selection">
          <div className="h-[248px] flex items-center justify-center"><div className="w-full max-w-[240px]"><Doughnut data={doughnutData} options={{ maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', ...legend } } }} /></div></div>
        </ChartBox>
        <ChartBox title="Pass / Fail per module" subtitle="Grouped by test module" className="lg:col-span-2">
          <div className="h-[248px]"><Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend }, scales: { x: { ...axis, grid: { display: false } }, y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, precision: 0 } } } }} /></div>
        </ChartBox>
      </div>

      <ChartBox title="Execution trend" subtitle="Last 14 days — total vs passed vs failed">
        <div className="h-[240px]"><Line data={lineData} options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend }, scales: { x: { ...axis, grid: { display: false } }, y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, precision: 0 } } } }} /></div>
      </ChartBox>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Recent executions</h3>
            <div className="text-xs text-slate-400 mt-0.5">Latest 10 results across the project</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Time</th><th>Test</th><th className="text-center">Status</th><th>Type</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent||[]).map(r=>(
                <tr key={r.id}>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td><span className="font-mono text-xs text-slate-400">{r.code}</span> <span className="text-slate-700">{r.title?.slice(0,40)}</span></td>
                  <td className="text-center"><span className={`badge badge-${r.status}`}>{r.status?.replace('_',' ')}</span></td>
                  <td className="text-xs capitalize text-slate-500">{r.execution_type}</td>
                  <td className="text-xs text-slate-500">{r.executed_by_name || '—'}</td>
                </tr>
              ))}
              {!stats.recent?.length && (
                <tr><td colSpan={5} className="text-center !py-8 text-slate-400">No executions yet — run a cycle to see results here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
