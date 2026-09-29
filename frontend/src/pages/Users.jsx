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
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Accounts &amp; role assignment</p>
        </div>
        <button onClick={()=>{ setEditing(null); setForm({ email: '', password: '', fullName: '', role: 'tester' }); setShowForm(true); }} className="btn btn-primary">+ New User</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{users.map(u=><tr key={u.id}><td>{u.id}</td><td>{u.fullName}</td><td>{u.email}</td><td><span className="badge bg-slate-100">{u.role}</span></td><td>{u.isActive ? '✅' : '❌'}</td><td><div className="flex gap-1.5"><button onClick={()=>openEdit(u)} className="btn !py-1 !px-2.5 !text-xs">Edit</button><button onClick={()=>deactivate(u)} className="btn !py-1 !px-2.5 !text-xs !bg-rose-50 !text-rose-600 hover:!bg-rose-100">Deactivate</button></div></td></tr>)}</tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submit} className="card p-6 w-full max-w-md space-y-3 shadow-pop">
            <h3 className="font-bold text-lg">{editing ? `Edit ${editing.fullName}` : 'New User'}</h3>
            <input required placeholder="Full name" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} className="input" />
            <input required placeholder="Email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input" />
            {!editing && <input required type="password" placeholder="Password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} className="input" />}
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="input"><option value="admin">Admin</option><option value="lead">Lead</option><option value="tester">Tester</option></select>
            {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} /> Active</label>}
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-soft">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
