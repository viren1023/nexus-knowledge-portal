import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentService } from '../services/api';

export default function ProjectAssets({ projectId, currentUserRole, onUploadClick }) {
  const [assets, setAssets] = useState({ documents: [], git_repos: [] });
  const [loading, setLoading] = useState(true);

  const fetchAssets = async () => {
    try {
      const res = await documentService.getAssets(projectId);
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleDelete = async (type, id) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;
    try {
      if (type === 'document') {
        await documentService.deleteAsset(projectId, id);
      } else {
        await documentService.deleteRepo(projectId, id);
      }
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete asset");
    }
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'done':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-green-100 text-green-700">Indexed</span>;
      case 'failed':
      case 'error':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-red-100 text-red-700">Failed</span>;
      default:
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-blue-100 text-blue-700">Processing</span>;
    }
  };

  const getFileIcon = (ext) => {
    switch (ext?.toLowerCase()) {
      case 'pdf': return '📄';
      case 'md': case 'markdown': return '📝';
      case 'png': case 'jpg': case 'jpeg': return '🖼️';
      case 'txt': return '📃';
      default: return '📄';
    }
  };

  if (loading && assets.documents.length === 0 && assets.git_repos.length === 0) {
    return <div className="text-slate-500 text-sm mt-6">Loading assets...</div>;
  }

  const allAssets = [
    ...assets.documents.map(d => ({ ...d, type: 'document' })),
    ...assets.git_repos.map(r => ({ ...r, type: 'git_repo' }))
  ].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

  // Only Team Leads / Managers can delete
  const canDelete = currentUserRole === 'manager' || currentUserRole === 'team_lead' || currentUserRole === 'admin';

  if (allAssets.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Project Assets</h2>
        <p className="text-slate-500 mb-4 text-sm">No assets have been uploaded to this project yet.</p>
        <button 
          onClick={onUploadClick} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          Upload Asset
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Project Assets</h2>
        <div className="flex gap-2">
          <button 
            onClick={fetchAssets} 
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
          <button 
            onClick={onUploadClick} 
            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg shadow-sm"
          >
            Upload Asset
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Uploaded</th>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{asset.type === 'git_repo' ? '📦' : getFileIcon(asset.file_type)}</span>
                    <span className="font-medium text-slate-800">
                      {asset.type === 'git_repo' ? asset.repo_name : asset.file_name}
                    </span>
                  </div>
                  {asset.type === 'git_repo' && <p className="text-[10px] text-slate-400 mt-0.5 ml-7">{asset.repo_url}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="uppercase text-[10px] font-semibold tracking-wider text-slate-500">
                    {asset.type === 'git_repo' ? 'GIT' : asset.file_type || 'FILE'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(asset.uploaded_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded capitalize">
                    {asset.role_access ? asset.role_access.split(',').join(', ') : 'All Members'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(asset.status)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {asset.type === 'git_repo' ? (
                      <a
                        href={asset.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        View Repo ↗
                      </a>
                    ) : (
                      <Link
                        to={`/projects/${projectId}/assets/${asset.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        View
                      </Link>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => handleDelete(asset.type, asset.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
