import React from 'react';
import { useAuth } from '../context/AuthContext';
export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="mt-4 bg-white border rounded-xl p-6 space-y-3">
        <div><span className="text-sm text-slate-500">Full name</span><div className="font-medium">{user.fullName}</div></div>
        <div><span className="text-sm text-slate-500">Email</span><div className="font-medium">{user.email}</div></div>
        <div><span className="text-sm text-slate-500">Role</span><div><span className="badge badge-pending">{user.role}</span></div></div>
        <div><span className="text-sm text-slate-500">Avatar color</span><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full" style={{ background: user.avatarColor }}></div><span className="text-sm">{user.avatarColor}</span></div></div>
      </div>
    </div>
  );
}
