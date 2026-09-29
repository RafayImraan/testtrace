import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [executing, setExecuting] = useState(null);
  const [execForm, setExecForm] = useState({ status: 'passed', actualResult: '', remarks: '' });
  const [file, setFile] = useState(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    const { data } = await api.get(`/cycle-tests/my-tasks?${params}`);
    setTasks(data.data);
  };

  useEffect(() => { load(); const s = getSocket(); const h = () => load(); s.on('cycle_test:assigned', h); s.on('cycle_test:updated', h); return () => { s.off('cycle_test:assigned', h); s.off('cycle_test:updated', h); }; }, [filter]);

  const openExecute = (t) => { setExecuting(t); setExecForm({ status: t.status === 'pending' ? 'in_progress' : 'passed', actualResult: '', remarks: '' }); setFile(null); };

  const submitStatus = async (t, newStatus) => {
    try { await api.patch(`/cycle-tests/${t.id}/status`, { status: newStatus }); toast.success(`Status → ${newStatus}`); load(); } catch (e) { toast.error(e.response?.data?.error?.message || 'Failed'); }
  };

  const submitExecute = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('status', execForm.status);
    fd.append('actualResult', execForm.actualResult);
    fd.append('remarks', execForm.remarks);
    if (file) fd.append('screenshot', file);
    try { await api.post(`/cycle-tests/${executing.id}/execute`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Execution recorded'); setExecuting(null); load(); } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-sub">Cycle tests assigned to you</p>
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="input !w-auto !py-2"><option value="all">All</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm"><thead><tr><th>Code</th><th>Title</th><th>Cycle</th><th>Status</th><th>Due</th><th>Actions</th></tr></thead>
          <tbody>{tasks.map(t=><tr key={t.id} className={t.overdue ? 'bg-rose-50/70' : ''}><td className="font-mono text-xs">{t.testCaseCode}</td><td>{t.title}</td><td className="text-xs">{t.cycleName}</td><td><span className={`badge badge-${t.status}`}>{t.status?.replace('_',' ')}</span>{t.overdue && <span className="ml-1 badge badge-failed">Overdue</span>}</td><td className="text-xs">{t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10) : '—'}</td><td><div className="flex gap-1.5"><button onClick={()=>submitStatus(t,'in_progress')} className="btn !py-1 !px-2.5 !text-xs !bg-sky-50 !text-sky-700 hover:!bg-sky-100">In Progress</button><button onClick={()=>openExecute(t)} className="btn btn-primary !py-1 !px-2.5 !text-xs">Execute</button></div></td></tr>)}
          {tasks.length===0 && <tr><td colSpan={6} className="py-12 text-center"><div className="text-3xl">📋</div><div className="mt-2 text-sm font-medium text-slate-600">No tasks {filter!=='all' ? `with status "${filter}"` : 'assigned to you'}</div><div className="text-xs text-slate-400 mt-1">{filter!=='all' ? 'Try a different filter.' : 'Tasks assigned by a lead show up here — demo with tester1@tta.local / Tester@123.'}</div></td></tr>}</tbody>
        </table>
      </div>

      {executing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submitExecute} className="card p-6 w-full max-w-lg space-y-3 shadow-pop">
            <h3 className="font-bold text-lg">Execute {executing.testCaseCode}</h3>
            <select value={execForm.status} onChange={e=>setExecForm(f=>({...f,status:e.target.value}))} className="input"><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select>
            <textarea placeholder="Actual result" value={execForm.actualResult} onChange={e=>setExecForm(f=>({...f,actualResult:e.target.value}))} className="input" rows={2} />
            <textarea placeholder="Remarks" value={execForm.remarks} onChange={e=>setExecForm(f=>({...f,remarks:e.target.value}))} className="input" rows={2} />
            <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} className="w-full text-sm" />
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={()=>setExecuting(null)} className="btn btn-soft">Cancel</button><button type="submit" className="btn btn-primary">Submit</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
