import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  BookOpen, 
  FileText, 
  Code2, 
  CheckSquare, 
  ExternalLink, 
  Layers, 
  FolderGit2, 
  Quote, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { documentService } from '../../services/api';

export default function SourceDetailPanel({ 
  selectedSource, 
  projectId, 
  onClose,
  onSelectSource 
}) {
  const source = selectedSource?.source || {};
  const allSources = selectedSource?.allSources || [];
  const details = useMemo(() => source.details || {}, [source.details]);
  const score = details.relevance_score || 0.85;
  const scorePercent = Math.min(100, Math.max(0, Math.round(score * 100)));

  const [contextData, setContextData] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState(null);

  // Optional full document fallback state (collapsed by default)
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [fullDocContent, setFullDocContent] = useState(null);
  const [loadingFullDoc, setLoadingFullDoc] = useState(false);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load relevant context around citation (prioritizing chunk metadata without full doc download)
  const loadRelevantContext = useCallback(async () => {
    // 1. If context was already provided in citation metadata or selectedSource, use immediately
    const immediateContext = selectedSource?.context || details.context || details.content;
    if (immediateContext && immediateContext.trim()) {
      setContextData(immediateContext.trim());
      setLoadingContext(false);
      setContextError(null);
      return;
    }

    // 2. If chunk_id is available, fetch the specific chunk context
    const chunkId = details.chunk_id;
    if (chunkId && projectId) {
      setLoadingContext(true);
      setContextError(null);
      try {
        const res = await documentService.getChunkContext(projectId, chunkId);
        if (res.data && res.data.content) {
          setContextData(res.data.content);
        } else {
          // Fallback to excerpt if available
          setContextData(details.excerpt || selectedSource?.highlightPassage || null);
        }
      } catch (err) {
        console.warn('Could not retrieve chunk context', err);
        if (details.excerpt || selectedSource?.highlightPassage) {
          setContextData(details.excerpt || selectedSource?.highlightPassage);
        } else {
          setContextError('Unable to load the cited context.');
        }
      } finally {
        setLoadingContext(false);
      }
      return;
    }

    // 3. If excerpt is available, use it directly
    const fallbackExcerpt = details.excerpt || selectedSource?.highlightPassage;
    if (fallbackExcerpt && fallbackExcerpt.trim()) {
      setContextData(fallbackExcerpt.trim());
      setLoadingContext(false);
      setContextError(null);
      return;
    }

    // 4. If neither chunk nor excerpt is present
    setContextError('Unable to load the cited context.');
    setLoadingContext(false);
  }, [selectedSource, projectId, details]);

  useEffect(() => {
    setShowFullDoc(false);
    setFullDocContent(null);
    loadRelevantContext();
  }, [loadRelevantContext, source.id, details.chunk_id]);

  // Partition context into: before context, highlighted passage, after context
  const { beforeContext, highlightedPassage, afterContext } = useMemo(() => {
    const rawExcerpt = (selectedSource?.highlightPassage || details.excerpt || '').trim();
    const full = (contextData || '').trim();

    if (!full) {
      return {
        beforeContext: '',
        highlightedPassage: rawExcerpt,
        afterContext: ''
      };
    }

    if (!rawExcerpt) {
      return {
        beforeContext: '',
        highlightedPassage: full,
        afterContext: ''
      };
    }

    // Clean excerpt for robust matching (remove trailing/leading dots)
    const cleanExcerpt = rawExcerpt.replace(/^[\s.…]+|[\s.…]+$/g, '').trim();

    // 1. Exact match search
    let matchIdx = full.toLowerCase().indexOf(cleanExcerpt.toLowerCase());
    let matchLen = cleanExcerpt.length;

    // 2. Partial prefix match search if excerpt was truncated
    if (matchIdx === -1 && cleanExcerpt.length > 30) {
      const prefix = cleanExcerpt.slice(0, 35).toLowerCase();
      matchIdx = full.toLowerCase().indexOf(prefix);
      if (matchIdx !== -1) {
        matchLen = Math.min(cleanExcerpt.length, full.length - matchIdx);
      }
    }

    if (matchIdx !== -1) {
      const before = full.slice(0, matchIdx).trim();
      const match = full.slice(matchIdx, matchIdx + matchLen).trim();
      const after = full.slice(matchIdx + matchLen).trim();
      return {
        beforeContext: before,
        highlightedPassage: match || rawExcerpt,
        afterContext: after
      };
    }

    // If excerpt is not directly inside full text
    return {
      beforeContext: '',
      highlightedPassage: rawExcerpt,
      afterContext: full !== rawExcerpt ? full : ''
    };
  }, [contextData, selectedSource?.highlightPassage, details.excerpt]);

  // Optional: load full document on explicit user request
  const handleToggleFullDocument = async () => {
    if (showFullDoc) {
      setShowFullDoc(false);
      return;
    }

    setShowFullDoc(true);
    if (fullDocContent) return;

    const assetId = details.document_id || details.asset_id;
    if (!assetId || !projectId) return;

    setLoadingFullDoc(true);
    try {
      const filePath = details.file_path || null;
      const res = await documentService.getAssetContent(projectId, assetId, filePath);
      setFullDocContent(res.data);
    } catch (err) {
      console.warn('Could not load full document file', err);
      setFullDocContent('Full document content could not be loaded.');
    } finally {
      setLoadingFullDoc(false);
    }
  };

  const getSourceIcon = (type) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'asset':
        return <Code2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'project':
        return <Layers className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'repo':
        return <FolderGit2 className="w-4 h-4 text-purple-500 shrink-0" />;
      default:
        return <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'document':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'asset':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'task':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'project':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'repo':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const assetId = details.document_id || details.asset_id;

  return (
    <aside 
      className="w-full sm:w-96 md:w-[420px] lg:w-[460px] xl:w-[500px] h-full flex flex-col bg-white border-l border-slate-200 shadow-xl shrink-0 z-30 animate-in slide-in-from-right duration-200"
      aria-label="View Source Panel"
    >
      {/* Panel Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
            {getSourceIcon(source.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={source.name}>
                {source.name || 'View Source'}
              </h3>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${getTypeBadgeClass(source.type)}`}>
                {source.type}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {details.file_name || details.file_path || 'Cited source context'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {assetId && projectId && (
            <a
              href={`/projects/${projectId}/assets/${assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full asset in new tab"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close source panel (Esc)"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multiple Citations Switcher (updates same panel) */}
      {allSources && allSources.length > 1 && (
        <div className="px-3.5 py-2 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Citations:
          </span>
          {allSources.map((s, idx) => {
            const isCurrent = (s.id && s.id === source.id) || (details.citation_index === idx + 1) || (s.name === source.name && idx === 0);
            return (
              <button
                key={s.id || idx}
                type="button"
                onClick={() => onSelectSource && onSelectSource(s)}
                className={`
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer
                  ${isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }
                `}
              >
                <span>[{idx + 1}]</span>
                <span className="max-w-[120px] truncate">{s.name || `Source ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Panel Body with Explicit States: Loading, Loaded, Error */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. Loading State */}
        {loadingContext ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Loading relevant context...</p>
              <p className="text-xs text-slate-400">Retrieving cited passage and surrounding context</p>
            </div>
          </div>
        ) : contextError ? (
          /* 2. Error State */
          <div className="p-6 bg-rose-50/70 border border-rose-200 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900">Unable to load the cited context.</h4>
              <p className="text-xs text-rose-600">The referenced source context could not be loaded.</p>
            </div>
            <button
              type="button"
              onClick={loadRelevantContext}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          /* 3. Loaded State with Surrounding Context and Highlighted Cited Passage */
          <div className="space-y-4">
            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {details.page && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold">
                    Page {details.page}
                  </span>
                )}
                {details.section && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium truncate max-w-[180px]">
                    {details.section}
                  </span>
                )}
                {details.language && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                    {details.language}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>{scorePercent}% relevance</span>
              </div>
            </div>

            {/* Context Box: Before Context -> Highlighted Citation -> After Context */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Relevant Source Passage</span>
                {details.chunk_id && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Chunk #{details.chunk_id.slice(0, 8)}
                  </span>
                )}
              </div>

              {/* Context Before Citation */}
              {beforeContext && (
                <div className="text-xs text-slate-500 font-sans leading-relaxed whitespace-pre-wrap pl-2.5 border-l-2 border-slate-200">
                  ...{beforeContext}
                </div>
              )}

              {/* Highlighted Cited Passage */}
              <div className="rounded-xl border-2 border-indigo-400 bg-indigo-50/70 p-3.5 shadow-xs ring-2 ring-indigo-200/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    <Quote className="w-3.5 h-3.5 text-indigo-600 fill-indigo-500/20" />
                    <span>Cited Content</span>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Referenced Passage
                  </span>
                </div>
                <blockquote className="text-xs font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-indigo-200 shadow-2xs">
                  "{highlightedPassage}"
                </blockquote>
              </div>

              {/* Context After Citation */}
              {afterContext && (
                <div className="text-xs text-slate-500 font-sans leading-relaxed whitespace-pre-wrap pl-2.5 border-l-2 border-slate-200">
                  {afterContext}...
                </div>
              )}
            </div>

            {/* Task Specific Display */}
            {source.type === 'task' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Task Information</h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
                    <span className="capitalize font-semibold text-indigo-700">{details.status || 'Open'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Priority</span>
                    <span className="uppercase font-bold text-amber-600">{details.priority || 'Medium'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assignee</span>
                    <span className="font-medium text-slate-800">{details.assigned_to || 'Unassigned'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Due Date</span>
                    <span className="font-medium text-slate-800">{details.due_date || 'None'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Code Asset Specifics */}
            {source.type === 'asset' && details.signature && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Symbol Signature</h4>
                <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto shadow-inner border border-slate-800">
                  <code>{details.signature}</code>
                </pre>
              </div>
            )}

            {/* Explicit, Separated Full Document View (Optional, clearly distinguished from cited context) */}
            {assetId && (
              <div className="pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={handleToggleFullDocument}
                  className="w-full py-2 px-3 flex items-center justify-between text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>View Full Document File (Optional)</span>
                  </div>
                  {showFullDoc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showFullDoc && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Full File Preview</span>
                      {loadingFullDoc && <span className="animate-pulse">Loading file...</span>}
                    </div>
                    {loadingFullDoc ? (
                      <div className="p-4 space-y-2 animate-pulse">
                        <div className="h-3 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-5/6" />
                      </div>
                    ) : fullDocContent ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 whitespace-pre-wrap overflow-x-auto max-h-[260px] leading-relaxed">
                        {fullDocContent}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">File content preview unavailable.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span>Grounded Knowledge Portal</span>
        <button
          type="button"
          onClick={onClose}
          className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
        >
          Dismiss Panel
        </button>
      </div>
    </aside>
  );
}
