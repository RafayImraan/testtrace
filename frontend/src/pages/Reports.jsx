import React, { useEffect, useState } from 'react';
import api, { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { projectId } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => { api.get(`/cycles?projectId=${projectId}`).then(({ data }) => { setCycles(data.data); if (data.data.length) setSelected(String(data.data[0].id)); }); }, [projectId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-sub">Export cycle results as PDF or Excel</p>
      </div>
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select value={selected} onChange={e=>setSelected(e.target.value)} className="input !w-auto !py-2">{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <a href={selected ? `${API_BASE}/api/reports/cycle/${selected}.pdf` : '#'} target="_blank" className="btn btn-danger">Download PDF</a>
        <a href={selected ? `${API_BASE}/api/reports/cycle/${selected}.xlsx` : '#'} target="_blank" className="btn btn-success">Download Excel</a>
      </div>
      <div className="card p-6 text-sm text-slate-600 leading-relaxed">
        <p>PDF contains summary, pass/fail counts and list of tests with status, assignee, remarks.</p>
        <p className="mt-2">Excel contains 3 sheets: Summary, Test Cases (detailed), Executions (last 100).</p>
        <p className="mt-2">Backend uses pdfkit and exceljs. Reports are generated on the fly and audit-logged.</p>
      </div>
    </div>
  );
}
