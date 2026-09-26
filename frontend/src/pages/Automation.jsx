import React, { useEffect, useState } from 'react';
import api from '../lib/api';
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
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Automation</h1><div className="flex gap-2"><button onClick={trigger} className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm">Run 3 sample tests</button><span className="text-xs bg-slate-100 px-2 py-1 rounded">Queued: {health?.queued||0} Running: {health?.running||0}</span></div></div>

      <div className="flex gap-2 border-b"><button onClick={()=>setTab('runs')} className={`px-4 py-2 text-sm ${tab==='runs' ? 'border-b-2 border-indigo-600 font-semibold' : ''}`}>Run History</button><button onClick={()=>setTab('scripts')} className={`px-4 py-2 text-sm ${tab==='scripts' ? 'border-b-2 border-indigo-600 font-semibold' : ''}`}>Scripts</button><button onClick={()=>setTab('schedules')} className={`px-4 py-2 text-sm ${tab==='schedules' ? 'border-b-2 border-indigo-600 font-semibold' : ''}`}>Schedules</button></div>

      {tab==='runs' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">ID</th><th className="p-2">Batch</th><th className="p-2">Test</th><th className="p-2">Status</th><th className="p-2">Trigger</th><th className="p-2">Duration</th><th className="p-2">Created</th></tr></thead>
            <tbody>{runs.map(r=><tr key={r.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={()=>openRun(r.id)}><td className="p-2">{r.id}</td><td className="p-2 font-mono text-xs">{r.batchId.slice(0,8)}</td><td className="p-2">{r.testCaseCode}</td><td className="p-2"><span className={`badge badge-${r.status==='done'?'passed':'pending'}`}>{r.status}</span></td><td className="p-2 text-xs">{r.triggerType}</td><td className="p-2 text-xs">{r.durationMs ? `${r.durationMs}ms` : '—'}</td><td className="p-2 text-xs">{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody>
          </table>
          <div className="p-2 flex justify-between text-xs"><span>Page {meta.page}/{meta.totalPages} Total {meta.total}</span><button onClick={()=>loadRuns((meta.page||1)+1)} className="px-2 py-1 border rounded">Next</button></div>
        </div>
      )}

      {tab==='scripts' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Test</th><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">File</th><th className="p-2">Active</th></tr></thead>
            <tbody>{scripts.map(s=><tr key={s.id} className="border-t"><td className="p-2 font-mono text-xs">{s.testCaseCode}</td><td className="p-2">{s.name}</td><td className="p-2"><span className="badge bg-slate-100">{s.type}</span></td><td className="p-2 font-mono text-xs">{s.filePath}</td><td className="p-2">{s.isActive ? '✅' : '❌'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {tab==='schedules' && (
        <div className="bg-white border rounded-xl p-4">
          <table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Cycle</th><th className="p-2">Enabled</th><th className="p-2">Cron</th><th className="p-2">Last scheduled</th></tr></thead>
            <tbody>{schedules.map(c=><tr key={c.id} className="border-t"><td className="p-2">{c.name}</td><td className="p-2">{c.schedule_enabled ? '✅' : '❌'}</td><td className="p-2 font-mono text-xs">{c.schedule_cron}</td><td className="p-2 text-xs">{c.last_scheduled_at ? new Date(c.last_scheduled_at).toLocaleString() : 'Never'}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {selectedRun && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between"><h3 className="font-bold">Run #{selectedRun.run.id} – {selectedRun.run.testCaseCode}</h3><button onClick={()=>setSelectedRun(null)} className="text-sm px-2 py-1 border rounded">Close</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div>Status: <span className="font-mono">{selectedRun.run.status}</span></div><div>Duration: {selectedRun.run.durationMs}ms</div><div>Trigger: {selectedRun.run.triggerType}</div><div>Worker: {selectedRun.run.workerId}</div></div>
            <div className="mt-4"><div className="text-sm font-semibold">Log</div><pre className="mt-1 bg-slate-900 text-green-200 p-3 rounded text-xs overflow-auto max-h-64">{selectedRun.run.log || 'No log'}</pre></div>
            {selectedRun.run.error && <div className="mt-3"><div className="text-sm font-semibold text-red-600">Error</div><pre className="mt-1 bg-red-50 p-3 rounded text-xs overflow-auto">{selectedRun.run.error}</pre></div>}
            {selectedRun.run.screenshotPath && <div className="mt-3"><div className="text-sm font-semibold">Screenshot</div><img src={selectedRun.run.screenshotPath} alt="failure" className="mt-2 max-w-full border rounded" /><div className="text-xs text-slate-500 mt-1">{selectedRun.run.screenshotPath}</div></div>}
          </div>
        </div>
      )}
    </div>
  );
}
