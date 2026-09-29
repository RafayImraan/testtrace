import React, { useEffect, useState } from 'react';
import api, { API_BASE } from '../lib/api';
import { getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

export default function Automation() {
  const [tab, setTab] = useState('runs');
  const [scripts, setScripts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [meta, setMeta] = useState({});
  const [selectedRun, setSelectedRun] = useState(null);
  const [health, setHealth] = useState(null);
  const [schedules, setSchedules] = useState([]);

  const loadScripts = async () => { const { data } = await api.get('/automation/scripts'); setScripts(data.data); };
  const loadRuns = async (page=1) => { const { data } = await api.get(`/automation/runs?page=${page}&pageSize=15`); setRuns(data.data); setMeta(data.meta); };
  const loadHealth = async () => { try { const { data } = await api.get('/automation/health'); setHealth(data); } catch { /* health is optional */ } };
  const loadSchedules = async () => { const { data } = await api.get('/automation/schedules'); setSchedules(data.data); };

  useEffect(() => { loadScripts(); loadRuns(); loadHealth(); loadSchedules(); const s = getSocket(); const h = () => { loadRuns(); loadHealth(); }; s.on('automation:run', h); return () => s.off('automation:run', h); }, []);

  const openRun = async (id) => { const { data } = await api.get(`/automation/runs/${id}`); setSelectedRun(data); };

  const trigger = async () => {
    try { const { data } = await api.post('/automation/run', { testCaseIds: scripts.slice(0,3).map(s=>s.testCaseId) }); toast.success(`Queued ${data.queued} batch ${data.batchId.slice(0,8)}`); loadRuns(); } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Automation</h1>
          <p className="page-sub">Playwright scripts, run history &amp; schedules</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={trigger} className="btn btn-primary">Run 3 sample tests</button>
          <span className="text-xs bg-slate-100 px-2.5 py-1.5 rounded-full font-medium text-slate-600">Queued: {health?.queued||0} · Running: {health?.running||0}</span>
        </div>
      </div>

      <div className="flex gap-2 border-b"><button onClick={()=>setTab('runs')} className={`px-4 py-2 text-sm transition ${tab==='runs' ? 'border-b-2 border-indigo-600 font-semibold text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Run History</button><button onClick={()=>setTab('scripts')} className={`px-4 py-2 text-sm transition ${tab==='scripts' ? 'border-b-2 border-indigo-600 font-semibold text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Scripts</button><button onClick={()=>setTab('schedules')} className={`px-4 py-2 text-sm transition ${tab==='schedules' ? 'border-b-2 border-indigo-600 font-semibold text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Schedules</button></div>

      {tab==='runs' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm"><thead><tr><th>ID</th><th>Batch</th><th>Test</th><th>Status</th><th>Trigger</th><th>Duration</th><th>Created</th></tr></thead>
            <tbody>{runs.map(r=><tr key={r.id} className="cursor-pointer" onClick={()=>openRun(r.id)}><td>{r.id}</td><td className="font-mono text-xs">{r.batchId.slice(0,8)}</td><td>{r.testCaseCode}</td><td><span className={`badge badge-${r.status==='done'?'passed':'pending'}`}>{r.status}</span></td><td className="text-xs">{r.triggerType}</td><td className="text-xs">{r.durationMs ? `${r.durationMs}ms` : '—'}</td><td className="text-xs">{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody>
          </table>
          <div className="p-2 flex justify-between text-xs"><span>Page {meta.page}/{meta.totalPages} Total {meta.total}</span><button onClick={()=>loadRuns((meta.page||1)+1)} className="px-2 py-1 border rounded">Next</button></div>
        </div>
      )}

      {tab==='scripts' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm"><thead><tr><th>Test</th><th>Name</th><th>Type</th><th>File</th><th>Active</th></tr></thead>
            <tbody>{scripts.map(s=><tr key={s.id}><td className="font-mono text-xs">{s.testCaseCode}</td><td>{s.name}</td><td><span className="badge bg-slate-100">{s.type}</span></td><td className="font-mono text-xs">{s.filePath}</td><td>{s.isActive ? '✅' : '❌'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {tab==='schedules' && (
        <div className="card p-4">
          <table className="w-full text-sm"><thead><tr><th>Cycle</th><th>Enabled</th><th>Cron</th><th>Last scheduled</th></tr></thead>
            <tbody>{schedules.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.schedule_enabled ? '✅' : '❌'}</td><td className="font-mono text-xs">{c.schedule_cron}</td><td className="text-xs">{c.last_scheduled_at ? new Date(c.last_scheduled_at).toLocaleString() : 'Never'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {selectedRun && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-3xl max-h-[90vh] overflow-auto !rounded-2xl shadow-pop">
            <div className="flex justify-between"><h3 className="font-bold">Run #{selectedRun.run.id} – {selectedRun.run.testCaseCode}</h3><button onClick={()=>setSelectedRun(null)} className="btn btn-soft !py-1.5 !px-3 !text-xs">Close</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div>Status: <span className="font-mono">{selectedRun.run.status}</span></div><div>Duration: {selectedRun.run.durationMs}ms</div><div>Trigger: {selectedRun.run.triggerType}</div><div>Worker: {selectedRun.run.workerId}</div></div>
            <div className="mt-4"><div className="text-sm font-semibold">Log</div><pre className="mt-1 bg-slate-900 text-green-200 p-3 rounded text-xs overflow-auto max-h-64">{selectedRun.run.log || 'No log'}</pre></div>
            {selectedRun.run.error && <div className="mt-3"><div className="text-sm font-semibold text-red-600">Error</div><pre className="mt-1 bg-red-50 p-3 rounded text-xs overflow-auto">{selectedRun.run.error}</pre></div>}
            {selectedRun.run.screenshotPath && <div className="mt-3"><div className="text-sm font-semibold">Screenshot</div><img src={`${API_BASE}${selectedRun.run.screenshotPath}`} alt="failure" className="mt-2 max-w-full border rounded" /><div className="text-xs text-slate-500 mt-1">{selectedRun.run.screenshotPath}</div></div>}
          </div>
        </div>
      )}
    </div>
  );
}
