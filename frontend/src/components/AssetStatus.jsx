import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentService } from '../services/api';
import { FileText, GitBranch, RefreshCw, Trash2, UploadCloud, ExternalLink, Eye } from 'lucide-react';

export default function AssetStatus({ projectId, onUploadClick }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canDeleteAssets = ['manager', 'team_lead'].includes(user.role);
  const [assets, setAssets] = useState({ documents: [], git_repos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [confirmAsset, setConfirmAsset] = useState(null);

  const fetchAssets = async () => {
    try {
      setError('');
      const res = await documentService.getAssets(projectId);
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
      setError('Assets could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    // Optional: auto refresh every 30s to see status updates
    const interval = setInterval(fetchAssets, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

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

  const formatUploadedAt = (value) => {
    if (!value) return { date: 'Upload date unavailable', time: '' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: 'Upload date unavailable', time: '' };
    return {
      date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const handleDelete = async () => {
    if (!confirmAsset) return;
    setDeleting(confirmAsset.id);
    setError('');
    try {
      if (confirmAsset.kind === 'document') {
        await documentService.deleteDocument(projectId, confirmAsset.id);
      } else {
        await documentService.deleteRepo(projectId, confirmAsset.id);
      }
      setConfirmAsset(null);
      await fetchAssets();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Asset deletion failed.');
    } finally {
      setDeleting(null);
    }
  };

  const renderAssetRow = (asset, kind) => {
    const uploaded = formatUploadedAt(asset.uploaded_at || asset.indexed_at);
    const type = kind === 'document' ? (asset.file_type || asset.file_name?.split('.').pop() || 'file') : 'git';
    const title = kind === 'document' ? asset.file_name : asset.repo_name;
    const subtitle = kind === 'document' ? type.toUpperCase() : asset.repo_url;
    const Icon = kind === 'document' ? FileText : GitBranch;

    return (
      <li key={`${kind}-${asset.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
            <p className="text-xs text-slate-500 mt-1">Uploaded {uploaded.date} {uploaded.time && <span className="ml-2">{uploaded.time}</span>}</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          {getStatusBadge(asset.status)}
          {/* View button */}
          {kind === 'document' ? (
            <Link
              to={`/projects/${projectId}/assets/${asset.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <Eye className="w-3.5 h-3.5" />
              View
            </Link>
          ) : asset.repo_url ? (
            <a
              href={asset.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Repo
            </a>
          ) : null}
          {canDeleteAssets && (
            <button
              onClick={() => setConfirmAsset({ id: asset.id, kind, title })}
              disabled={deleting === asset.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Project Assets</h2>
        <div className="flex gap-2">
          <button onClick={fetchAssets} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-2 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {onUploadClick && (
            <button onClick={onUploadClick} className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg">
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Asset
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={fetchAssets} className="font-semibold hover:text-red-900">Retry</button>
        </div>
      )}

      {loading && assets.documents.length === 0 && assets.git_repos.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(item => <div key={item} className="h-20 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : assets.documents.length === 0 && assets.git_repos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <p className="font-medium text-slate-700">No assets uploaded yet.</p>
          <p className="text-sm text-slate-500 mt-1">Upload project documents or repositories.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {assets.documents.map(doc => renderAssetRow(doc, 'document'))}
          {assets.git_repos.map(repo => renderAssetRow(repo, 'repo'))}
        </ul>
      )}

      {confirmAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Delete Asset?</h3>
            <p className="mt-3 text-sm text-slate-600">
              Are you sure you want to delete "{confirmAsset.title}"?
            </p>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove the asset and its indexed project knowledge.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmAsset(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting === confirmAsset.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === confirmAsset.id ? 'Deleting...' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
