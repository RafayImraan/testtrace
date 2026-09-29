import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

const demoAccounts = [
  { email: 'admin@tta.local', password: 'Admin@123', role: 'Admin', hint: 'full access' },
  { email: 'lead@tta.local', password: 'Lead@123', role: 'Lead', hint: 'test lead' },
  { email: 'tester1@tta.local', password: 'Tester@123', role: 'Tester', hint: 'my tasks' },
];

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
);

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
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const pick = (acc) => { setEmail(acc.email); setPassword(acc.password); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <Toaster position="top-center" />

      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_15%_10%,rgba(99,102,241,.35),transparent),radial-gradient(600px_480px_at_90%_85%,rgba(217,70,239,.28),transparent),radial-gradient(500px_400px_at_75%_15%,rgba(14,165,233,.18),transparent)]" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center shadow-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M3 12h3.5l2-6 3.5 12 2.5-8 1.5 4H21" />
            </svg>
          </div>
          <div className="font-bold text-lg tracking-tight">Test Trace &amp; Automate</div>
        </div>

        <div className="relative max-w-md">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">QA management platform</div>
          <h1 className="mt-4 text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight">
            Trace every bug.<br />Automate every check.<br />
            <span className="grad-text bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">Ship with confidence.</span>
          </h1>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-lg bg-emerald-400/15 text-emerald-300 grid place-items-center"><Check /></span> Test cases, cycles &amp; Kanban in one workspace</li>
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-lg bg-emerald-400/15 text-emerald-300 grid place-items-center"><Check /></span> Playwright automation runs with live results</li>
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-lg bg-emerald-400/15 text-emerald-300 grid place-items-center"><Check /></span> Dashboards, reports &amp; audit trail for every action</li>
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-4 max-w-lg">
          {[
            { v: '40+', l: 'Test cases' },
            { v: '11', l: 'Auto scripts' },
            { v: '3', l: 'Roles' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-4 py-3.5 animate-float" style={{ animationDelay: `${s.l.length * 0.35}s` }}>
              <div className="text-xl font-bold">{s.v}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50 bg-[radial-gradient(800px_400px_at_50%_-10%,rgba(99,102,241,0.08),transparent)]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 12h3.5l2-6 3.5 12 2.5-8 1.5 4H21" /></svg>
            </div>
            <div className="font-bold text-lg">Test Trace &amp; Automate</div>
          </div>

          <div className="card p-8 shadow-pop">
            <div className="eyebrow">Welcome back</div>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">Sign in to your workspace</h2>
            <p className="page-sub">Use a demo account below or your own credentials.</p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label" htmlFor="email">E-mail</label>
                <input id="email" value={email} onChange={e=>setEmail(e.target.value)} className="input mt-1.5" placeholder="you@company.com" autoComplete="username" />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input mt-1.5" placeholder="••••••••" autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full !py-3 !text-[15px]">
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                )}
              </button>
            </form>

            <div className="mt-7 pt-5 border-t border-slate-100">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Demo accounts — tap to fill</div>
              <div className="space-y-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => pick(acc)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      email === acc.email
                        ? 'border-indigo-300 bg-indigo-50/70 shadow-glow'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-xs font-bold">
                      {acc.role[0]}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-800">{acc.email}</span>
                      <span className="block text-[11px] text-slate-400">{acc.role} · {acc.hint}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{acc.password}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-400">
            API: {import.meta.env.VITE_API_URL || '/api (same origin)'} · realtime enabled
          </div>
        </div>
      </div>
    </div>
  );
}
