import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

const nav = [
  { to: '/', label: 'Dashboard', roles: ['admin','lead','tester'] },
  { to: '/test-cases', label: 'Test Cases', roles: ['admin','lead','tester'] },
  { to: '/cycles', label: 'Cycles', roles: ['admin','lead','tester'] },
  { to: '/kanban', label: 'Kanban', roles: ['admin','lead','tester'] },
  { to: '/my-tasks', label: 'My Tasks', roles: ['admin','lead','tester'] },
  { to: '/automation', label: 'Automation', roles: ['admin','lead','tester'] },
  { to: '/requirements', label: 'Requirements', roles: ['admin','lead','tester'] },
  { to: '/reports', label: 'Reports', roles: ['admin','lead','tester'] },
  { to: '/audit', label: 'Audit Log', roles: ['admin','lead'] },
  { to: '/users', label: 'Users', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { user, logout, projectId } = useAuth();
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get('/projects').then(({ data }) => setProjects(data.data || [])).catch(()=>{});
    api.get('/notifications').then(({ data }) => setNotifCount(data.unread || 0)).catch(()=>{});
    const s = getSocket();
    const onNotif = () => setNotifCount((c) => c + 1);
    s.on('notification:new', onNotif);
    return () => s.off('notification:new', onNotif);
  }, []);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  if (!user) return children;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="font-bold text-lg">Test Trace & Automate</div>
          <div className="text-xs text-slate-400 mt-1">Project: {projects.find(p=>p.id===projectId)?.code || 'SHOP'} • {user.role}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.filter(n => n.roles.includes(user.role)).map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: user.avatarColor || '#6366f1' }}>{user.fullName?.[0]}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{user.fullName}</div><div className="text-xs text-slate-400 truncate">{user.email}</div></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/profile" className="flex-1 text-center text-xs px-2 py-1.5 bg-slate-800 rounded hover:bg-slate-700">Profile</Link>
            <button onClick={handleLogout} className="flex-1 text-xs px-2 py-1.5 bg-red-600 rounded hover:bg-red-700">Logout</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">Active project ID: {projectId}</div>
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative text-sm">
              🔔 {notifCount > 0 && <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{notifCount}</span>}
            </Link>
            <Link to="/profile" className="text-sm text-indigo-600 hover:underline">{user.fullName}</Link>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
