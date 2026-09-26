import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { projectId } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => { api.get(`/cycles?projectId=${projectId}`).then(({ data }) => { setCycles(data.data); if (data.data.length) setSelected(String(data.data[0].id)); }); }, [projectId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="bg-white border rounded-xl p-4 flex gap-3 items-center">
        <select value={selected} onChange={e=>setSelected(e.target.value)} className="border rounded px-3 py-1.5 text-sm">{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <a href={selected ? `/api/reports/cycle/${selected}.pdf` : '#'} target="_blank" className="px-3 py-1.5 bg-red-600 text-white rounded text-sm">Download PDF</a>
        <a href={selected ? `/api/reports/cycle/${selected}.xlsx` : '#'} target="_blank" className="px-3 py-1.5 bg-green-600 text-white rounded text-sm">Download Excel</a>
      </div>
      <div className="bg-white border rounded-xl p-6 text-sm text-slate-600">
        <p>PDF contains summary, pass/fail counts and list of tests with status, assignee, remarks.</p>
        <p className="mt-2">Excel contains 3 sheets: Summary, Test Cases (detailed), Executions (last 100).</p>
        <p className="mt-2">Backend uses pdfkit and exceljs. Reports are generated on the fly and audit-logged.</p>
      </div>
    </div>
  );
}
