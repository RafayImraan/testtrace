import React, { useEffect, useState } from 'react';
import api, { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSocket } from '../lib/socket';

export default function Cycles() {
  const { projectId, isLead } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tests, setTests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'planned', startDate: '', endDate: '', scheduleEnabled: false });
  const [addTestIds, setAddTestIds] = useState('');
  const [assignForm, setAssignForm] = useState({ assigneeId: '', dueDate: '' });
  const [selectedTests, setSelectedTests] = useState(new Set());
  const [users, setUsers] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/cycles?projectId=${projectId}`);
    setCycles(data.data);
  };

  const loadDetail = async (id) => {
    const { data } = await api.get(`/cycles/${id}`);
    setSelected(data.cycle);
    setTests(data.tests);
    setSelectedTests(new Set());
  };

  const loadUsers = async () => {
    try { const { data } = await api.get('/users/assignable'); setUsers(data.data); } catch { /* assignment UI still works without the list */ }
  };

  useEffect(() => { load(); loadUsers(); const s = getSocket(); const h = () => { load(); if (selected) loadDetail(selected.id); }; s.on('cycle:created', h); s.on('cycle:updated', h); s.on('cycle:tests_added', h); return () => { s.off('cycle:created', h); s.off('cycle:updated', h); s.off('cycle:tests_added', h); }; }, [projectId]);

  const createCycle = async (e) => {
    e.preventDefault();
    try {
      const payload = { projectId: Number(projectId), name: form.name, description: form.description||null, status: form.status, startDate: form.startDate||null, endDate: form.endDate||null, scheduleEnabled: form.scheduleEnabled };
      await api.post('/cycles', payload);
      toast.success('Cycle created');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const addTests = async () => {
    if (!addTestIds.trim()) return;
    const ids = addTestIds.split(',').map(s=>parseInt(s.trim(),10)).filter(Boolean);
    try { await api.post(`/cycles/${selected.id}/tests`, { testCaseIds: ids }); toast.success(`Added ${ids.length}`); loadDetail(selected.id); } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  const assign = async () => {
    if (!selectedTests.size || !assignForm.assigneeId) { toast.error('Select tests and assignee'); return; }
    try {
      await api.post(`/cycles/${selected.id}/assign`, { cycleTestIds: Array.from(selectedTests), assigneeId: Number(assignForm.assigneeId), dueDate: assignForm.dueDate||null });
      toast.success('Assigned');
      loadDetail(selected.id);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  const runAutomation = async () => {
    if (!selectedTests.size) { toast.error('Select tests to run'); return; }
    try {
      const { data } = await api.post('/automation/run', { cycleTestIds: Array.from(selectedTests) });
      toast.success(`Queued ${data.queued} runs, batch ${data.batchId.slice(0,8)}`);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  const runAllAutomated = async () => {
    try {
      const { data } = await api.post('/automation/run', { cycleId: selected.id });
      toast.success(`Queued ${data.queued} automated tests`);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Test Cycles</h1>
        <p className="page-sub">Plan, assign and run cycles — pick a cycle on the left</p>
      </div>
      <div className="flex gap-6 h-[calc(100vh-170px)]">
      <div className="card w-80 p-4 overflow-auto">
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold">Cycles</h2>{isLead && <button onClick={()=>setShowForm(true)} className="btn btn-primary !py-1 !px-2.5 !text-xs">+ New</button>}</div>
        <div className="space-y-2">
          {cycles.map(c => (
            <div key={c.id} onClick={()=>loadDetail(c.id)} className={`p-3 rounded-lg border cursor-pointer ${selected?.id===c.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-slate-500">{c.status} • {c.stats?.total || 0} tests • {c.stats?.executedPct || 0}% exec</div>
              <div className="mt-1 flex gap-1 text-[10px]"><span className="badge badge-passed">{c.stats?.passed||0}P</span><span className="badge badge-failed">{c.stats?.failed||0}F</span><span className="badge badge-pending">{c.stats?.pending||0} Pend</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card flex-1 p-4 overflow-auto">
        {!selected ? <div className="text-sm text-slate-500">Select a cycle</div> : (
          <div className="space-y-4">
            <div className="flex justify-between"><div><h2 className="text-xl font-bold">{selected.name}</h2><div className="text-sm text-slate-500">{selected.description}</div><div className="text-xs mt-1">Status: {selected.status} • {selected.stats.total} tests • Pass rate {selected.stats.passRate}% • Overdue {selected.stats.overdue}</div></div><div className="flex gap-2"><Link to={`/kanban?cycleId=${selected.id}`} className="btn btn-soft !py-1.5">Kanban</Link><a href={`${API_BASE}/api/reports/cycle/${selected.id}.pdf`} target="_blank" className="btn btn-soft !py-1.5">PDF</a><a href={`${API_BASE}/api/reports/cycle/${selected.id}.xlsx`} target="_blank" className="btn btn-soft !py-1.5">Excel</a></div></div>

            {isLead && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex gap-2 flex-wrap"><input placeholder="Add test case IDs comma separated e.g. 1,2,3" value={addTestIds} onChange={e=>setAddTestIds(e.target.value)} className="input flex-1 !py-2" /><button onClick={addTests} className="btn btn-primary !py-2">Add</button><button onClick={runAllAutomated} className="btn btn-success !py-2">Run all automated</button></div>
                <div className="flex gap-2 flex-wrap"><select value={assignForm.assigneeId} onChange={e=>setAssignForm(f=>({...f,assigneeId:e.target.value}))} className="input !w-auto !py-2"><option value="">Select assignee</option>{users.map(u=><option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}</select><input type="date" value={assignForm.dueDate} onChange={e=>setAssignForm(f=>({...f,dueDate:e.target.value}))} className="input !w-auto !py-2" /><button onClick={assign} className="btn btn-info !py-2">Assign selected</button><button onClick={runAutomation} className="btn btn-primary !py-2">Run automation selected</button></div>
              </div>
            )}

            <div className="overflow-auto">
              <table className="w-full text-sm"><thead><tr><th><input type="checkbox" checked={selectedTests.size===tests.length && tests.length>0} onChange={e=>{ if(e.target.checked) setSelectedTests(new Set(tests.map(t=>t.id))); else setSelectedTests(new Set()); }} /></th><th>Code</th><th>Title</th><th>Module</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Due</th></tr></thead>
                <tbody>{tests.map(t=><tr key={t.id}><td><input type="checkbox" checked={selectedTests.has(t.id)} onChange={e=>{ const ns=new Set(selectedTests); if(e.target.checked) ns.add(t.id); else ns.delete(t.id); setSelectedTests(ns); }} /></td><td className="font-mono text-xs">{t.test_case_code}</td><td>{t.title}</td><td className="text-xs">{t.module}</td><td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td><td><span className={`badge badge-${t.status}`}>{t.status}</span></td><td className="text-xs">{t.assignee_name||'—'}</td><td className="text-xs">{t.due_date ? new Date(t.due_date).toISOString().slice(0,10) : '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={createCycle} className="card p-6 w-full max-w-lg space-y-3 shadow-pop">
            <h3 className="font-bold text-lg">New Cycle</h3>
            <input required placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="input" />
            <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="input" rows={2} />
            <div className="grid grid-cols-2 gap-3"><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="input"><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.scheduleEnabled} onChange={e=>setForm(f=>({...f,scheduleEnabled:e.target.checked}))} /> Nightly automation</label></div>
            <div className="grid grid-cols-2 gap-3"><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} className="input" /><input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} className="input" /></div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-soft">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}
