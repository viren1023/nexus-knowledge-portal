import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../../services/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SourceDetailPanel from './SourceDetailPanel';
import { 
  Sparkles, 
  Kanban, 
  Code2, 
  PlusCircle, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

export default function ChatContainer({ 
  projectId, 
  sessionId, 
  currentSession,
  onSessionCreated,
  onSessionUpdated 
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Fetch chat history whenever active session changes
  useEffect(() => {
    // If a generation is in progress, abort it when switching sessions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setLoading(false);
    setSelectedSource(null);

    if (!sessionId || !projectId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await chatService.getHistory(projectId, sessionId, 50);
        if (!isMounted) return;
        
        const data = res.data;
        const msgList = Array.isArray(data) ? data : (data.messages || []);
        
        const normalized = msgList.map(m => ({
          ...m,
          role: m.role || m.message_type || 'assistant',
          message_type: m.message_type || m.role || 'assistant',
          sources_detailed: m.sources_detailed || (m.metadata && m.metadata.sources_detailed) || []
        }));

        setMessages(normalized);
        setTimeout(() => scrollToBottom(false), 60);
      } catch (err) {
        console.error('Failed to load chat history', err);
        if (isMounted) {
          setError('Failed to load previous messages for this conversation.');
        }
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sessionId, projectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, loading]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setLoading(false);

    // Mark current streaming assistant message as finished
    setMessages(prev => prev.map(m => (m.isStreaming ? { ...m, isStreaming: false } : m)));
  };

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || !projectId || isGenerating) return;

    const userText = text.trim();
    const tempUserId = `user-${Date.now()}`;
    const userMessage = {
      id: tempUserId,
      role: 'user',
      message_type: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };

    // Optimistically append user message
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setIsGenerating(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const tempAssistantId = `ai-${Date.now()}`;
    const initialAssistantMessage = {
      id: tempAssistantId,
      role: 'assistant',
      message_type: 'assistant',
      content: '',
      isStreaming: true,
      sources: [],
      sources_detailed: [],
      created_at: new Date().toISOString()
    };

    let activeSessionId = sessionId;

    try {
      // If no session exists yet, create one on first message submission
      if (!activeSessionId) {
        try {
          const sessionRes = await chatService.startSession(projectId);
          activeSessionId = sessionRes.data.session_id;
          if (onSessionCreated) {
            onSessionCreated(activeSessionId);
          }
        } catch (sessionErr) {
          console.error('Failed to create session on first message', sessionErr);
        }
      }

      // Append placeholder assistant message for streaming
      setMessages(prev => [...prev, initialAssistantMessage]);
      setLoading(false); // Stop typing bounce once streaming begins

      await chatService.streamMessage(
        projectId, 
        {
          session_id: activeSessionId,
          message: userText
        },
        {
          signal: abortController.signal,
          onMetadata: (metadata) => {
            // Update assistant message with sources & metadata
            setMessages(prev => prev.map(m => {
              if (m.id === tempAssistantId) {
                return {
                  ...m,
                  intent: metadata.intent,
                  confidence: metadata.confidence,
                  sources: metadata.sources || [],
                  sources_detailed: metadata.sources_detailed || [],
                  suggested_task: metadata.suggested_task
                };
              }
              return m;
            }));

            // If session was created on backend, notify parent
            if (metadata.session_id && metadata.session_id !== activeSessionId) {
              activeSessionId = metadata.session_id;
              if (onSessionCreated) {
                onSessionCreated(metadata.session_id);
              }
            }
          },
          onChunk: (chunkText) => {
            // Append incoming chunk
            setMessages(prev => prev.map(m => {
              if (m.id === tempAssistantId) {
                return {
                  ...m,
                  content: (m.content || '') + chunkText,
                  isStreaming: true
                };
              }
              return m;
            }));
          },
          onDone: (doneData) => {
            setMessages(prev => prev.map(m => {
              if (m.id === tempAssistantId) {
                return {
                  ...m,
                  id: doneData.message_id || m.id,
                  content: doneData.full_text || m.content,
                  isStreaming: false
                };
              }
              return m;
            }));

            setIsGenerating(false);
            if (onSessionUpdated) {
              onSessionUpdated();
            }
          },
          onError: (streamErr) => {
            console.error('Stream error encountered', streamErr);
            setError(streamErr.message || 'Error occurred during generation.');
            setIsGenerating(false);
            setLoading(false);
          }
        }
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        console.info('Generation interrupted by user');
      } else {
        console.error('Failed to send message', err);
        setError('Encountered an error while communicating with Nexus AI.');
        setMessages(prev => {
          // If assistant message was started, keep whatever text was generated
          const hasAssistant = prev.some(m => m.id === tempAssistantId);
          if (hasAssistant) {
            return prev.map(m => (m.id === tempAssistantId ? { ...m, isStreaming: false } : m));
          }
          return [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              message_type: 'assistant',
              content: '⚠️ I encountered an error while processing your request. Please try again.',
              created_at: new Date().toISOString()
            }
          ];
        });
      }
    } finally {
      setIsGenerating(false);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const starterPrompts = [
    {
      title: "Project Overview",
      desc: "Understand what this project does and key entry points",
      query: "What is this project about and what are its key components?",
      icon: <FolderOpen className="w-4 h-4 text-indigo-500" />
    },
    {
      title: "Task Query",
      desc: "Check current tasks, priorities, and sprint items",
      query: "Show me all current tasks and their priority",
      icon: <Kanban className="w-4 h-4 text-emerald-500" />
    },
    {
      title: "Code Discovery",
      desc: "Search reusable functions, components, and APIs",
      query: "What reusable code assets and helper functions are indexed?",
      icon: <Code2 className="w-4 h-4 text-blue-500" />
    },
    {
      title: "Create a Task",
      desc: "Draft a new task directly to your project board",
      query: "Create a task to implement comprehensive error logging with high priority",
      icon: <PlusCircle className="w-4 h-4 text-purple-500" />
    }
  ];

  return (
    <div className="flex-1 flex overflow-hidden relative w-full h-full">
      {/* Main Chat Conversation Viewport */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden min-w-0">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-rose-700 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {historyLoading ? (
            <div className="space-y-4 max-w-3xl mx-auto py-8">
              <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              <div className="h-16 bg-indigo-50 border border-indigo-100 rounded-2xl animate-pulse ml-auto max-w-md" />
            </div>
          ) : messages.length === 0 ? (
            /* Empty Chat Welcome Screen / Composer */
            <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {currentSession?.session_title || "How can I help you today?"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Ask questions about documentation, search indexed code assets, or manage project tasks.
                </p>
              </div>

              {/* Quick Starter Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                {starterPrompts.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(card.query)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/20 transition-all duration-150 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1 rounded-md bg-slate-50 group-hover:bg-indigo-100/60 transition-colors">
                        {card.icon}
                      </div>
                      <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {card.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {card.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation Messages */
            <div className="max-w-4xl mx-auto">
              {messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant' || msg.message_type === 'assistant';
                const isLatestAssistant = isAssistant && (
                  index === messages.length - 1 || 
                  (index === messages.length - 2 && messages[messages.length - 1].role === 'user')
                );

                return (
                  <ChatMessage
                    key={msg.id || index}
                    message={msg}
                    onOpenSource={(sourceData) => setSelectedSource(sourceData)}
                    onQuickAction={handleSendMessage}
                    isLatestAssistantMessage={isLatestAssistant}
                    projectId={projectId}
                    activeCitationId={selectedSource?.citationId || selectedSource?.source?.id || (selectedSource?.citationNumber ? `citation_${selectedSource.citationNumber}` : null)}
                  />
                );
              })}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Bar with Stop Button Support */}
        <ChatInput 
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          isGenerating={isGenerating}
          disabled={historyLoading}
        />
      </div>

      {/* Right-Side Pop-out Source & Citations Panel */}
      {selectedSource && (
        <SourceDetailPanel
          selectedSource={selectedSource}
          projectId={projectId}
          onClose={() => setSelectedSource(null)}
          onSelectSource={(newSrc) => {
            setSelectedSource(prev => ({
              ...prev,
              source: newSrc,
              citationId: newSrc.id,
              citationNumber: newSrc.details?.citation_index,
              highlightPassage: newSrc.details?.excerpt || newSrc.snippet || '',
              context: newSrc.details?.context || newSrc.details?.content || newSrc.snippet || ''
            }));
          }}
        />
      )}
    </div>
  );
}
