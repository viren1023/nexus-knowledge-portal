import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { documentService, getAssetContentUrl } from '../services/api';

const TreeItem = ({ item, currentPath, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = currentPath === item.path;

  if (item.is_dir) {
    return (
      <div className="pl-4">
        <div 
          className="flex items-center gap-2 cursor-pointer py-1 px-2 hover:bg-slate-100 rounded text-sm text-slate-700 font-medium"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-slate-400 w-4">{isOpen ? '📂' : '📁'}</span>
          <span className="truncate">{item.name}</span>
        </div>
        {isOpen && item.children && (
          <div className="border-l border-slate-200 ml-2">
            {item.children.map(child => (
              <TreeItem key={child.path} item={child} currentPath={currentPath} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`pl-4 flex items-center gap-2 cursor-pointer py-1 px-2 rounded text-sm truncate
        ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}
      onClick={() => onSelect(item)}
    >
      <span className="text-slate-400 w-4">📄</span>
      <span className="truncate">{item.name}</span>
    </div>
  );
};

export default function AssetViewerModal({ asset, projectId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // For files
  const [textContent, setTextContent] = useState(null);
  const [contentUrl, setContentUrl] = useState(null);

  // For Git Repos
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadAsset();
  }, [asset]);

  const loadAsset = async () => {
    setLoading(true);
    setError(null);
    setTextContent(null);
    try {
      if (asset.type === 'git_repo') {
        const res = await documentService.getAssetTree(projectId, asset.id);
        setTree(res.data.tree);
      } else {
        const url = getAssetContentUrl(projectId, asset.id);
        setContentUrl(url);

        // Fetch text content for certain file types
        const ext = asset.file_type?.toLowerCase();
        if (['md', 'markdown', 'txt'].includes(ext)) {
          const res = await documentService.getAssetContent(projectId, asset.id);
          setTextContent(res.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load asset. You might not have access or the asset is still processing.");
    } finally {
      setLoading(false);
    }
  };

  const loadGitFile = async (file) => {
    setSelectedFile(file);
    setTextContent('Loading...');
    try {
      const res = await documentService.getAssetContent(projectId, asset.id, file.path);
      setTextContent(res.data);
    } catch (err) {
      setTextContent("Error loading file content.");
    }
  };

  const renderContent = () => {
    if (loading) return <div className="p-8 text-center text-slate-500">Loading asset viewer...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    if (asset.type === 'git_repo') {
      return (
        <div className="flex h-full border-t border-slate-200">
          <div className="w-1/3 min-w-[250px] border-r border-slate-200 bg-slate-50 overflow-y-auto py-4">
            <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Repository Files</h3>
            {tree.map(node => (
              <TreeItem key={node.path} item={node} currentPath={selectedFile?.path} onSelect={loadGitFile} />
            ))}
          </div>
          <div className="w-2/3 bg-slate-50 overflow-y-auto p-4">
            {selectedFile ? (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm h-full flex flex-col">
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0 rounded-t-lg">
                  <span className="text-sm font-mono text-slate-700 truncate">{selectedFile.path}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Read Only</span>
                </div>
                <div className="p-4 overflow-y-auto flex-1 text-sm font-mono whitespace-pre text-slate-800">
                  {textContent}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select a file from the repository tree to view its contents.
              </div>
            )}
          </div>
        </div>
      );
    }

    // Document Assets
    const ext = asset.file_type?.toLowerCase();

    if (ext === 'pdf') {
      return <iframe src={contentUrl} className="w-full h-full border-0" title="PDF Viewer" />;
    }

    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return (
        <div className="flex items-center justify-center h-full bg-slate-100 p-8 overflow-auto">
          <img src={contentUrl} alt="Asset" className="max-w-full max-h-full object-contain shadow-sm border border-slate-200 bg-white" />
        </div>
      );
    }

    if (['md', 'markdown'].includes(ext)) {
      return (
        <div className="prose prose-sm max-w-none p-8 overflow-y-auto bg-white h-full">
          <ReactMarkdown>{textContent || ''}</ReactMarkdown>
        </div>
      );
    }

    if (ext === 'txt') {
      return (
        <div className="p-8 overflow-y-auto h-full bg-white font-mono text-sm whitespace-pre-wrap text-slate-800">
          {textContent}
        </div>
      );
    }

    // Docx usually downloads, but for viewer we could try Google Docs Viewer if public, 
    // or just say it's not viewable inline yet. Since it's internal, we'll offer a download.
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8 text-center space-y-4">
        <span className="text-4xl">📄</span>
        <h3 className="text-lg font-medium text-slate-800">Preview not available</h3>
        <p className="text-sm text-slate-500">This file type ({ext}) cannot be previewed in the browser.</p>
        <a 
          href={contentUrl} 
          download 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          Download File
        </a>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-full flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex flex-col overflow-hidden pr-4">
            <h2 className="text-lg font-bold text-slate-800 truncate">
              {asset.type === 'git_repo' ? asset.repo_name : asset.file_name}
            </h2>
            <div className="flex gap-3 text-xs text-slate-500 mt-1 items-center">
              <span className="uppercase font-semibold tracking-wider">
                {asset.type === 'git_repo' ? 'Git Repository' : `${asset.file_type} File`}
              </span>
              <span>•</span>
              <span>Uploaded {new Date(asset.uploaded_at).toLocaleString()}</span>
              <span>•</span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded capitalize">
                Access: {asset.role_access ? asset.role_access.split(',').join(', ') : 'All Members'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 p-2 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
