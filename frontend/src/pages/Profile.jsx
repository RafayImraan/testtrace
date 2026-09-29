import React from 'react';
import { useAuth } from '../context/AuthContext';
export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="page-sub">Your account details</p>
      </div>
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 rounded-full grid place-items-center text-xl font-bold text-white ring-4 ring-indigo-500/20" style={{ background: user.avatarColor }}>{user.fullName?.[0]}</div>
          <div>
            <div className="font-semibold">{user.fullName}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
          </div>
        </div>
        <div><span className="eyebrow">Role</span><div className="mt-1"><span className="badge badge-pending">{user.role}</span></div></div>
        <div><span className="eyebrow">Avatar color</span><div className="flex items-center gap-2 mt-1"><div className="w-6 h-6 rounded-full ring-2 ring-white shadow" style={{ background: user.avatarColor }}></div><span className="text-sm font-mono">{user.avatarColor}</span></div></div>
      </div>
    </div>
  );
}
