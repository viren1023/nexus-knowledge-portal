import React, { useState } from 'react';
import { documentService } from '../services/api';

export default function UploadAssetModal({ isOpen, onClose, projectId, onUploadSuccess }) {
  const [activeTab, setActiveTab] = useState('document'); // 'document' or 'repo'
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [roleAccess, setRoleAccess] = useState('developer,manager,qa,team_lead');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
            <label className="block text-sm font-medium text-slate-700 mb-1">Role Access (comma-separated)</label>
            <input 
              type="text" 
              value={roleAccess}
              onChange={(e) => setRoleAccess(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="developer,manager"
            />
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
