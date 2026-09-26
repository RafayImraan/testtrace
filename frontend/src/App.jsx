import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TestCases from './pages/TestCases';
import Cycles from './pages/Cycles';
import Kanban from './pages/Kanban';
import MyTasks from './pages/MyTasks';
import Automation from './pages/Automation';
import Requirements from './pages/Requirements';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import { Toaster } from 'react-hot-toast';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <div className="p-8">403 Forbidden – role {user.role} not allowed</div>;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/test-cases" element={<Protected><TestCases /></Protected>} />
          <Route path="/cycles" element={<Protected><Cycles /></Protected>} />
          <Route path="/kanban" element={<Protected><Kanban /></Protected>} />
          <Route path="/my-tasks" element={<Protected><MyTasks /></Protected>} />
          <Route path="/automation/*" element={<Protected><Automation /></Protected>} />
          <Route path="/requirements" element={<Protected><Requirements /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/audit" element={<Protected roles={['admin','lead']}><AuditLog /></Protected>} />
          <Route path="/users" element={<Protected roles={['admin']}><Users /></Protected>} />
          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
