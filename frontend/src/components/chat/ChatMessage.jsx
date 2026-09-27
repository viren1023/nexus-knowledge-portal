import React, { useRef, useLayoutEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Bot, 
  User, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock
} from 'lucide-react';
import WaveAnimation from './WaveAnimation';

export default function ChatMessage({ 
  message, 
  onOpenSource,
  onQuickAction,
  isLatestAssistantMessage = false,
  projectId: _projectId,
  activeCitationId = null
}) {
  const isUser = message.role === 'user' || message.message_type === 'user';
  const sources = message.sources_detailed || (message.sources && message.sources.map((s, i) => ({
    id: `citation_${i+1}`,
    type: s.type || 'document',
    name: s.title || s.name || s.file_name || 'Source',
    details: {
      citation_index: i + 1,
      relevance_score: 0.85,
      excerpt: s.snippet || '',
      context: s.content || s.snippet || ''
    }
  }))) || [];

  const hasSources = sources && sources.length > 0;
  const suggestedTask = message.suggested_task || (message.metadata && message.metadata.suggested_task);

  const markdownContainerRef = useRef(null);
  const cursorRef = useRef(null);

  // Synchronous streaming cursor attachment to the actual final rendered node
  useLayoutEffect(() => {
    if (!message.isStreaming) {
      if (cursorRef.current && cursorRef.current.parentNode) {
        cursorRef.current.parentNode.removeChild(cursorRef.current);
      }
      return;
    }

    if (!cursorRef.current) {
      const cursor = document.createElement('span');
      cursor.className = 'inline-block w-1.5 h-3.5 ml-1 bg-indigo-600 animate-pulse align-middle rounded-xs pointer-events-none select-none';
      cursor.setAttribute('aria-hidden', 'true');
      cursor.setAttribute('data-streaming-cursor', 'true');
      cursorRef.current = cursor;
    }

    const cursor = cursorRef.current;
    const container = markdownContainerRef.current;
    if (!container) return;

    const findLastRenderedNode = (root) => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (node === cursor) return NodeFilter.FILTER_REJECT;
            if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
            if (node.nodeType === Node.TEXT_NODE) {
              if (node.textContent && node.textContent.length > 0) {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (!node.hasChildNodes()) return NodeFilter.FILTER_ACCEPT;
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let last = null;
      let current = walker.nextNode();
      while (current) {
        last = current;
        current = walker.nextNode();
      }
      return last;
    };

    const target = findLastRenderedNode(container);
    if (target) {
      const buttonAncestor = target.nodeType === Node.ELEMENT_NODE && target.tagName === 'BUTTON'
        ? target
        : target.parentElement?.closest('button');

      if (buttonAncestor && buttonAncestor.parentNode) {
        buttonAncestor.parentNode.insertBefore(cursor, buttonAncestor.nextSibling);
      } else if (target.nodeType === Node.TEXT_NODE && target.parentNode) {
        target.parentNode.insertBefore(cursor, target.nextSibling);
      } else if (target.nodeType === Node.ELEMENT_NODE) {
        target.appendChild(cursor);
      }
    } else {
      container.appendChild(cursor);
    }

    return () => {
      if (cursor && cursor.parentNode) {
        cursor.parentNode.removeChild(cursor);
      }
    };
  }, [message.content, message.isStreaming]);

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCitationClick = (sourceItem, citationNum = 1) => {
    if (onOpenSource) {
      onOpenSource({
        source: sourceItem,
        citationId: sourceItem.id || `citation_${citationNum}`,
        citationNumber: citationNum,
        allSources: sources,
        highlightPassage: sourceItem.details?.excerpt || sourceItem.snippet || '',
        context: sourceItem.details?.context || sourceItem.details?.content || sourceItem.snippet || ''
      });
    }
  };

  // Convert inline citations like [1], [2], [1, 2] to interactive markdown links
  const processedContent = useMemo(() => {
    if (isUser || !message.content || typeof message.content !== 'string') {
      return message.content || '';
    }
    return message.content.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_match, nums) => {
      const parts = nums.split(',').map(n => n.trim()).filter(Boolean);
      return parts.map(n => `[${n}](#cite-${n})`).join(' ');
    });
  }, [message.content, isUser]);

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
            {/* User Message */}
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div>
                {/* Initial generation wave state before text streams */}
                {message.isStreaming && !message.content ? (
                  <div className="py-1">
                    <WaveAnimation label="Generating response..." />
                  </div>
                ) : (
                  <div 
                    ref={markdownContainerRef}
                    className="prose prose-sm max-w-none text-slate-800 break-words leading-relaxed space-y-2 relative"
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ node: _n, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node: _n, ...props }) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
                        ol: ({ node: _n, ...props }) => <ol className="list-decimal pl-4 space-y-1 mb-2" {...props} />,
                        li: ({ node: _n, ...props }) => <li className="text-slate-700" {...props} />,
                        h1: ({ node: _n, ...props }) => <h1 className="text-base font-bold text-slate-900 mt-2 mb-1" {...props} />,
                        h2: ({ node: _n, ...props }) => <h2 className="text-sm font-bold text-slate-900 mt-2 mb-1" {...props} />,
                        h3: ({ node: _n, ...props }) => <h3 className="text-xs font-bold text-slate-900 mt-2 mb-1" {...props} />,
                        blockquote: ({ node: _n, ...props }) => (
                          <blockquote className="border-l-3 border-indigo-400 pl-3 italic text-slate-600 my-2 bg-slate-50 py-1 rounded-r" {...props} />
                        ),
                        a: ({ href, children, ...props }) => {
                          if (href && href.startsWith('#cite-')) {
                            const citationNum = parseInt(href.replace('#cite-', ''), 10);
                            const sourceItem = sources.find(
                              s => s.id === `citation_${citationNum}` || s.details?.citation_index === citationNum
                            ) || sources[citationNum - 1];

                            const sourceId = sourceItem?.id || `citation_${citationNum}`;
                            const isActive = activeCitationId === sourceId || activeCitationId === `citation_${citationNum}`;

                            return (
                              <button
                                type="button"
                                key={`citation-btn-${citationNum}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetSource = sourceItem || {
                                    id: sourceId,
                                    name: `Source ${citationNum}`,
                                    type: 'document',
                                    details: {
                                      citation_index: citationNum,
                                      excerpt: ''
                                    }
                                  };
                                  handleCitationClick(targetSource, citationNum);
                                }}
                                title={sourceItem ? `Open source [${citationNum}]: ${sourceItem.name}` : `Open source [${citationNum}]`}
                                className={`
                                  inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-bold transition-all cursor-pointer select-none align-baseline leading-none
                                  ${isActive
                                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400 scale-105'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
                                  }
                                `}
                              >
                                [{citationNum}]
                              </button>
                            );
                          }
                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800" {...props}>
                              {children}
                            </a>
                          );
                        },
                        code: ({ node: _n, inline, className: _c, children, ...props }) => {
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
                      {processedContent}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Active wave animation during progressive streaming */}
                {message.isStreaming && message.content && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100/90 flex items-center justify-between">
                    <WaveAnimation label="Generating..." />
                    <span className="text-[10px] text-slate-400 font-mono">Live</span>
                  </div>
                )}
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

            {/* Citations Footer & View Sources Toggle (Opens right-side panel) */}
            {!isUser && hasSources && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Inline Badges */}
                  <div className="flex items-center gap-1">
                    {sources.map((src, i) => {
                      const cid = src.id || `citation_${i + 1}`;
                      const isActive = activeCitationId === cid || activeCitationId === `citation_${i + 1}`;
                      return (
                        <button
                          key={src.id || i}
                          type="button"
                          onClick={() => handleCitationClick(src, i + 1)}
                          title={`Open source [${i + 1}]: ${src.name}`}
                          className={`
                            w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer
                            ${isActive
                              ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400 font-bold scale-105'
                              : 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-700'
                            }
                          `}
                        >
                          [{i + 1}]
                        </button>
                      );
                    })}
                  </div>

                  {/* Open Source Panel Button */}
                  <button
                    type="button"
                    onClick={() => handleCitationClick(sources[0], 1)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-indigo-50/70 hover:bg-indigo-100/90 text-indigo-700 border-indigo-200/80 transition-colors cursor-pointer"
                    title="Open grounded sources in side panel"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>View Sources ({sources.length})</span>
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
          </div>

          {/* Timestamp Below Message */}
          <div className={`flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <Clock className="w-2.5 h-2.5 opacity-70" />
            <span>{formatTime(message.created_at) || (isUser ? 'You' : 'Assistant')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
