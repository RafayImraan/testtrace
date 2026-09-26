import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import { getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

export default function TestCases() {
  const { projectId, isLead } = useAuth();
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ q: '', module: '', priority: '', isAutomated: '', status: '' });
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', expectedResult: '', module: '', priority: 'medium', preconditions: '', requirementId: '', isAutomated: false, steps: [{ action: '' }] });

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId, page, pageSize: 10, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) });
      const { data: res } = await api.get(`/test-cases?${params}`);
      setData(res.data);
      setMeta(res.meta);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const loadModules = async () => {
    try { const { data } = await api.get(`/test-cases/meta/modules?projectId=${projectId}`); setModules(data.data); } catch { /* module filter is optional */ }
  };

  useEffect(() => { load(); loadModules(); const s = getSocket(); const h = () => load(); s.on('test_case:created', h); s.on('test_case:updated', h); return () => { s.off('test_case:created', h); s.off('test_case:updated', h); }; }, [projectId]);
  useEffect(() => { load(1); }, [filters]);

  const openCreate = () => { setEditing(null); setForm({ title: '', expectedResult: '', module: modules[0]||'', priority: 'medium', preconditions: '', requirementId: '', isAutomated: false, steps: [{ action: '' }] }); setShowForm(true); };
  const openEdit = async (tc) => {
    try {
      const { data } = await api.get(`/test-cases/${tc.id}`);
      const t = data.testCase;
      setEditing(t);
      setForm({ title: t.title, expectedResult: t.expectedResult, module: t.module, priority: t.priority, preconditions: t.preconditions||'', requirementId: t.requirementId||'', isAutomated: t.isAutomated, steps: t.steps?.length ? t.steps : [{ action: '' }] });
      setShowForm(true);
    } catch { toast.error('Failed to load detail'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { projectId: Number(projectId), title: form.title, expectedResult: form.expectedResult, module: form.module, priority: form.priority, preconditions: form.preconditions||null, requirementId: form.requirementId ? Number(form.requirementId) : null, isAutomated: !!form.isAutomated, steps: form.steps.filter(s=>s.action.trim()).map((s,i)=>({ stepNo: i+1, action: s.action })) };
      if (editing) await api.patch(`/test-cases/${editing.id}`, payload);
      else await api.post('/test-cases', payload);
      toast.success(editing ? 'Updated' : 'Created');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const remove = async (tc) => {
    if (!confirm(`Deactivate ${tc.code}?`)) return;
    try { await api.delete(`/test-cases/${tc.id}`); toast.success('Deactivated'); load(); } catch (e) { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Test Cases</h1>
        {isLead && <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">+ New Test Case</button>}
      </div>

      <div className="bg-white p-4 rounded-xl border flex flex-wrap gap-3">
        <input placeholder="Search code/title" value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))} className="border rounded-lg px-3 py-1.5 text-sm" />
        <select value={filters.module} onChange={e=>setFilters(f=>({...f,module:e.target.value}))} className="border rounded-lg px-2 py-1.5 text-sm"><option value="">All modules</option>{modules.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <select value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))} className="border rounded-lg px-2 py-1.5 text-sm"><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select value={filters.isAutomated} onChange={e=>setFilters(f=>({...f,isAutomated:e.target.value}))} className="border rounded-lg px-2 py-1.5 text-sm"><option value="">Manual+Automated</option><option value="true">Automated only</option><option value="false">Manual only</option></select>
        <span className="text-xs text-slate-500 self-center">Total: {meta.total}</span>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left"><tr><th className="p-3">Code</th><th className="p-3">Title</th><th className="p-3">Module</th><th className="p-3">Priority</th><th className="p-3">Auto</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center">Loading...</td></tr> :
              data.map(tc => (
                <tr key={tc.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{tc.code}</td>
                  <td className="p-3"><div className="font-medium">{tc.title}</div><div className="text-xs text-slate-500">{tc.requirementCode ? `${tc.requirementCode} • ` : ''}{tc.steps?.length || 0} steps</div></td>
                  <td className="p-3"><span className="badge bg-slate-100 text-slate-700">{tc.module}</span></td>
                  <td className="p-3"><PriorityBadge priority={tc.priority} /></td>
                  <td className="p-3">{tc.isAutomated ? '🤖' : '—'}</td>
                  <td className="p-3">{tc.latestStatus ? <StatusBadge status={tc.latestStatus} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  <td className="p-3 flex gap-1"><button onClick={()=>openEdit(tc)} className="px-2 py-1 bg-slate-100 rounded text-xs">Edit</button>{isLead && <button onClick={()=>remove(tc)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">Deactivate</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="p-3 flex justify-between text-xs"><span>Page {meta.page} / {meta.totalPages}</span><div className="flex gap-2"><button disabled={meta.page<=1} onClick={()=>load(meta.page-1)} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button><button disabled={meta.page>=meta.totalPages} onClick={()=>load(meta.page+1)} className="px-2 py-1 border rounded disabled:opacity-50">Next</button></div></div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto space-y-3">
            <h2 className="text-lg font-bold">{editing ? `Edit ${editing.code}` : 'New Test Case'}</h2>
            <input required placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full border rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Module (e.g. Login)" value={form.module} onChange={e=>setForm(f=>({...f,module:e.target.value}))} className="border rounded-lg px-3 py-2" />
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} className="border rounded-lg px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            </div>
            <textarea placeholder="Preconditions" value={form.preconditions} onChange={e=>setForm(f=>({...f,preconditions:e.target.value}))} className="w-full border rounded-lg px-3 py-2" rows={2} />
            <textarea required placeholder="Expected result" value={form.expectedResult} onChange={e=>setForm(f=>({...f,expectedResult:e.target.value}))} className="w-full border rounded-lg px-3 py-2" rows={2} />
            <div className="flex gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAutomated} onChange={e=>setForm(f=>({...f,isAutomated:e.target.checked}))} /> Automated</label><input placeholder="Requirement ID (optional)" value={form.requirementId} onChange={e=>setForm(f=>({...f,requirementId:e.target.value}))} className="border rounded-lg px-3 py-1.5 text-sm w-40" /></div>
            <div>
              <div className="text-sm font-medium mb-1">Steps</div>
              {form.steps.map((s,i)=><div key={i} className="flex gap-2 mb-2"><span className="text-xs mt-2">{i+1}.</span><input value={s.action} onChange={e=>{ const ns=[...form.steps]; ns[i].action=e.target.value; setForm(f=>({...f,steps:ns})); }} placeholder={`Step ${i+1} action`} className="flex-1 border rounded-lg px-3 py-1.5 text-sm" /><button type="button" onClick={()=>setForm(f=>({...f,steps:f.steps.filter((_,idx)=>idx!==i)}))} className="text-xs text-red-600">✕</button></div>)}
              <button type="button" onClick={()=>setForm(f=>({...f,steps:[...f.steps,{action:''}]}))} className="text-xs px-2 py-1 bg-slate-100 rounded">+ Add step</button>
            </div>
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{editing ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
