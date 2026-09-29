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
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Test Cases</h1>
          <p className="page-sub">Design, prioritize &amp; trace your test coverage</p>
        </div>
        {isLead && <button onClick={openCreate} className="btn btn-primary">+ New Test Case</button>}
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input placeholder="Search code/title" value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))} className="input !w-auto" />
        <select value={filters.module} onChange={e=>setFilters(f=>({...f,module:e.target.value}))} className="input !w-auto !py-2"><option value="">All modules</option>{modules.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <select value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))} className="input !w-auto !py-2"><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select value={filters.isAutomated} onChange={e=>setFilters(f=>({...f,isAutomated:e.target.value}))} className="input !w-auto !py-2"><option value="">Manual+Automated</option><option value="true">Automated only</option><option value="false">Manual only</option></select>
        <span className="text-xs text-slate-500 self-center ml-auto">Total: {meta.total}</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr><th>Code</th><th>Title</th><th>Module</th><th>Priority</th><th>Auto</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Loading…</td></tr> :
              data.map(tc => (
                <tr key={tc.id}>
                  <td className="font-mono text-xs">{tc.code}</td>
                  <td><div className="font-medium">{tc.title}</div><div className="text-xs text-slate-500">{tc.requirementCode ? `${tc.requirementCode} • ` : ''}{tc.steps?.length || 0} steps</div></td>
                  <td><span className="badge bg-slate-100 text-slate-700">{tc.module}</span></td>
                  <td><PriorityBadge priority={tc.priority} /></td>
                  <td>{tc.isAutomated ? '🤖' : '—'}</td>
                  <td>{tc.latestStatus ? <StatusBadge status={tc.latestStatus} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  <td><div className="flex gap-1.5"><button onClick={()=>openEdit(tc)} className="btn !py-1 !px-2.5 !text-xs">Edit</button>{isLead && <button onClick={()=>remove(tc)} className="btn !py-1 !px-2.5 !text-xs !bg-rose-50 !text-rose-600 hover:!bg-rose-100">Deactivate</button>}</div></td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="p-3 flex justify-between text-xs border-t border-slate-100"><span>Page {meta.page} / {meta.totalPages}</span><div className="flex gap-2"><button disabled={meta.page<=1} onClick={()=>load(meta.page-1)} className="btn btn-soft !py-1 !px-2.5 !text-xs disabled:opacity-50">Prev</button><button disabled={meta.page>=meta.totalPages} onClick={()=>load(meta.page+1)} className="btn btn-soft !py-1 !px-2.5 !text-xs disabled:opacity-50">Next</button></div></div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submit} className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-auto space-y-3 shadow-pop">
            <h2 className="text-lg font-bold">{editing ? `Edit ${editing.code}` : 'New Test Case'}</h2>
            <input required placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input" />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Module (e.g. Login)" value={form.module} onChange={e=>setForm(f=>({...f,module:e.target.value}))} className="input" />
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} className="input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            </div>
            <textarea placeholder="Preconditions" value={form.preconditions} onChange={e=>setForm(f=>({...f,preconditions:e.target.value}))} className="input" rows={2} />
            <textarea required placeholder="Expected result" value={form.expectedResult} onChange={e=>setForm(f=>({...f,expectedResult:e.target.value}))} className="input" rows={2} />
            <div className="flex gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAutomated} onChange={e=>setForm(f=>({...f,isAutomated:e.target.checked}))} /> Automated</label><input placeholder="Requirement ID (optional)" value={form.requirementId} onChange={e=>setForm(f=>({...f,requirementId:e.target.value}))} className="input !w-40 !py-2 !text-sm" /></div>
            <div>
              <div className="text-sm font-medium mb-1">Steps</div>
              {form.steps.map((s,i)=><div key={i} className="flex gap-2 mb-2"><span className="text-xs mt-2">{i+1}.</span><input value={s.action} onChange={e=>{ const ns=[...form.steps]; ns[i].action=e.target.value; setForm(f=>({...f,steps:ns})); }} placeholder={`Step ${i+1} action`} className="input flex-1 !py-2 !text-sm" /><button type="button" onClick={()=>setForm(f=>({...f,steps:f.steps.filter((_,idx)=>idx!==i)}))} className="text-xs text-red-600">✕</button></div>)}
              <button type="button" onClick={()=>setForm(f=>({...f,steps:[...f.steps,{action:''}]}))} className="btn btn-soft !py-1 !px-2.5 !text-xs">+ Add step</button>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-soft">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
