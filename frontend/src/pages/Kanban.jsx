import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const columns = [
  { id: 'pending', label: 'Pending', color: 'bg-slate-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'passed', label: 'Passed', color: 'bg-green-100' },
  { id: 'failed', label: 'Failed', color: 'bg-red-100' },
  { id: 'blocked', label: 'Blocked', color: 'bg-amber-100' },
];

export default function Kanban() {
  const { projectId } = useAuth();
  const [searchParams] = useSearchParams();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState(searchParams.get('cycleId') || '');
  const [board, setBoard] = useState(null);
  const [dragged, setDragged] = useState(null);

  const loadCycles = async () => {
    const { data } = await api.get(`/cycles?projectId=${projectId}`);
    setCycles(data.data);
    if (!cycleId && data.data.length) setCycleId(String(data.data[0].id));
  };

  const loadBoard = async () => {
    if (!cycleId) return;
    const { data } = await api.get(`/cycles/${cycleId}/kanban`);
    setBoard(data);
  };

  useEffect(() => { loadCycles(); }, [projectId]);
  useEffect(() => { loadBoard(); const s = getSocket(); const h = () => loadBoard(); s.on('cycle_test:updated', h); s.on('cycle_test:assigned', h); return () => { s.off('cycle_test:updated', h); s.off('cycle_test:assigned', h); }; }, [cycleId]);

  const onDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!dragged) return;
    try {
      await api.patch(`/cycle-tests/${dragged.id}/status`, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      loadBoard();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
    setDragged(null);
  };

  if (!board) return <div className="p-6">Loading kanban... select cycle: <select value={cycleId} onChange={e=>setCycleId(e.target.value)} className="border rounded px-2 py-1">{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Kanban – {board.cycle.name}</h1>
        <select value={cycleId} onChange={e=>setCycleId(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {columns.map(col => (
          <div key={col.id} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e, col.id)} className={`rounded-xl border p-3 min-h-[500px] ${col.color}`}>
            <div className="font-semibold text-sm mb-3 flex justify-between"><span>{col.label}</span><span className="bg-white px-2 py-0.5 rounded-full text-xs">{board.columns[col.id]?.length || 0}</span></div>
            <div className="space-y-2">
              {(board.columns[col.id]||[]).map(card => (
                <div key={card.id} draggable onDragStart={()=>setDragged(card)} className="bg-white rounded-lg p-3 border shadow-sm cursor-move">
                  <div className="font-mono text-[11px] text-slate-500">{card.code}</div>
                  <div className="text-sm font-medium line-clamp-2">{card.title}</div>
                  <div className="mt-1 flex gap-1 text-[10px]"><span className={`badge badge-${card.priority}`}>{card.priority}</span><span className="badge bg-slate-100">{card.module}</span>{card.is_automated && <span>🤖</span>}</div>
                  <div className="mt-2 text-xs text-slate-500">{card.assignee_name || 'Unassigned'} {card.due_date ? `• ${new Date(card.due_date).toISOString().slice(0,10)}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
