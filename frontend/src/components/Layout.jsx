import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

const Icon = ({ name, className = 'w-5 h-5' }) => {
  const shapes = {
    logo: <path d="M3 12h3.5l2-6 3.5 12 2.5-8 1.5 4H21" />,
    dashboard: (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="4.5" rx="2" />
        <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      </>
    ),
    cases: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M3.5 6l1.3 1.3L7.2 4.8M3.5 12l1.3 1.3 2.4-2.5M3.5 18l1.3 1.3 2.4-2.5" />
      </>
    ),
    cycles: (
      <>
        <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
        <path d="M20.5 3.5V9H15" />
      </>
    ),
    kanban: (
      <>
        <rect x="3" y="4" width="5" height="16" rx="1.6" />
        <rect x="9.5" y="4" width="5" height="10.5" rx="1.6" />
        <rect x="16" y="4" width="5" height="6.5" rx="1.6" />
      </>
    ),
    tasks: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M8 12.4l2.6 2.6L16.2 9.4" />
      </>
    ),
    automation: <path d="M13.2 2.8L5 13.6h5.4L10.2 21.2 19 10.4h-5.6l-.2-7.6z" />,
    requirements: (
      <>
        <path d="M6 3h8.5L19 7.5V21H6z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V11M9.3 20V5M14.7 20v-6M20 20V8" />
        <path d="M3 20h18" />
      </>
    ),
    audit: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 1.8" />
      </>
    ),
    users: (
      <>
        <circle cx="9.2" cy="8" r="3.4" />
        <path d="M3 19.4c.9-3.3 3.3-5 6.2-5s5.3 1.7 6.2 5" />
        <path d="M16.4 5.2a3.3 3.3 0 0 1 0 5.7M18 14.9c1.8.8 2.9 2.3 3.4 4.5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 1 0-12 0c0 5.3-2 6.8-2 6.8h16S18 14.3 18 9" />
        <path d="M10.3 19.6a2 2 0 0 0 3.4 0" />
      </>
    ),
    logout: (
      <>
        <path d="M14.5 8V5.5A1.5 1.5 0 0 0 13 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h7a1.5 1.5 0 0 0 1.5-1.5V16" />
        <path d="M9.5 12H21M18 8.8l3 3.2-3 3.2" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {shapes[name]}
    </svg>
  );
};

const nav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', roles: ['admin','lead','tester'] },
  { to: '/test-cases', label: 'Test Cases', icon: 'cases', roles: ['admin','lead','tester'] },
  { to: '/cycles', label: 'Cycles', icon: 'cycles', roles: ['admin','lead','tester'] },
  { to: '/kanban', label: 'Kanban', icon: 'kanban', roles: ['admin','lead','tester'] },
  { to: '/my-tasks', label: 'My Tasks', icon: 'tasks', roles: ['admin','lead','tester'] },
  { to: '/automation', label: 'Automation', icon: 'automation', roles: ['admin','lead','tester'] },
  { to: '/requirements', label: 'Requirements', icon: 'requirements', roles: ['admin','lead','tester'] },
  { to: '/reports', label: 'Reports', icon: 'reports', roles: ['admin','lead','tester'] },
  { to: '/audit', label: 'Audit Log', icon: 'audit', roles: ['admin','lead'] },
  { to: '/users', label: 'Users', icon: 'users', roles: ['admin'] },
];

const titles = {
  '/': 'Dashboard',
  '/test-cases': 'Test Cases',
  '/cycles': 'Test Cycles',
  '/kanban': 'Kanban Board',
  '/my-tasks': 'My Tasks',
  '/automation': 'Automation',
  '/requirements': 'Requirements',
  '/reports': 'Reports',
  '/audit': 'Audit Log',
  '/users': 'Users',
  '/profile': 'Profile',
  '/notifications': 'Notifications',
};

export default function Layout({ children }) {
  const { user, logout, projectId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const project = projects.find(p => p.id === projectId);
  const pageTitle = titles[location.pathname] || 'Test Trace & Automate';

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-[264px] shrink-0 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800/80">
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shadow-brand">
              <Icon name="logo" className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-[15px] leading-tight">
                Test Trace <span className="text-indigo-400">&</span> Automate
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">QA management platform</div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono tracking-wide">
              {project?.code || 'SHOP'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-semibold uppercase tracking-wider">
              {user.role}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.filter(n => n.roles.includes(user.role)).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-brand'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`
              }
            >
              <Icon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-1.5">
          <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/70 transition">
            <div className="relative">
              <div className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-white ring-2 ring-indigo-500/40" style={{ background: user.avatarColor || '#6366f1' }}>
                {user.fullName?.[0]}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate">{user.fullName}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="btn w-full !py-2 text-xs !text-slate-400 !border !border-slate-800 hover:!text-white hover:!bg-slate-800 hover:!border-slate-700"
          >
            <Icon name="logout" className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between px-6 gap-4">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-slate-900 truncate">{pageTitle}</div>
            <div className="text-xs text-slate-400 truncate">
              {project ? `${project.name} · ${project.code}` : 'QA workspace'} · {user.role}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative w-9 h-9 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Notifications"
            >
              <Icon name="bell" className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Link to="/profile" className="flex items-center gap-2.5 pr-1 rounded-xl hover:bg-slate-100 transition px-2 py-1.5 -mx-1">
              <div className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: user.avatarColor || '#6366f1' }}>
                {user.fullName?.[0]}
              </div>
              <div className="hidden md:block text-left leading-tight">
                <div className="text-sm font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-[11px] text-slate-400 capitalize">{user.role}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[radial-gradient(1100px_420px_at_8%_-12%,rgba(99,102,241,0.07),transparent),radial-gradient(900px_380px_at_112%_0%,rgba(217,70,239,0.06),transparent)]">
          <div key={location.pathname} className="page-enter max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
