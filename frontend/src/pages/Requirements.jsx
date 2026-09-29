import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Requirements() {
  const { projectId, isLead } = useAuth();
  const [reqs, setReqs] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const load = async () => {
    const { data } = await api.get(`/requirements?projectId=${projectId}`);
    setReqs(data.data);
  };
  const loadMatrix = async () => {
    const { data } = await api.get(`/requirements/traceability/matrix?projectId=${projectId}`);
    setMatrix(data);
  };

  useEffect(() => { load(); loadMatrix(); }, [projectId]);

  const create = async (e) => {
    e.preventDefault();
    try { await api.post('/requirements', { projectId: Number(projectId), ...form }); toast.success('Created'); setShowForm(false); load(); loadMatrix(); } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Requirements &amp; Traceability</h1>
          <p className="page-sub">Requirements linked to test cases — coverage matrix</p>
        </div>
        {isLead && <button onClick={()=>setShowForm(true)} className="btn btn-primary">+ New Requirement</button>}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">Requirements ({reqs.length})</h3>
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Title</th><th className="p-2">Priority</th><th className="p-2">TCs</th></tr></thead>
          <tbody>{reqs.map(r=><tr key={r.id} className="border-t"><td className="p-2 font-mono text-xs">{r.code}</td><td className="p-2">{r.title}</td><td className="p-2"><span className={`badge badge-${r.priority}`}>{r.priority}</span></td><td className="p-2">{r.testCaseCount}</td></tr>)}</tbody>
        </table>
      </div>

      {matrix && (
        <div className="card p-5">
          <h3 className="font-semibold mb-2">Traceability Matrix – Coverage {matrix.summary.avgCoverage}% • {matrix.summary.totalTestCases} test cases across {matrix.summary.totalRequirements} requirements</h3>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs"><thead className="bg-slate-50 sticky top-0"><tr><th className="p-2 text-left">Requirement</th><th className="p-2 text-left">Test Cases (latest status)</th><th className="p-2">Coverage</th></tr></thead>
              <tbody>{matrix.data.map(row=><tr key={row.requirementId} className="border-t"><td className="p-2"><div className="font-mono">{row.code}</div><div className="font-medium">{row.title}</div></td><td className="p-2"><div className="flex flex-wrap gap-1">{row.testCases.map(tc=><span key={tc.testCaseId} className={`badge badge-${tc.status||'pending'}`}>{tc.code} {tc.status||'—'}</span>)}{row.testCases.length===0 && <span className="text-slate-400">No test cases linked</span>}</div></td><td className="p-2 text-center">{row.coverage}%</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={create} className="card p-6 w-full max-w-lg space-y-3 shadow-pop">
            <h3 className="font-bold text-lg">New Requirement</h3>
            <input required placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input" />
            <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="input" rows={3} />
            <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} className="input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-soft">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
