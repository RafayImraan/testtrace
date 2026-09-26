import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'tester' });
  const [editing, setEditing] = useState(null);

  const load = async () => { const { data } = await api.get('/users'); setUsers(data.data); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.patch(`/users/${editing.id}`, { fullName: form.fullName, role: form.role, email: form.email, isActive: form.isActive });
      else await api.post('/users', form);
      toast.success(editing ? 'Updated' : 'Created');
      setShowForm(false); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const openEdit = (u) => { setEditing(u); setForm({ email: u.email, fullName: u.fullName, role: u.role, isActive: u.isActive, password: '' }); setShowForm(true); };
  const deactivate = async (u) => { if (!confirm(`Deactivate ${u.fullName}?`)) return; try { await api.delete(`/users/${u.id}`); toast.success('Deactivated'); load(); } catch (e) { toast.error('Failed'); } };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Users (Admin)</h1><button onClick={()=>{ setEditing(null); setForm({ email: '', password: '', fullName: '', role: 'tester' }); setShowForm(true); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm">+ New User</button></div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3">Role</th><th className="p-3">Active</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{users.map(u=><tr key={u.id} className="border-t"><td className="p-3">{u.id}</td><td className="p-3">{u.fullName}</td><td className="p-3">{u.email}</td><td className="p-3"><span className="badge bg-slate-100">{u.role}</span></td><td className="p-3">{u.isActive ? '✅' : '❌'}</td><td className="p-3 flex gap-1"><button onClick={()=>openEdit(u)} className="px-2 py-1 bg-slate-100 rounded text-xs">Edit</button><button onClick={()=>deactivate(u)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">Deactivate</button></td></tr>)}</tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold">{editing ? `Edit ${editing.fullName}` : 'New User'}</h3>
            <input required placeholder="Full name" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} className="w-full border rounded px-3 py-2" />
            <input required placeholder="Email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="w-full border rounded px-3 py-2" />
            {!editing && <input required type="password" placeholder="Password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} className="w-full border rounded px-3 py-2" />}
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="w-full border rounded px-3 py-2"><option value="admin">Admin</option><option value="lead">Lead</option><option value="tester">Tester</option></select>
            {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} /> Active</label>}
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">{editing ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
