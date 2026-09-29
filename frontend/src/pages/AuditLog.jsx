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
      <div>
        <h1 className="page-title">Audit Log</h1>
        <p className="page-sub">Every action recorded in the workspace</p>
      </div>
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <select value={filters.entityType} onChange={e=>setFilters(f=>({...f,entityType:e.target.value}))} className="input !w-auto !py-2"><option value="">All entities</option><option value="test_case">Test Case</option><option value="cycle_test">Cycle Test</option><option value="test_cycle">Cycle</option><option value="user">User</option><option value="automation_run">Automation Run</option></select>
        <select value={filters.action} onChange={e=>setFilters(f=>({...f,action:e.target.value}))} className="input !w-auto !py-2"><option value="">All actions</option><option value="create">Create</option><option value="update">Update</option><option value="status_change">Status Change</option><option value="assign">Assign</option><option value="login">Login</option></select>
        <span className="text-xs text-slate-500 self-center ml-auto">Total {meta.total}</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm"><thead><tr><th>Time</th><th>User</th><th>Entity</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>{logs.map(l=><tr key={l.id}><td className="text-xs">{new Date(l.created_at).toLocaleString()}</td><td className="text-xs">{l.user_name||l.user_id||'system'}</td><td className="text-xs">{l.entity_type} #{l.entity_id}</td><td><span className="badge bg-slate-100">{l.action}</span></td><td className="text-xs max-w-xs truncate">{JSON.stringify(l.new_value||l.old_value||'').slice(0,120)}</td></tr>)}</tbody>
        </table>
        <div className="p-3 flex justify-between text-xs border-t border-slate-100"><span>Page {meta.page}/{meta.totalPages}</span><button onClick={()=>load((meta.page||1)+1)} className="btn btn-soft !py-1 !px-2.5 !text-xs">Next</button></div>
      </div>
    </div>
  );
}
