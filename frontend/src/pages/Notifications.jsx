import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

export default function Notifications() {
  const [data, setData] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const { data: res } = await api.get('/notifications?limit=50');
    setData(res.data);
    setUnread(res.unread);
  };

  useEffect(() => { load(); const s = getSocket(); const h = () => load(); s.on('notification:new', h); return () => s.off('notification:new', h); }, []);

  const markAll = async () => { await api.post('/notifications/read', {}); load(); };
  const markOne = async (id) => { await api.post('/notifications/read', { id }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Notifications {unread>0 && <span className="ml-2 align-middle bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full">{unread} unread</span>}</h1>
          <p className="page-sub">Realtime updates from your workspace</p>
        </div>
        <button onClick={markAll} className="btn btn-soft">Mark all read</button>
      </div>
      <div className="space-y-2">
        {data.map(n=><div key={n.id} className={`card p-4 ${!n.isRead ? '!border-indigo-200 bg-indigo-50/40' : ''}`}><div className="flex justify-between gap-3"><div className="font-medium text-sm">{n.title}</div><div className="text-xs text-slate-500 whitespace-nowrap">{new Date(n.createdAt).toLocaleString()}</div></div><div className="text-sm text-slate-600 mt-1">{n.message}</div><div className="mt-2 flex gap-2 items-center"><span className="badge bg-slate-100 text-xs">{n.type}</span>{n.link && <a href={n.link} className="text-xs text-indigo-600 hover:underline">{n.link}</a>}<button onClick={()=>markOne(n.id)} className="ml-auto btn !py-1 !px-2.5 !text-xs">Mark read</button></div></div>)}
        {data.length===0 && <div className="card p-10 text-center"><div className="text-3xl">🔔</div><div className="mt-2 text-sm font-medium text-slate-600">No notifications yet</div><div className="text-xs text-slate-400 mt-1">You'll see mentions, assignments and run results here.</div></div>}
      </div>
    </div>
  );
}
