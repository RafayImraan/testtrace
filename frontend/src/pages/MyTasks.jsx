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
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">My Tasks</h1><select value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm"><option value="all">All</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select></div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Title</th><th className="p-2">Cycle</th><th className="p-2">Status</th><th className="p-2">Due</th><th className="p-2">Actions</th></tr></thead>
          <tbody>{tasks.map(t=><tr key={t.id} className={`border-t ${t.overdue ? 'bg-red-50' : ''}`}><td className="p-2 font-mono text-xs">{t.testCaseCode}</td><td className="p-2">{t.title}</td><td className="p-2 text-xs">{t.cycleName}</td><td className="p-2"><span className={`badge badge-${t.status}`}>{t.status}</span>{t.overdue && <span className="ml-1 badge badge-failed">Overdue</span>}</td><td className="p-2 text-xs">{t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10) : '—'}</td><td className="p-2 flex gap-1"><button onClick={()=>submitStatus(t,'in_progress')} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">In Progress</button><button onClick={()=>openExecute(t)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Execute</button></td></tr>)}</tbody>
        </table>
      </div>

      {executing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submitExecute} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <h3 className="font-bold">Execute {executing.testCaseCode}</h3>
            <select value={execForm.status} onChange={e=>setExecForm(f=>({...f,status:e.target.value}))} className="w-full border rounded px-3 py-2"><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select>
            <textarea placeholder="Actual result" value={execForm.actualResult} onChange={e=>setExecForm(f=>({...f,actualResult:e.target.value}))} className="w-full border rounded px-3 py-2" rows={2} />
            <textarea placeholder="Remarks" value={execForm.remarks} onChange={e=>setExecForm(f=>({...f,remarks:e.target.value}))} className="w-full border rounded px-3 py-2" rows={2} />
            <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} className="w-full text-sm" />
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setExecuting(null)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Submit</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
