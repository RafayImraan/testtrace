import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('lead@tta.local');
  const [password, setPassword] = useState('Lead@123');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Logged in');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <Toaster />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold">Test Trace & Automate</h1>
        <p className="text-sm text-slate-500 mt-1">QA management platform – demo login</p>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs">
          <div className="font-semibold">Demo credentials:</div>
          <div>admin@tta.local / Admin@123 (admin)</div>
          <div>lead@tta.local / Lead@123 (lead)</div>
          <div>tester1@tta.local / Tester@123 (tester)</div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="email" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="password" />
          </div>
          <button disabled={loading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-400 text-center">
          Backend: {import.meta.env.VITE_API_URL || '/api (same origin)'} • Socket: realtime enabled
        </div>
      </div>
    </div>
  );
}
