import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Bot, 
  User, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Clock
} from 'lucide-react';
import CitationsPanel from './CitationsPanel';

export default function ChatMessage({ 
  message, 
  isExpanded, 
  onToggleCitations,
  onQuickAction,
  isLatestAssistantMessage = false,
  projectId
}) {
  const isUser = message.role === 'user' || message.message_type === 'user';
  const sources = message.sources_detailed || (message.sources && message.sources.map((s, i) => ({
    id: `citation_${i+1}`,
    type: s.type || 'document',
    name: s.title || s.name || s.file_name || 'Source',
    details: {
      relevance_score: 0.85,
      excerpt: s.snippet || ''
    }
  }))) || [];

  const hasSources = sources && sources.length > 0;
  const suggestedTask = message.suggested_task || (message.metadata && message.metadata.suggested_task);
  const followUps = message.follow_ups || (message.metadata && message.metadata.follow_ups) || [];

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[92%] sm:max-w-[85%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div 
          className={`
            w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs
            ${isUser 
              ? 'bg-indigo-600 text-white' 
              : 'bg-indigo-50 border border-indigo-200 text-indigo-600'
            }
          `}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Bubble Content */}
        <div className="flex-1 min-w-0">
          <div 
            className={`
              p-4 rounded-2xl text-sm leading-relaxed
              ${isUser 
                ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md shadow-indigo-500/10' 
                : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs'
              }
            `}
          >
            {/* Message Body */}
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none text-slate-800 break-words leading-relaxed space-y-2">
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 mb-2" {...props} />,
                    li: ({ node, ...props }) => <li className="text-slate-700" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-base font-bold text-slate-900 mt-2 mb-1" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-sm font-bold text-slate-900 mt-2 mb-1" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-slate-900 mt-2 mb-1" {...props} />,
                    blockquote: ({ node, ...props }) => (
                      <blockquote className="border-l-3 border-indigo-400 pl-3 italic text-slate-600 my-2 bg-slate-50 py-1 rounded-r" {...props} />
                    ),
                    code: ({ node, inline, className, children, ...props }) => {
                      return inline ? (
                        <code className="bg-slate-100 text-indigo-700 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200" {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-xl overflow-x-auto my-2 shadow-inner border border-slate-800">
                          <code>{children}</code>
                        </pre>
                      );
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Task Draft Action Buttons (e.g. Confirm / Cancel) */}
            {!isUser && suggestedTask && suggestedTask.status === 'pending' && isLatestAssistantMessage && (
              <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuickAction && onQuickAction('Yes, create it')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Yes, Create Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickAction && onQuickAction('Cancel')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-[0.98] text-xs font-semibold transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Draft</span>
                </button>
              </div>
            )}

            {/* Citations Footer & View Sources Toggle */}
            {!isUser && hasSources && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Inline Badges */}
                  <div className="flex items-center gap-1">
                    {sources.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={onToggleCitations}
                        title={src.name}
                        className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                      >
                        [{i + 1}]
                      </button>
                    ))}
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={onToggleCitations}
                    className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer
                      ${isExpanded 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 border-indigo-200/80'
                      }
                    `}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>{isExpanded ? 'Hide' : 'View'} Sources ({sources.length})</span>
                  </button>
                </div>

                {message.confidence != null && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{(message.confidence * 100).toFixed(0)}% confident</span>
                  </span>
                )}
              </div>
            )}

            {/* Follow-up Suggestions Chips */}
            {!isUser && followUps && followUps.length > 0 && isLatestAssistantMessage && (!suggestedTask || suggestedTask.status !== 'pending') && (
              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-slate-500 font-medium">Suggestions:</span>
                {followUps.map((suggestion, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => onQuickAction && onQuickAction(suggestion)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer"
                  >
                    <span>{suggestion}</span>
                    <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp Below Message */}
          <div className={`flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <Clock className="w-2.5 h-2.5 opacity-70" />
            <span>{formatTime(message.created_at) || (isUser ? 'You' : 'Assistant')}</span>
          </div>

          {/* Expanded Citations Panel */}
          {!isUser && hasSources && isExpanded && (
            <CitationsPanel 
              sources={sources} 
              confidence={message.confidence} 
              projectId={projectId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
