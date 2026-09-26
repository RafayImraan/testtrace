import React, { useEffect, useState } from 'react';
import api from '../lib/api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({});
  const [filters, setFilters] = useState({ entityType: '', action: '' });

  const load = async (page=1) => {
    const params = new URLSearchParams({ page, pageSize: 20, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) });
    const { data } = await api.get(`/audit-logs?${params}`);
    setLogs(data.data);
    setMeta(data.meta);
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="bg-white p-3 rounded-xl border flex gap-2">
        <select value={filters.entityType} onChange={e=>setFilters(f=>({...f,entityType:e.target.value}))} className="border rounded px-2 py-1 text-sm"><option value="">All entities</option><option value="test_case">Test Case</option><option value="cycle_test">Cycle Test</option><option value="test_cycle">Cycle</option><option value="user">User</option><option value="automation_run">Automation Run</option></select>
        <select value={filters.action} onChange={e=>setFilters(f=>({...f,action:e.target.value}))} className="border rounded px-2 py-1 text-sm"><option value="">All actions</option><option value="create">Create</option><option value="update">Update</option><option value="status_change">Status Change</option><option value="assign">Assign</option><option value="login">Login</option></select>
        <span className="text-xs text-slate-500 self-center">Total {meta.total}</span>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Time</th><th className="p-2">User</th><th className="p-2">Entity</th><th className="p-2">Action</th><th className="p-2">Details</th></tr></thead>
          <tbody>{logs.map(l=><tr key={l.id} className="border-t"><td className="p-2 text-xs">{new Date(l.created_at).toLocaleString()}</td><td className="p-2 text-xs">{l.user_name||l.user_id||'system'}</td><td className="p-2 text-xs">{l.entity_type} #{l.entity_id}</td><td className="p-2"><span className="badge bg-slate-100">{l.action}</span></td><td className="p-2 text-xs max-w-xs truncate">{JSON.stringify(l.new_value||l.old_value||'').slice(0,120)}</td></tr>)}</tbody>
        </table>
        <div className="p-2 flex justify-between text-xs"><span>Page {meta.page}/{meta.totalPages}</span><button onClick={()=>load((meta.page||1)+1)} className="px-2 py-1 border rounded">Next</button></div>
      </div>
    </div>
  );
}
