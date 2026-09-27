import React, { useState } from 'react';
import { 
  FileText, 
  Code2, 
  CheckSquare, 
  FolderGit2, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CitationsPanel({ sources = [], confidence = 0.85, projectId, onSelectSource }) {
  const [expandedIndex, setExpandedIndex] = useState(0); // expand first citation by default
  const navigate = useNavigate();

  if (!sources || sources.length === 0) return null;

  const getSourceIcon = (type) => {
    switch (type) {
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'asset':
        return <Code2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
      case 'project':
        return <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'repo':
        return <FolderGit2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
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

  const getRelevanceBarClass = (score) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.6) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getRelevanceTextClass = (score) => {
    if (score >= 0.8) return 'text-emerald-700 font-semibold';
    if (score >= 0.6) return 'text-amber-700 font-semibold';
    return 'text-rose-700 font-semibold';
  };

  const handleOpenSource = (source) => {
    if (onSelectSource) {
      onSelectSource(source);
      return;
    }
    if (!projectId) return;
    const details = source.details || {};
    if (source.type === 'document' && details.document_id) {
      navigate(`/projects/${projectId}/assets/${details.document_id}`);
    } else if (source.type === 'asset' && details.asset_id) {
      navigate(`/projects/${projectId}/assets/${details.asset_id}`);
    } else if (source.type === 'task') {
      navigate(`/projects/${projectId}`);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200/90 bg-white/95 shadow-xs overflow-hidden text-left animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-800">
            Sources & Citations
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </span>
        </div>

        {confidence != null && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Confidence: <strong className="text-slate-800">{(confidence * 100).toFixed(0)}%</strong></span>
          </div>
        )}
      </div>

      {/* Citations List */}
      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {sources.map((source, idx) => {
          const isExpanded = expandedIndex === idx;
          const details = source.details || {};
          const score = details.relevance_score || 0.8;
          const scorePercent = Math.min(100, Math.max(0, Math.round(score * 100)));

          return (
            <div key={source.id || idx} className="group transition-colors hover:bg-slate-50/60">
              {/* Citation Item Header */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none"
              >
                {/* Citation Number Badge */}
                <div className="w-5 h-5 rounded-md bg-indigo-600/10 border border-indigo-600/20 text-indigo-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {idx + 1}
                </div>

                {/* Source Title & Type */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {getSourceIcon(source.type)}
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                    {source.name || 'Untitled Source'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider ${getTypeBadgeClass(source.type)}`}>
                    {source.type}
                  </span>
                </div>

                {/* Relevance Score Bar */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getRelevanceBarClass(score)}`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                  <span className={`text-[11px] min-w-[28px] text-right ${getRelevanceTextClass(score)}`}>
                    {scorePercent}%
                  </span>
                </div>

                {/* Expand / Collapse Icon */}
                <div className="text-slate-400 group-hover:text-slate-600 p-0.5">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Collapsible Details */}
              {isExpanded && (
                <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-600 space-y-2.5 animate-in fade-in duration-150">
                  {/* Document Specifics */}
                  {source.type === 'document' && (
                    <>
                      {details.section && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700 shrink-0">Section:</span>
                          <span className="text-slate-800">{details.section}</span>
                        </div>
                      )}
                      {details.page && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700 shrink-0">Page:</span>
                          <span className="text-slate-800">{details.page}</span>
                        </div>
                      )}
                      {details.excerpt && (
                        <div className="mt-1">
                          <span className="font-semibold text-slate-700 block mb-1">Excerpt:</span>
                          <blockquote className="pl-3 border-l-2 border-indigo-400 text-slate-600 italic bg-white/70 p-2 rounded-r-md text-[11px] leading-relaxed">
                            "{details.excerpt}"
                          </blockquote>
                        </div>
                      )}
                    </>
                  )}

                  {/* Asset / Code Specifics */}
                  {source.type === 'asset' && (
                    <>
                      {details.language && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 shrink-0">Language:</span>
                          <span className="font-mono text-[11px] bg-slate-200/60 text-slate-800 px-1.5 py-0.5 rounded">
                            {details.language}
                          </span>
                        </div>
                      )}
                      {details.signature && (
                        <div className="mt-1">
                          <span className="font-semibold text-slate-700 block mb-0.5">Signature:</span>
                          <pre className="p-2 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-md overflow-x-auto">
                            {details.signature}
                          </pre>
                        </div>
                      )}
                      {details.file_path && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700 shrink-0">File:</span>
                          <span className="font-mono text-[11px] text-slate-700 break-all">{details.file_path}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Task Specifics */}
                  {source.type === 'task' && (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-700">Status: </span>
                        <span className="capitalize text-indigo-600 font-medium">{details.status || 'open'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Priority: </span>
                        <span className="uppercase text-amber-600 font-bold">{details.priority || 'medium'}</span>
                      </div>
                      {details.assigned_to && (
                        <div>
                          <span className="font-semibold text-slate-700">Assignee: </span>
                          <span>{details.assigned_to}</span>
                        </div>
                      )}
                      {details.due_date && (
                        <div>
                          <span className="font-semibold text-slate-700">Due: </span>
                          <span>{details.due_date}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Link to open in portal */}
                  {(details.document_id || details.asset_id || source.type === 'task') && projectId && (
                    <div className="pt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenSource(source)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <span>View in Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
