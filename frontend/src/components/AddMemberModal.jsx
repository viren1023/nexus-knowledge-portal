import React, { useState, useEffect, useMemo } from 'react';
import { projectService, authService } from '../services/api';

export default function AddMemberModal({ isOpen, onClose, projectId, onMemberAdded }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await authService.getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleAdd = async (developerId) => {
    setLoading(true);
    setError('');
    
    try {
      await projectService.addMember(projectId, { developer_id: developerId });
      onMemberAdded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-5 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Add Team Member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm shrink-0">{error}</div>}

        <div className="space-y-3 shrink-0 mb-4">
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">All Roles</option>
            <option value="developer">Developer</option>
            <option value="manager">Manager</option>
            <option value="qa">QA</option>
            <option value="team_lead">Team Lead</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border border-slate-100 rounded-lg">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No users found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <li key={user.id} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="overflow-hidden pr-2">
                    <p className="font-medium text-slate-800 text-sm truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email} &bull; <span className="capitalize">{user.role}</span></p>
                  </div>
                  <button 
                    onClick={() => handleAdd(user.id)}
                    disabled={loading}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 disabled:opacity-50"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
