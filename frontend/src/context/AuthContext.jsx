import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(() => Number(localStorage.getItem('activeProjectId') || 1));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me').then(({ data }) => {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { disconnectSocket(); return; }
    const s = getSocket();
    if (projectId) s.emit('project:join', projectId);
    return () => { /* keep socket alive across navigations */ };
  }, [user, projectId]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* logout is best-effort */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    setUser(null);
  };

  const setActiveProject = (id) => {
    const num = Number(id);
    localStorage.setItem('activeProjectId', String(num));
    setProjectId(num);
    const s = getSocket();
    s.emit('project:join', num);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, projectId, setActiveProject, isAdmin: user?.role === 'admin', isLead: user?.role === 'lead' || user?.role === 'admin', isTester: user?.role === 'tester' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
