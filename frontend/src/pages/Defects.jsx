import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const initialForm = { requirementId: '', testCaseId: '', title: '', description: '', severity: 'major' };

export default function Defects() {
  const { projectId, isLead } = useAuth();
  const [defects, setDefects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const linkedCases = useMemo(
    () => testCases.filter((tc) => String(tc.requirementId) === String(form.requirementId)),
    [testCases, form.requirementId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const query = statusFilter ? `&status=${statusFilter}` : '';
      const [defectRes, reqRes, tcRes] = await Promise.all([
        api.get(`/defects?projectId=${projectId}${query}`),
        api.get(`/requirements?projectId=${projectId}&pageSize=100`),
        api.get(`/test-cases?projectId=${projectId}&pageSize=100`),
      ]);
      setDefects(defectRes.data.data || []);
      setRequirements(reqRes.data.data || []);
      setTestCases(tcRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not load defects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId, statusFilter]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const testCase = linkedCases.find((tc) => String(tc.id) === String(form.testCaseId));
      await api.post('/defects', {
        projectId: Number(projectId),
        requirementId: Number(form.requirementId),
        testCaseId: Number(form.testCaseId),
        cycleTestId: testCase?.latestCycleTestId || undefined,
        title: form.title,
        description: form.description,
        severity: form.severity,
      });
      toast.success('Defect reported and linked to its requirement and test case');
      setForm(initialForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not report defect');
    }
  };

  const updateStatus = async (defect, status) => {
    try {
      await api.patch(`/defects/${defect.id}`, { status });
      toast.success(`${defect.code} updated`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not update defect');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Defects</h1>
          <p className="page-sub">Track issues from discovery through resolution, linked to requirements and test cases.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Report Defect</button>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <label htmlFor="defect-status" className="text-sm font-medium">Status</label>
        <select id="defect-status" className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="fixed">Fixed</option><option value="closed">Closed</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{defects.length} defect{defects.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3 text-left">Defect</th><th className="p-3 text-left">Requirement → Test case</th><th className="p-3 text-left">Description</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Reporter</th></tr></thead>
          <tbody>
            {!loading && defects.map((d) => <tr key={d.id} className="border-t align-top">
              <td className="p-3 font-mono text-xs">{d.code}<div className="mt-1 font-sans font-semibold text-sm text-slate-800">{d.title}</div></td>
              <td className="p-3"><div className="font-mono text-xs">{d.requirementCode}</div><div>{d.requirementTitle}</div><div className="mt-1 font-mono text-xs text-slate-500">{d.testCaseCode} · {d.testCaseTitle}</div>{d.cycleName && <div className="text-xs text-slate-400">Found in {d.cycleName}</div>}</td>
              <td className="p-3 max-w-sm whitespace-pre-wrap">{d.description}</td>
              <td className="p-3 text-center"><span className={`badge badge-${d.severity}`}>{d.severity}</span></td>
              <td className="p-3 text-center">{isLead ? <select className="input !py-1" value={d.status} onChange={(e) => updateStatus(d, e.target.value)}><option value="open">Open</option><option value="confirmed">Confirmed</option><option value="fixed">Fixed</option><option value="closed">Closed</option></select> : <span className="badge badge-pending">{d.status}</span>}</td>
              <td className="p-3 text-center">{d.reporter || '—'}</td>
            </tr>)}
            {!loading && defects.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No defects match this filter.</td></tr>}
            {loading && <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading defects…</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <form onSubmit={create} className="card w-full max-w-xl space-y-3 p-6 shadow-pop">
          <h2 className="text-lg font-bold">Report a defect</h2>
          <select required className="input" value={form.requirementId} onChange={(e) => setForm({ ...form, requirementId: e.target.value, testCaseId: '' })}>
            <option value="">Select requirement</option>{requirements.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.title}</option>)}
          </select>
          <select required className="input" value={form.testCaseId} onChange={(e) => setForm({ ...form, testCaseId: e.target.value })} disabled={!form.requirementId}>
            <option value="">Select linked test case</option>{linkedCases.map((tc) => <option key={tc.id} value={tc.id}>{tc.code} · {tc.title}</option>)}
          </select>
          <input required minLength="3" maxLength="200" className="input" placeholder="Short defect title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea required minLength="3" maxLength="10000" rows="4" className="input" placeholder="Steps to reproduce, actual result, and expected result" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option><option value="blocker">Blocker</option></select>
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-soft" onClick={() => { setShowForm(false); setForm(initialForm); }}>Cancel</button><button type="submit" className="btn btn-primary">Save defect</button></div>
        </form>
      </div>}
    </div>
  );
}
