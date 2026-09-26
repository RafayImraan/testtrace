import React, { useEffect, useState } from 'react';
import api from '../lib/api';
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
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      <div className="w-80 bg-white border rounded-xl p-4 overflow-auto">
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold">Cycles</h2>{isLead && <button onClick={()=>setShowForm(true)} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">+ New</button>}</div>
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

      <div className="flex-1 bg-white border rounded-xl p-4 overflow-auto">
        {!selected ? <div className="text-sm text-slate-500">Select a cycle</div> : (
          <div className="space-y-4">
            <div className="flex justify-between"><div><h2 className="text-xl font-bold">{selected.name}</h2><div className="text-sm text-slate-500">{selected.description}</div><div className="text-xs mt-1">Status: {selected.status} • {selected.stats.total} tests • Pass rate {selected.stats.passRate}% • Overdue {selected.stats.overdue}</div></div><div className="flex gap-2"><Link to={`/kanban?cycleId=${selected.id}`} className="px-3 py-1.5 bg-slate-100 rounded text-sm">Kanban</Link><a href={`/api/reports/cycle/${selected.id}.pdf`} target="_blank" className="px-3 py-1.5 bg-slate-100 rounded text-sm">PDF</a><a href={`/api/reports/cycle/${selected.id}.xlsx`} target="_blank" className="px-3 py-1.5 bg-slate-100 rounded text-sm">Excel</a></div></div>

            {isLead && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="flex gap-2"><input placeholder="Add test case IDs comma separated e.g. 1,2,3" value={addTestIds} onChange={e=>setAddTestIds(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" /><button onClick={addTests} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Add</button><button onClick={runAllAutomated} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Run all automated</button></div>
                <div className="flex gap-2"><select value={assignForm.assigneeId} onChange={e=>setAssignForm(f=>({...f,assigneeId:e.target.value}))} className="border rounded px-2 py-1 text-sm"><option value="">Select assignee</option>{users.map(u=><option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}</select><input type="date" value={assignForm.dueDate} onChange={e=>setAssignForm(f=>({...f,dueDate:e.target.value}))} className="border rounded px-2 py-1 text-sm" /><button onClick={assign} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Assign selected</button><button onClick={runAutomation} className="px-3 py-1 bg-purple-600 text-white rounded text-sm">Run automation selected</button></div>
              </div>
            )}

            <div className="overflow-auto">
              <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2"><input type="checkbox" checked={selectedTests.size===tests.length && tests.length>0} onChange={e=>{ if(e.target.checked) setSelectedTests(new Set(tests.map(t=>t.id))); else setSelectedTests(new Set()); }} /></th><th className="p-2 text-left">Code</th><th className="p-2 text-left">Title</th><th className="p-2">Module</th><th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">Assignee</th><th className="p-2">Due</th></tr></thead>
                <tbody>{tests.map(t=><tr key={t.id} className="border-t hover:bg-slate-50"><td className="p-2"><input type="checkbox" checked={selectedTests.has(t.id)} onChange={e=>{ const ns=new Set(selectedTests); if(e.target.checked) ns.add(t.id); else ns.delete(t.id); setSelectedTests(ns); }} /></td><td className="p-2 font-mono text-xs">{t.test_case_code}</td><td className="p-2">{t.title}</td><td className="p-2 text-xs">{t.module}</td><td className="p-2"><span className={`badge badge-${t.priority}`}>{t.priority}</span></td><td className="p-2"><span className={`badge badge-${t.status}`}>{t.status}</span></td><td className="p-2 text-xs">{t.assignee_name||'—'}</td><td className="p-2 text-xs">{t.due_date ? new Date(t.due_date).toISOString().slice(0,10) : '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={createCycle} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <h3 className="font-bold">New Cycle</h3>
            <input required placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full border rounded px-3 py-2" />
            <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full border rounded px-3 py-2" rows={2} />
            <div className="grid grid-cols-2 gap-3"><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="border rounded px-3 py-2"><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.scheduleEnabled} onChange={e=>setForm(f=>({...f,scheduleEnabled:e.target.checked}))} /> Nightly automation</label></div>
            <div className="grid grid-cols-2 gap-3"><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} className="border rounded px-3 py-2" /><input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} className="border rounded px-3 py-2" /></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
