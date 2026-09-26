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
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Notifications {unread>0 && <span className="ml-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{unread} unread</span>}</h1><button onClick={markAll} className="px-3 py-1.5 bg-slate-100 rounded text-sm">Mark all read</button></div>
      <div className="space-y-2">
        {data.map(n=><div key={n.id} className={`bg-white border rounded-xl p-4 ${!n.isRead ? 'border-indigo-200 bg-indigo-50/30' : ''}`}><div className="flex justify-between"><div className="font-medium text-sm">{n.title}</div><div className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</div></div><div className="text-sm text-slate-600 mt-1">{n.message}</div><div className="mt-2 flex gap-2"><span className="badge bg-slate-100 text-xs">{n.type}</span>{n.link && <a href={n.link} className="text-xs text-indigo-600 hover:underline">{n.link}</a>}<button onClick={()=>markOne(n.id)} className="ml-auto text-xs px-2 py-1 bg-slate-100 rounded">Mark read</button></div></div>)}
        {data.length===0 && <div className="text-sm text-slate-500">No notifications</div>}
      </div>
    </div>
  );
}
