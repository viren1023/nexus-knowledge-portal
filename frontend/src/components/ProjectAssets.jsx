import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { documentService, getAssetDownloadUrl } from '../services/api';
import { 
  FileText, 
  FolderGit2, 
  Upload, 
  Search, 
  Grid, 
  List, 
  Filter, 
  ArrowUpDown, 
  ExternalLink, 
  Trash2, 
  Download, 
  Eye, 
  RefreshCw,
  FileCode,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function ProjectAssets({ projectId, currentUserRole, onUploadClick }) {
  const [assets, setAssets] = useState({ documents: [], git_repos: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'document' | 'git_repo'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name'

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
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="size-2.5" /> Indexed
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="size-2.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="size-2.5 animate-spin" /> Processing
          </span>
        );
    }
  };

  const getFileVisual = (ext, isRepo = false) => {
    if (isRepo) {
      return {
        icon: <FolderGit2 className="size-5 text-indigo-600" />,
        color: 'bg-indigo-50 border-indigo-100',
        badge: 'GIT REPO'
      };
    }
    const cleanExt = (ext || 'file').toLowerCase();
    switch (cleanExt) {
      case 'pdf':
        return {
          icon: <FileText className="size-5 text-rose-600" />,
          color: 'bg-rose-50 border-rose-100',
          badge: 'PDF'
        };
      case 'md':
      case 'markdown':
        return {
          icon: <FileText className="size-5 text-sky-600" />,
          color: 'bg-sky-50 border-sky-100',
          badge: 'MARKDOWN'
        };
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return {
          icon: <ImageIcon className="size-5 text-emerald-600" />,
          color: 'bg-emerald-50 border-emerald-100',
          badge: cleanExt.toUpperCase()
        };
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'json':
        return {
          icon: <FileCode className="size-5 text-amber-600" />,
          color: 'bg-amber-50 border-amber-100',
          badge: cleanExt.toUpperCase()
        };
      default:
        return {
          icon: <FileText className="size-5 text-slate-600" />,
          color: 'bg-slate-50 border-slate-200',
          badge: cleanExt.toUpperCase()
        };
    }
  };

  const allAssets = useMemo(() => {
    const list = [
      ...assets.documents.map(d => ({ ...d, type: 'document' })),
      ...assets.git_repos.map(r => ({ ...r, type: 'git_repo' }))
    ];

    // Filter by type
    const filtered = list.filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const name = item.type === 'git_repo' ? item.repo_name : item.file_name;
        if (!name?.toLowerCase().includes(query)) return false;
      }
      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.type === 'git_repo' ? a.repo_name : a.file_name) || '';
        const nameB = (b.type === 'git_repo' ? b.repo_name : b.file_name) || '';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'oldest') {
        return new Date(a.uploaded_at) - new Date(b.uploaded_at);
      }
      return new Date(b.uploaded_at) - new Date(a.uploaded_at);
    });
  }, [assets, typeFilter, searchQuery, sortBy]);

  const canDelete = ['manager', 'team_lead', 'admin'].includes(currentUserRole);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Knowledge & Assets</h2>
          <p className="text-xs text-slate-500">
            {allAssets.length} total files, documentation, and indexed code repositories
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchAssets}
            title="Refresh assets"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Upload className="size-3.5" />
            <span>Upload Asset</span>
          </button>
        </div>
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name or repo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills, Sort, View Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'all' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('document')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'document' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Docs
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('git_repo')}
              className={`px-2.5 py-1 rounded-md transition-colors ${typeFilter === 'git_repo' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Repos
            </button>
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Alphabetical</option>
          </select>

          {/* Grid/List View Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-1 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-1 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Asset Content: Empty, Grid, or List */}
      {allAssets.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 p-8">
          <div className="size-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText className="size-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">No assets found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Try changing your search keywords or filters.' : 'Upload architecture diagrams, requirements specs, PDFs, or git repos to index them for the project AI.'}
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="mt-4 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Upload Asset
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAssets.map((asset) => {
            const isGit = asset.type === 'git_repo';
            const name = isGit ? asset.repo_name : asset.file_name;
            const visual = getFileVisual(asset.file_type, isGit);
            const downloadUrl = !isGit ? getAssetDownloadUrl(projectId, asset.id) : null;

            return (
              <div
                key={asset.id}
                className="group rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`size-10 rounded-lg ${visual.color} border flex items-center justify-center shrink-0`}>
                      {visual.icon}
                    </div>
                    {getStatusBadge(asset.status)}
                  </div>

                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate" title={name}>
                    {name}
                  </h4>
                  {isGit && (
                    <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{asset.repo_url}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {visual.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {asset.role_access ? asset.role_access.split(',').slice(0, 2).join(', ') : 'All members'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    {new Date(asset.uploaded_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isGit ? (
                      <a
                        href={asset.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <span>Repo</span>
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <>
                        <Link
                          to={`/projects/${projectId}/assets/${asset.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye className="size-3" />
                          <span>View</span>
                        </Link>
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            download
                            title="Download file"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Download className="size-3.5" />
                          </a>
                        )}
                      </>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(asset.type, asset.id)}
                        title="Delete asset"
                        className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allAssets.map((asset) => {
                const isGit = asset.type === 'git_repo';
                const name = isGit ? asset.repo_name : asset.file_name;
                const visual = getFileVisual(asset.file_type, isGit);
                const downloadUrl = !isGit ? getAssetDownloadUrl(projectId, asset.id) : null;

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`size-7 rounded-md ${visual.color} border flex items-center justify-center shrink-0`}>
                          {visual.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate max-w-xs">{name}</p>
                          {isGit && <p className="text-[10px] text-slate-400 font-mono truncate">{asset.repo_url}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {visual.badge}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                      {new Date(asset.uploaded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">
                        {asset.role_access ? asset.role_access.split(',').join(', ') : 'All Members'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(asset.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isGit ? (
                          <a
                            href={asset.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-900 text-xs font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                          >
                            <span>Repo</span>
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <>
                            <Link
                              to={`/projects/${projectId}/assets/${asset.id}`}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="size-3" />
                              <span>View</span>
                            </Link>
                            {downloadUrl && (
                              <a
                                href={downloadUrl}
                                download
                                title="Download"
                                className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                              >
                                <Download className="size-3.5" />
                              </a>
                            )}
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(asset.type, asset.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
