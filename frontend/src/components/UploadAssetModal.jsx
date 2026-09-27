import React, { useState } from 'react';
import { documentService } from '../services/api';

const ROLES = [
  { 
    id: 'manager', 
    label: 'Manager', 
    level: 1, 
    activeClass: 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-200 shadow-2xs font-semibold', 
    dotClass: 'bg-purple-600' 
  },
  { 
    id: 'team_lead', 
    label: 'Team Lead', 
    level: 2, 
    activeClass: 'bg-sky-50 text-sky-700 border-sky-300 ring-1 ring-sky-200 shadow-2xs font-semibold', 
    dotClass: 'bg-sky-600' 
  },
  { 
    id: 'developer', 
    label: 'Developer', 
    level: 3, 
    activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs font-semibold', 
    dotClass: 'bg-emerald-600' 
  },
  { 
    id: 'qa', 
    label: 'QA', 
    level: 3, 
    activeClass: 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-200 shadow-2xs font-semibold', 
    dotClass: 'bg-amber-600' 
  },
];

export default function UploadAssetModal({ isOpen, onClose, projectId, onUploadSuccess }) {
  const [activeTab, setActiveTab] = useState('document'); // 'document' or 'repo'
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['manager', 'team_lead', 'developer', 'qa']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleAccess = selectedRoles.join(',');

  const handleRoleClick = (roleId) => {
    if (roleId === 'manager') {
      // Clicking manager greys out all other roles
      setSelectedRoles(['manager']);
      return;
    }

    if (roleId === 'team_lead') {
      // Team lead follows after manager: colors manager and team_lead, greys out developer & qa
      if (selectedRoles.includes('team_lead') && !selectedRoles.includes('developer') && !selectedRoles.includes('qa')) {
        setSelectedRoles(['manager']);
      } else {
        setSelectedRoles(['manager', 'team_lead']);
      }
      return;
    }

    if (roleId === 'developer') {
      // Developer: colors developer and above roles (manager, team_lead)
      if (selectedRoles.includes('developer')) {
        const next = selectedRoles.filter(r => r !== 'developer');
        setSelectedRoles(next.length ? next : ['manager', 'team_lead']);
      } else {
        const next = new Set(selectedRoles);
        next.add('manager');
        next.add('team_lead');
        next.add('developer');
        setSelectedRoles(Array.from(next));
      }
      return;
    }

    if (roleId === 'qa') {
      // QA: colors QA and above roles (manager, team_lead)
      if (selectedRoles.includes('qa')) {
        const next = selectedRoles.filter(r => r !== 'qa');
        setSelectedRoles(next.length ? next : ['manager', 'team_lead']);
      } else {
        const next = new Set(selectedRoles);
        next.add('manager');
        next.add('team_lead');
        next.add('qa');
        setSelectedRoles(Array.from(next));
      }
      return;
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'document') {
        if (!file) {
          setError('Please select a file.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('role_access', roleAccess);
        // Ensure backend expects these, project_id is handled in URL via API service
        await documentService.upload(projectId, formData);
      } else {
        if (!repoUrl) {
          setError('Please enter a repository URL.');
          setLoading(false);
          return;
        }
        const parsedName = repoUrl.split('/').pop() || 'Repository';
        const repoName = parsedName.endsWith('.git') ? parsedName.slice(0, -4) : parsedName;
        await documentService.uploadRepo(projectId, { repo_url: repoUrl, repo_name: repoName, role_access: roleAccess });
      }
      
      onUploadSuccess();
      setFile(null);
      setRepoUrl('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to upload asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-slate-800">Upload Asset</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button 
            className={`pb-2 font-medium text-sm transition-colors ${activeTab === 'document' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => { setActiveTab('document'); setError(''); }}
          >
            Document
          </button>
          <button 
            className={`pb-2 font-medium text-sm transition-colors ${activeTab === 'repo' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => { setActiveTab('repo'); setError(''); }}
          >
            Git Repository
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'document' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select File</label>
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 outline-none transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Repository URL</label>
              <input 
                type="url" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Role Access Hierarchy
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {selectedRoles.length === 4 ? 'All team members' : `${selectedRoles.length} of 4 roles`}
              </span>
            </div>

            {/* Hierarchical Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              {ROLES.map((role) => {
                const isActive = selectedRoles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleClick(role.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none active:scale-[0.97] ${
                      isActive
                        ? role.activeClass
                        : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/60'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isActive ? role.dotClass : 'bg-slate-300'
                      }`}
                    />
                    <span>{role.label}</span>
                    <span className="text-[10px] opacity-75 font-normal">
                      (L{role.level})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Access Summary & Hierarchy Guidance */}
            <div className="mt-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span>Access:</span>
                <span className="font-semibold text-slate-900">
                  {selectedRoles.length === 1 && selectedRoles[0] === 'manager'
                    ? 'Manager only (Confidential)'
                    : selectedRoles.length === 4
                    ? 'All Project Members'
                    : selectedRoles
                        .map(r => ROLES.find(item => item.id === r)?.label)
                        .filter(Boolean)
                        .join(', ')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Hierarchy: Selecting Developer or QA automatically grants access to Team Lead & Manager. Clicking Manager restricts to executive only.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium transition-colors disabled:opacity-50">
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
